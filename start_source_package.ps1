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
  foreach ($path in ($candidates | Select-Object -Unique)) {
    if (-not (Test-Path -LiteralPath $path) -or $path -like '*\Microsoft\WindowsApps\*') { continue }
    try {
      $version = & $path -c 'import sys; print(sys.version_info[0] * 100 + sys.version_info[1])' 2>$null
      if ([int]$version -ge 307) { return (Resolve-Path -LiteralPath $path).Path }
    } catch { }
  }
  throw 'Python 3.7 or newer was not found. Install Python 3 from python.org, then run this launcher again.'
}

function Test-Btsda([string]$path) {
  if (-not $path) { return $false }
  foreach ($library in @('BTSDALib.dll','Common.dll','CommonCtrl.dll','Newtonsoft.Json.dll')) {
    if (-not (Test-Path -LiteralPath (Join-Path $path $library))) { return $false }
  }
  return $true
}

function Find-Btsda {
  $settingsDir = Join-Path $env:LOCALAPPDATA 'EchemPlotStudio'
  $settingsFile = Join-Path $settingsDir 'btsda-directory.txt'
  $candidates = @($env:NEWARE_BTSDA_DIR)
  if (Test-Path -LiteralPath $settingsFile) { $candidates += (Get-Content -LiteralPath $settingsFile -Raw).Trim() }
  if (${env:ProgramFiles(x86)}) { $candidates += Join-Path ${env:ProgramFiles(x86)} 'NEWARE\BTSClient80' }
  if ($env:ProgramFiles) { $candidates += Join-Path $env:ProgramFiles 'NEWARE\BTSClient80' }
  foreach ($drive in @('C','D','E')) {
    $candidates += "${drive}:\NEWARE\BTSClient80"
    $candidates += "${drive}:\Program Files\NEWARE\BTSClient80"
    $candidates += "${drive}:\Program Files (x86)\NEWARE\BTSClient80"
  }
  foreach ($path in $candidates) { if (Test-Btsda $path) { return $path } }

  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show('Select the NEWARE BTSClient/BTSDA folder containing BTSDALib.dll and Common.dll.','Locate BTSDA') | Out-Null
  while ($true) {
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = 'Select the NEWARE BTSClient/BTSDA folder'
    $dialog.ShowNewFolderButton = $false
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { throw 'BTSDA folder selection was cancelled.' }
    if (Test-Btsda $dialog.SelectedPath) {
      New-Item -ItemType Directory -Path $settingsDir -Force | Out-Null
      Set-Content -LiteralPath $settingsFile -Value $dialog.SelectedPath -Encoding UTF8
      return $dialog.SelectedPath
    }
    if ([System.Windows.Forms.MessageBox]::Show('That folder does not contain the required BTSDA libraries. Try again?','Invalid BTSDA folder','RetryCancel','Warning') -ne 'Retry') { throw 'A valid BTSDA folder was not selected.' }
  }
}

function Find-Compiler {
  $candidates = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
  )
  foreach ($path in $candidates) { if (Test-Path -LiteralPath $path) { return $path } }
  throw 'The Windows .NET Framework C# compiler was not found. Enable/install .NET Framework 4.x and try again.'
}

Write-Stage 'Checking Python...'
$python = Find-Python
Write-Stage "Python: $python"
Write-Stage 'Checking NEWARE BTSDA...'
$btsda = Find-Btsda
Write-Stage "BTSDA: $btsda"
Write-Stage 'Checking the Windows .NET compiler...'
$compiler = Find-Compiler
Write-Stage "Compiler: $compiler"
$runtimeDir = Join-Path $root '.runtime'
$extractor = Join-Path $runtimeDir 'NdaxJsonExtractor.exe'
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$source = Join-Path $root 'NdaxJsonExtractor.cs'

if (-not (Test-Path $extractor) -or (Get-Item $source).LastWriteTimeUtc -gt (Get-Item $extractor).LastWriteTimeUtc) {
  Write-Stage 'Building the local NDAX reader from source...'
  $refs = @('Common.dll','CommonCtrl.dll','BTSDALib.dll','Newtonsoft.Json.dll') | ForEach-Object { '/r:' + (Join-Path $btsda $_) }
  $args = @('/nologo','/optimize+','/target:exe',('/out:'+$extractor)) + $refs + @('/r:System.IO.Compression.dll','/r:System.IO.Compression.FileSystem.dll','/r:Microsoft.CSharp.dll',$source)
  & $compiler $args
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $extractor)) { throw 'The local NDAX reader could not be compiled.' }
}

$env:NEWARE_BTSDA_DIR = $btsda
$env:ECHEM_EXTRACTOR = $extractor
$url = "http://127.0.0.1:$Port/"
if ($CheckOnly) { Write-Stage 'NDAX prerequisites and reader compilation passed.'; return }
$existing = $null
try {
  $existing = Invoke-RestMethod ($url+'health') -TimeoutSec 1
} catch { }
if ($existing) {
  if ($existing.service -ne 'ndax-api' -or $existing.version -ne '1.24.15' -or $existing.root -ne $root) {
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
