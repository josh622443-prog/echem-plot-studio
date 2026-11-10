param()
$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$downloadFolder = Join-Path $packageRoot 'downloads'
New-Item -ItemType Directory -Path $downloadFolder -Force | Out-Null
# Explicit allowlist: never include local data, dependencies or machine settings.
$runtimeFiles = @(
  'index.html', 'Echem_Plot_Studio_v1.27.12.html', 'data-copy.js',
  'Start Echem Plot Studio.cmd', 'start_source_package.ps1',
  'runtime_packages.py', 'requirements_ndax_reader.txt', 'ndax_reader.py', 'mpr_reader.py', 'ndax_api_server.py', 'requirements_ndax.txt',
  'origin_export.py', 'README-FIRST.txt', 'LICENSE',
  'THIRD-PARTY-NOTICES.md', 'CITATION.cff'
)
$filePaths = foreach ($fileName in $runtimeFiles) {
  $filePath = Join-Path $packageRoot $fileName
  if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) { throw "Missing runtime file: $fileName" }
  $filePath
}
if ((Get-FileHash -LiteralPath (Join-Path $packageRoot 'index.html')).Hash -ne
    (Get-FileHash -LiteralPath (Join-Path $packageRoot 'Echem_Plot_Studio_v1.27.12.html')).Hash) {
  throw 'Current HTML and index.html differ.'
}
$zipPath = Join-Path $downloadFolder 'Echem-Plot-Studio-v1.27.12-Windows.zip'
Compress-Archive -LiteralPath $filePaths -DestinationPath $zipPath -Force
Write-Host "Created $zipPath"
