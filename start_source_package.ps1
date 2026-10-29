param([switch]$NoBrowser, [switch]$CheckOnly, [ValidateRange(1,65535)][int]$Port = 8765)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root
$startupLog = Join-Path $env:TEMP 'EchemPlotStudio-startup.log'
Set-Content -LiteralPath $startupLog -Value "Started $(Get-Date -Format o)" -Encoding UTF8
function Write-Stage([string]$message) { Write-Host $message; Add-Content -LiteralPath $startupLog -Value $message -Encoding UTF8 }

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
        & $path (Join-Path $root 'ndax_reader.py') --check 1>$null 2>$null
        if ($LASTEXITCODE -eq 0) { return (Resolve-Path -LiteralPath $path).Path }
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
$runtimePackages = Join-Path $root '.runtime\\python'
& $python $reader --check 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Stage 'Installing local NDAX dependencies (first start requires internet)...'
  & $python -m pip install --target $runtimePackages --upgrade --disable-pip-version-check -r (Join-Path $root 'requirements_ndax.txt')
  if ($LASTEXITCODE -ne 0) { throw 'NDAX dependency installation failed. Check the internet connection and Python installation.' }
  & $python $reader --check
  if ($LASTEXITCODE -ne 0) { throw 'NDAX dependencies could not be loaded.' }
}
if ($CheckOnly) { Write-Stage 'Python NDAX reader is ready.'; return }
function Test-CurrentServer($status) {
  return $status -and $status.ok -and $status.reader -eq 'newarenda-python' -and $status.service -eq 'ndax-api' -and $status.version -eq '1.24.16' -and $status.root -eq $root
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
