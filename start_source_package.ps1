param([switch]$NoBrowser, [switch]$CheckOnly, [ValidateRange(1,65535)][int]$Port = 8765)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root
$startupLog = Join-Path $env:TEMP 'EchemPlotStudio-startup.log'
Set-Content -LiteralPath $startupLog -Value "Started $(Get-Date -Format o)" -Encoding UTF8
function Write-Stage([string]$message) { Write-Host $message; Add-Content -LiteralPath $startupLog -Value $message -Encoding UTF8 }

# Windows PowerShell 5.1 turns redirected native stderr into error records.
# A failed dependency probe is expected on a fresh download, so inspect its
# exit code instead of letting ErrorActionPreference=Stop abort installation.
function Invoke-PythonLogged([string]$Executable, [string[]]$Arguments, [switch]$Quiet) {
  $savedPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & $Executable @Arguments 2>&1 | ForEach-Object {
      $line = "$_"
      Add-Content -LiteralPath $startupLog -Value $line -Encoding UTF8
      if (-not $Quiet) { Write-Host $line }
    }
    $exitCode = $LASTEXITCODE
  } finally { $ErrorActionPreference = $savedPreference }
  return $exitCode
}

function Find-Python {
  $candidates = @()
  if ($env:ECHEM_PYTHON) { $candidates += $env:ECHEM_PYTHON }
  foreach ($name in @('python3','python')) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { $candidates += $cmd.Source }
  }
  if ($env:LOCALAPPDATA) {
    foreach ($v in @('313','312','311','310','39','38','37','36')) {
      $candidates += Join-Path $env:LOCALAPPDATA "Programs\Python\Python$v\python.exe"
    }
  }
  if ($env:USERPROFILE) {
    $candidates += Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
  }
  $fallbackPython = $null
  foreach ($path in ($candidates | Select-Object -Unique)) {
    if (-not (Test-Path -LiteralPath $path) -or $path -like '*\Microsoft\WindowsApps\*') { continue }
    try {
      $version = & $path -c 'import sys; print(sys.version_info[0] * 100 + sys.version_info[1])' 2>$null
      if ([int]$version -ge 309) {
        if (-not $fallbackPython) { $fallbackPython = (Resolve-Path -LiteralPath $path).Path }
        $probeExit = Invoke-PythonLogged -Executable $path -Arguments @((Join-Path $root 'ndax_reader.py'), '--check') -Quiet
        if ($probeExit -eq 0) { return (Resolve-Path -LiteralPath $path).Path }
      }
    } catch { }
  }
  if ($fallbackPython) { return $fallbackPython }
  throw 'Python 3.9 or newer was not found. Install Python 3 from python.org, then run this launcher again.'
}

Write-Stage 'Checking Python...'
$python = Find-Python
Write-Stage "Python: $python"
$reader = Join-Path $root 'ndax_reader.py'
$probeExit = Invoke-PythonLogged -Executable $python -Arguments @($reader, '--check') -Quiet
$mprProbe = 0
if (-not $CheckOnly) {
  $mprProbe = Invoke-PythonLogged -Executable $python -Arguments @((Join-Path $root 'mpr_reader.py'), '--check') -Quiet
}
if ($probeExit -ne 0 -or $mprProbe -ne 0) {
  Write-Stage 'Installing local NDAX dependencies into a new package folder...'
  $runtimePackages = Join-Path (Join-Path $root '.runtime') ('packages-' + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $runtimePackages -ErrorAction Stop | Out-Null
  $previousRuntime = $env:ECHEM_RUNTIME_PACKAGES
  try {
    $env:ECHEM_RUNTIME_PACKAGES = $runtimePackages
    # Reuse working numerical libraries before downloading another binary build.
    $baseProbe = Invoke-PythonLogged -Executable $python -Arguments @('-c', 'import pandas,numpy; v=tuple(map(int,pandas.__version__.split(chr(46))[:2])); assert (1,5)<=v<(4,0)') -Quiet
    $requirements = if ($baseProbe -eq 0) { 'requirements_ndax_reader.txt' } else { 'requirements_ndax.txt' }
    $pipArgs = @('-m', 'pip', 'install', '--target', $runtimePackages, '--no-compile', '--disable-pip-version-check', '-r', (Join-Path $root $requirements))
    if ($baseProbe -eq 0) { $pipArgs += '--no-deps' }
    $installExit = Invoke-PythonLogged -Executable $python -Arguments $pipArgs
    if ($installExit -ne 0) { throw "NDAX dependency installation failed. See the installation error in $startupLog" }
    $probeExit = Invoke-PythonLogged -Executable $python -Arguments @($reader, '--check')
    if ($probeExit -ne 0) { throw "The new NDAX packages could not be loaded. Windows application control may have blocked a module. Details: $startupLog" }
    if (-not $CheckOnly) {
      Write-Stage 'Installing optional EC-Lab MPR reader...'
      $mprInstall = Invoke-PythonLogged -Executable $python -Arguments @('-m', 'pip', 'install', '--target', $runtimePackages, '--no-deps', '--no-compile', '--disable-pip-version-check', 'datalab-org-galvani==0.6.0')
      $mprProbe = Invoke-PythonLogged -Executable $python -Arguments @((Join-Path $root 'mpr_reader.py'), '--check')
      if ($mprInstall -ne 0 -or $mprProbe -ne 0) { Write-Stage 'MPR reader unavailable. Other formats can still be opened.' }
    }
    $activateExit = Invoke-PythonLogged -Executable $python -Arguments @((Join-Path $root 'runtime_packages.py'), '--activate', $runtimePackages) -Quiet
    if ($activateExit -ne 0) { throw "Could not save the verified package location. Details: $startupLog" }
  } finally {
    $env:ECHEM_RUNTIME_PACKAGES = $previousRuntime
  }
}
if ($CheckOnly) { Write-Stage 'Python NDAX reader is ready.'; return }

function Test-CurrentServer($status) {
  return $status -and $status.ok -and $status.reader -eq 'newarenda-python' -and $status.service -eq 'ndax-api' -and $status.version -eq '1.27.13' -and $status.root -eq $root
}
$chosenPort = $null
foreach ($candidatePort in $Port..([Math]::Min(65535,$Port+20))) {
  $candidateUrl = "http://127.0.0.1:$candidatePort/"
  $existing = $null
  try { $existing = Invoke-RestMethod ($candidateUrl+'health') -TimeoutSec 1 } catch { }
  if (Test-CurrentServer $existing) {
    if (-not $NoBrowser) { Start-Process $candidateUrl }
    Write-Host "Echem Plot Studio is already running at $candidateUrl"
    return
  }
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$candidatePort)
  try {
    $listener.Start()
    $chosenPort = $candidatePort
  } catch {
    Write-Stage "Port $candidatePort is occupied; checking another local port..."
  } finally { $listener.Stop() }
  if ($null -ne $chosenPort) { break }
}
if ($null -eq $chosenPort) { throw 'No available local port was found in the startup range.' }
$Port = $chosenPort
$url = "http://127.0.0.1:$Port/"

$serverScript = Join-Path $root 'ndax_api_server.py'
$server = Start-Process -FilePath $python -ArgumentList @(('"' + $serverScript + '"'), '--port', $Port) -WorkingDirectory $root -PassThru -WindowStyle Hidden
$started = $false
for ($i=0; $i-lt 40; $i++) {
  Start-Sleep -Milliseconds 250
  if ($server.HasExited) { break }
  try { if (Test-CurrentServer (Invoke-RestMethod ($url+'health') -TimeoutSec 1)) { $started=$true; break } } catch { }
}
if (-not $started) { if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }; throw 'The local server did not start.' }
if (-not $NoBrowser) { Start-Process $url }
Write-Host "Running at $url. Close this window to stop the server."
try { Wait-Process -Id $server.Id } finally { if (-not $server.HasExited) { Stop-Process -Id $server.Id } }
