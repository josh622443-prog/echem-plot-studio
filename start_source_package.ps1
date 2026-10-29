param([switch]$NoBrowser, [switch]$CheckOnly, [int]$Port = 8765)
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
$url = "http://127.0.0.1:$Port/"
if ($CheckOnly) { Write-Stage 'Python NDAX reader is ready.'; return }
$existing = $null
try {
  $existing = Invoke-RestMethod ($url+'health') -TimeoutSec 1
} catch { }
if ($existing) {
  if ($existing.reader -ne 'newarenda-python' -or $existing.service -ne 'ndax-api' -or $existing.version -ne '1.24.15' -or $existing.root -ne $root) {
    throw "Another application or older Echem server is using port $Port. Close its launcher, or run this script with a different -Port."
  }
  if (-not $NoBrowser) { Start-Process $url }
  Write-Host "Echem Plot Studio is already running at $url"
  return
}

$serverScript = Join-Path $root 'ndax_api_server.py'
$server = Start-Process -FilePath $python -ArgumentList @(('"' + $serverScript + '"'), '--port', $Port) -WorkingDirectory $root -PassThru -WindowStyle Hidden
$started = $false
for ($i=0; $i-lt 40; $i++) {
  Start-Sleep -Milliseconds 250
  try { Invoke-RestMethod ($url+'health') -TimeoutSec 1 | Out-Null; $started=$true; break } catch { }
}
if (-not $started) { if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }; throw 'The local server did not start.' }
if (-not $NoBrowser) { Start-Process $url }
Write-Host "Running at $url. Close this window to stop the server."
try { Wait-Process -Id $server.Id } finally { if (-not $server.HasExited) { Stop-Process -Id $server.Id } }
