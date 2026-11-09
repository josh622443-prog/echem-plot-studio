$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object Windows.Forms.Form
$form.Text = 'Echem Excel Converter v1.1.0'
$form.ClientSize = New-Object Drawing.Size(700, 440)
$form.MinimumSize = New-Object Drawing.Size(650, 400)
$form.StartPosition = 'CenterScreen'
$form.Font = New-Object Drawing.Font('Segoe UI', 10)
$layout = New-Object Windows.Forms.TableLayoutPanel
$layout.Dock = 'Fill'
$layout.Padding = New-Object Windows.Forms.Padding(14)
$layout.ColumnCount = 1
foreach ($height in @(95, 42, 40)) {
    [void]$layout.RowStyles.Add((New-Object Windows.Forms.RowStyle('Absolute', $height)))
}
[void]$layout.RowStyles.Add((New-Object Windows.Forms.RowStyle('Percent', 100)))
$form.Controls.Add($layout)

$drop = New-Object Windows.Forms.Label
$drop.Dock = 'Fill'
$drop.BorderStyle = 'FixedSingle'
$drop.BackColor = [Drawing.Color]::FromArgb(228, 242, 239)
$drop.TextAlign = 'MiddleCenter'
$drop.Text = 'Drop .xlsx files here to convert'
$drop.AllowDrop = $true
$layout.Controls.Add($drop, 0, 0)
$actions = New-Object Windows.Forms.FlowLayoutPanel
$actions.Dock = 'Fill'
$actions.WrapContents = $false
$layout.Controls.Add($actions, 0, 1)
function Add-Action([string]$text) {
    $button = New-Object Windows.Forms.Button
    $button.Text = $text
    $button.AutoSize = $true
    $button.Height = 32
    $actions.Controls.Add($button)
    return $button
}
$pick = Add-Action 'Choose files'
$watch = Add-Action 'Watch folder hourly'
$scan = Add-Action 'Scan now'
$stop = Add-Action 'Stop watching'
$scan.Enabled = $false
$stop.Enabled = $false
$status = New-Object Windows.Forms.Label
$status.Dock = 'Fill'
$status.AutoEllipsis = $true
$status.TextAlign = 'MiddleLeft'
$status.Text = 'Folder watch is off.'
$layout.Controls.Add($status, 0, 2)
$log = New-Object Windows.Forms.TextBox
$log.Multiline = $true
$log.ReadOnly = $true
$log.WordWrap = $false
$log.ScrollBars = 'Both'
$log.Dock = 'Fill'
$layout.Controls.Add($log, 0, 3)
function Write-Log([string]$message) {
    $log.AppendText($message.TrimEnd() + [Environment]::NewLine)
}
Write-Log 'Output is saved next to each source workbook.'

$runtime = Join-Path $PSScriptRoot '.runtime'
$stateFile = Join-Path $runtime 'watch-state.json'
$processed = @{}
if (Test-Path -LiteralPath $stateFile) {
    try {
        $state = Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($item in $state.PSObject.Properties) { $processed[$item.Name] = $item.Value }
    } catch { Write-Log "Could not read conversion history: $_" }
}
function Save-State {
    try {
        New-Item -ItemType Directory -Path $runtime -Force | Out-Null
        $temp = Join-Path $runtime ('watch-' + [Guid]::NewGuid().ToString('N') + '.tmp')
        [IO.File]::WriteAllText($temp, (ConvertTo-Json -InputObject $processed -Depth 4 -Compress))
        if ([IO.File]::Exists($stateFile)) { [IO.File]::Replace($temp, $stateFile, [System.Management.Automation.Language.NullString]::Value) }
        else { [IO.File]::Move($temp, $stateFile) }
    } catch { Write-Log "Could not save conversion history: $_" }
}
$queue = New-Object 'System.Collections.Generic.Queue[object]'
$pending = @{}
$script:folder = $null
$script:active = $null

function Add-Workbook([string]$path, [bool]$automatic) {
    try {
        $file = Get-Item -LiteralPath $path
        if ($file.PSIsContainer -or $file.Extension -ine '.xlsx' -or
            $file.Name -match '^~\$|_Echem(?: \(\d+\))?\.xlsx$') {
            if (!$automatic) { Write-Log "Skipped: $path (choose an original .xlsx file)." }
            return
        }
        $key = $file.FullName
        $stamp = '{0}:{1}' -f $file.Length, $file.LastWriteTimeUtc.Ticks
        if ($pending.ContainsKey($key)) { return }
        if ($automatic -and $processed.ContainsKey($key)) {
            $prior = $processed[$key]
            if ($prior.stamp -eq $stamp -and (Test-Path -LiteralPath $prior.output -PathType Leaf)) { return }
        }
        $pending[$key] = $true
        $queue.Enqueue([pscustomobject]@{ Path = $key; Stamp = $stamp })
    } catch { Write-Log "Skipped '$path': $_" }
}
function Scan-Folder {
    if (!$script:folder) { return }
    try {
        $before = $queue.Count
        foreach ($file in Get-ChildItem -LiteralPath $script:folder -Filter '*.xlsx' -File) {
            Add-Workbook $file.FullName $true
        }
        Write-Log ("[{0:T}] Folder scan: {1} workbook(s) queued." -f [DateTime]::Now, ($queue.Count - $before))
    } catch { Write-Log "Folder scan failed: $_" }
}
function Start-Next {
    if ($script:active -or !$queue.Count) { return }
    $job = $queue.Dequeue()
    try {
        $info = New-Object Diagnostics.ProcessStartInfo
        $launcher = Get-Command py.exe -ErrorAction SilentlyContinue
        $prefix = ''
        if ($env:ECHEM_PYTHON) { $info.FileName = $env:ECHEM_PYTHON }
        elseif ($launcher) { $info.FileName = $launcher.Source; $prefix = '-3 ' }
        else {
            $info.FileName = 'python.exe'
            foreach ($version in @('314','313','312','311','310','39')) {
                $candidate = Join-Path $env:LOCALAPPDATA "Programs\Python\Python$version\python.exe"
                if (Test-Path -LiteralPath $candidate) { $info.FileName = $candidate; break }
            }
        }
        $info.Arguments = $prefix + ('"{0}" --unattended "{1}"' -f (Join-Path $PSScriptRoot 'convert_excel.py'), $job.Path)
        $info.UseShellExecute = $false
        $info.CreateNoWindow = $true
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        $info.StandardOutputEncoding = [Text.Encoding]::UTF8
        $info.StandardErrorEncoding = [Text.Encoding]::UTF8
        $info.EnvironmentVariables['PYTHONUTF8'] = '1'
        $process = [Diagnostics.Process]::Start($info)
        $script:active = [pscustomobject]@{
            Job = $job; Process = $process
            Out = $process.StandardOutput.ReadToEndAsync()
            Err = $process.StandardError.ReadToEndAsync()
        }
        Write-Log "Converting: $($job.Path)"
    } catch {
        $pending.Remove($job.Path)
        Write-Log "Could not start Python: $_"
    }
}
$poll = New-Object Windows.Forms.Timer
$poll.Interval = 250
$poll.Add_Tick({
    $task = $script:active
    if ($task -and $task.Process.HasExited -and $task.Out.IsCompleted -and $task.Err.IsCompleted) {
        try {
            $output = $task.Out.Result.TrimEnd()
            if ($output) { Write-Log $output }
            if ($task.Err.Result.Trim()) { Write-Log $task.Err.Result }
            if ($task.Process.ExitCode -eq 0 -and $output) {
                $outputFile = ($output -split '\r?\n')[-1]
                if (Test-Path -LiteralPath $outputFile -PathType Leaf) {
                    $processed[$task.Job.Path] = @{ stamp = $task.Job.Stamp; output = $outputFile }
                    Save-State
                }
            }
        } catch { Write-Log "Could not read conversion result: $_" }
        finally {
            $pending.Remove($task.Job.Path)
            $task.Process.Dispose()
            $script:active = $null
        }
    }
    Start-Next
})
$hour = New-Object Windows.Forms.Timer
$hour.Interval = 3600000
$hour.Add_Tick({ Scan-Folder })
$pick.Add_Click({
    $dialog = New-Object Windows.Forms.OpenFileDialog
    try {
        $dialog.Filter = 'Excel workbooks (*.xlsx)|*.xlsx'
        $dialog.Multiselect = $true
        if ($dialog.ShowDialog($form) -eq 'OK') {
            foreach ($name in $dialog.FileNames) { Add-Workbook $name $false }
        }
    } finally { $dialog.Dispose() }
})
$drop.Add_DragEnter({
    param($sender, $eventArgs)
    if ($eventArgs.Data.GetDataPresent([Windows.Forms.DataFormats]::FileDrop)) {
        $eventArgs.Effect = [Windows.Forms.DragDropEffects]::Copy
    }
})
$drop.Add_DragDrop({
    param($sender, $eventArgs)
    if ($eventArgs.Data.GetDataPresent([Windows.Forms.DataFormats]::FileDrop)) {
        foreach ($name in $eventArgs.Data.GetData([Windows.Forms.DataFormats]::FileDrop)) {
            Add-Workbook $name $false
        }
    }
})
$watch.Add_Click({
    $dialog = New-Object Windows.Forms.FolderBrowserDialog
    try {
        $dialog.Description = 'Select a folder to check now and once per hour.'
        if ($dialog.ShowDialog($form) -eq 'OK') {
            $script:folder = $dialog.SelectedPath
            $status.Text = "Watching hourly while open: $script:folder"
            $scan.Enabled = $true
            $stop.Enabled = $true
            Scan-Folder
            $hour.Stop()
            $hour.Start()
        }
    } finally { $dialog.Dispose() }
})
$scan.Add_Click({ Scan-Folder })
$stop.Add_Click({
    $hour.Stop()
    $script:folder = $null
    $status.Text = 'Folder watch is off. Queued conversions will finish.'
    $scan.Enabled = $false
    $stop.Enabled = $false
})
$form.Add_FormClosing({
    param($sender, $eventArgs)
    if ($script:active -or $queue.Count) {
        $eventArgs.Cancel = $true
        Write-Log 'Wait for the conversion queue to finish before closing.'
    }
})
$poll.Start()
try { [void]$form.ShowDialog() }
finally { $poll.Dispose(); $hour.Dispose(); $form.Dispose() }
