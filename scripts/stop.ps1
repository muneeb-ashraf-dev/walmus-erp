<#>
.SYNOPSIS
    Stop Walmus Pharma ERP services

.DESCRIPTION
    This script stops all running services for the Walmus Pharma ERP application.
    It finds and terminates the backend and frontend processes.
#>

param(
    [switch]$Force,
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Continue"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Walmus Pharma ERP - Stopping Services" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

function Stop-ProcessTree {
    param([int]$ProcessId)

    if (-not $ProcessId -or $ProcessId -eq $PID) {
        return
    }

    & taskkill.exe /PID $ProcessId /T /F *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Stopped (PID: $ProcessId)" -ForegroundColor Green
    } else {
        Write-Warning "  Could not stop PID $ProcessId"
    }
}

# Stop whatever is listening on the application ports first. This also catches
# the child process created by uvicorn --reload, which may outlive its parent.
foreach ($port in @($BackendPort, $FrontendPort) | Select-Object -Unique) {
    try {
        $listeners = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Stop
    } catch {
        $listeners = @()
    }

    foreach ($listener in $listeners) {
        $listenerPid = [int]$listener.OwningProcess
        if ($listenerPid -le 0 -or $listenerPid -eq $PID) {
            continue
        }

        Write-Host "Stopping process on port $port (PID: $listenerPid)..." -ForegroundColor Yellow
        $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $listenerPid" -ErrorAction SilentlyContinue
        foreach ($child in $children) {
            Stop-ProcessTree $child.ProcessId
        }
        Stop-ProcessTree $listenerPid
    }
}

# Find and stop uvicorn processes
$uvicornProcesses = Get-Process -Name "uvicorn" -ErrorAction SilentlyContinue
if ($uvicornProcesses) {
    foreach ($proc in $uvicornProcesses) {
        Write-Host "Stopping uvicorn (PID: $($proc.Id))..." -ForegroundColor Yellow
        try {
            Stop-ProcessTree $proc.Id
        } catch {
            Write-Warning "  Failed to stop: $_"
        }
    }
} else {
    Write-Host "No uvicorn processes found" -ForegroundColor Gray
}

# Find and stop npm/node processes for frontend
$npmProcesses = Get-Process -Name "npm" -ErrorAction SilentlyContinue
if ($npmProcesses) {
    foreach ($proc in $npmProcesses) {
        # Check if it's our frontend process
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
        if ($cmdLine -like "*next*" -or $cmdLine -like "*frontend*") {
            Write-Host "Stopping npm frontend (PID: $($proc.Id))..." -ForegroundColor Yellow
            try {
                Stop-ProcessTree $proc.Id
            } catch {
                Write-Warning "  Failed to stop: $_"
            }
        }
    }
}

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
        if ($cmdLine -like "*next*" -or $cmdLine -like "*frontend*" -or $cmdLine -like "*webpack*") {
            Write-Host "Stopping node frontend (PID: $($proc.Id))..." -ForegroundColor Yellow
            try {
                Stop-ProcessTree $proc.Id
            } catch {
                Write-Warning "  Failed to stop: $_"
            }
        }
    }
}

# Also check for any Python processes running our backend
$pythonProcesses = Get-Process -Name "python" -ErrorAction SilentlyContinue
if ($pythonProcesses) {
    foreach ($proc in $pythonProcesses) {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
        if ($cmdLine -like "*uvicorn*" -or $cmdLine -like "*app.main*") {
            Write-Host "Stopping python backend (PID: $($proc.Id))..." -ForegroundColor Yellow
            try {
                Stop-ProcessTree $proc.Id
            } catch {
                Write-Warning "  Failed to stop: $_"
            }
        }
    }
}

Write-Host "`nAll Walmus Pharma ERP services stopped." -ForegroundColor Green