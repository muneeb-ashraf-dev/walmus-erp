<#>
.SYNOPSIS
    Start Walmus Pharma ERP - Backend, Frontend, and PostgreSQL

.DESCRIPTION
    This script starts all required services for the Walmus Pharma ERP application.
    It checks for prerequisites and starts PostgreSQL, FastAPI backend, and Next.js frontend.

    By default it runs the optimized production frontend and skips backend reload.
    The frontend is rebuilt automatically only when the build is missing, source
    files have changed, or the backend API URL has changed. Use -Dev for live
    reloading while editing code.

.PARAMETER Dev
    Run both servers in development mode with backend and frontend live reload.

.NOTES
    Run from the project root directory: D:\WALMUS_ERP
    Requires: PostgreSQL 16+, Python 3.12+, Node.js 20+, uv
#>

param(
    [switch]$SkipDatabase,
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$NoBrowser,
    [switch]$Dev,
    [string]$BackendPort = "8000",
    [string]$FrontendPort = "3000"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent $projectRoot
$startupTimer = [System.Diagnostics.Stopwatch]::StartNew()

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Walmus Pharma ERP - Starting Services" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Project Root: $projectRoot" -ForegroundColor Gray

# Load environment variables
$envFile = Join-Path $projectRoot ".env"
if (Test-Path $envFile) {
    Write-Host "Loading environment from .env" -ForegroundColor Green
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
} else {
    Write-Warning "No .env file found. Using defaults."
}

# Function to check if a port is in use
function Test-PortInUse {
    param([int]$Port)
    $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    return $listeners.Port -contains $Port
}

# Function to wait for service
function Wait-ForService {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSeconds = 60
    )
    Write-Host "Waiting for $Name to be ready..." -NoNewline -ForegroundColor Yellow
    $start = Get-Date
    do {
        try {
            $response = Invoke-WebRequest -Uri $Url -Method Get -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                Write-Host " Ready!" -ForegroundColor Green
                return $true
            }
        } catch {
            # Not ready yet
        }
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline -ForegroundColor Yellow
    } while ((Get-Date) - $start).TotalSeconds -lt $TimeoutSeconds
    Write-Host " Timeout!" -ForegroundColor Red
    return $false
}

# Function to check if the frontend production build is missing or stale
function Test-FrontendBuildStale {
    param([string]$FrontendDir, [string]$ApiUrl)
    $buildId = Join-Path $FrontendDir ".next\BUILD_ID"
    if (-not (Test-Path $buildId)) {
        return $true
    }

    $metadataPath = Join-Path $FrontendDir ".next\api-url.txt"
    if (-not (Test-Path $metadataPath) -or (Get-Content $metadataPath -Raw).Trim() -ne $ApiUrl) {
        return $true
    }

    $buildTime = (Get-Item $buildId).LastWriteTimeUtc
    $inputs = @(
        "src",
        "package.json",
        "package-lock.json",
        "next.config.js",
        "tailwind.config.js",
        "postcss.config.js",
        "tsconfig.json"
    )

    foreach ($input in $inputs) {
        $path = Join-Path $FrontendDir $input
        if (-not (Test-Path $path)) {
            continue
        }

        if (Test-Path $path -PathType Container) {
            $newer = Get-ChildItem -Path $path -Recurse -File -ErrorAction SilentlyContinue |
                Where-Object { $_.LastWriteTimeUtc -gt $buildTime } |
                Select-Object -First 1
        } else {
            $newer = Get-Item -Path $path -ErrorAction SilentlyContinue |
                Where-Object { $_.LastWriteTimeUtc -gt $buildTime }
        }

        if ($newer) {
            return $true
        }
    }

    return $false
}

# Check prerequisites
Write-Host "`nChecking prerequisites..." -ForegroundColor Yellow

# Check PostgreSQL
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $pgService) {
    $pgService = Get-Service -Name "PostgreSQL*" -ErrorAction SilentlyContinue | Select-Object -First 1
}
if ($pgService) {
    Write-Host "PostgreSQL service found: $($pgService.Name)" -ForegroundColor Green
    if ($pgService.Status -ne 'Running') {
        Write-Host "Starting PostgreSQL..." -ForegroundColor Yellow
        Start-Service $pgService.Name
        Start-Sleep -Seconds 3
    }
} else {
    Write-Warning "PostgreSQL service not found. Please ensure PostgreSQL is installed and running."
}

# Check Python/uv
$uvPath = (Get-Command uv -ErrorAction SilentlyContinue).Source
if (-not $uvPath) {
    Write-Error "uv not found. Please install uv: pip install uv"
    exit 1
}
Write-Host "uv found: $uvPath" -ForegroundColor Green

# Check Node.js
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) {
    Write-Error "Node.js not found. Please install Node.js 20+"
    exit 1
}
Write-Host "Node.js found: $nodePath" -ForegroundColor Green

# Check npm (prefer npm.cmd so Start-Process does not try to launch npm.ps1)
$npmPath = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmPath) {
    $npmPath = (Get-Command npm -ErrorAction SilentlyContinue).Source
}
if (-not $npmPath) {
    Write-Error "npm not found"
    exit 1
}
Write-Host "npm found: $npmPath" -ForegroundColor Green

# Start services
$processes = @()

# 1. Start Backend
if (-not $SkipBackend) {
    $backendDir = Join-Path $projectRoot "backend"

    if (Test-PortInUse ([int]$BackendPort)) {
        Write-Host "`nBackend port $BackendPort is already in use; using the running backend." -ForegroundColor Yellow
    } else {
        Write-Host "`nStarting Backend (FastAPI)..." -ForegroundColor Cyan

        if (-not (Test-Path (Join-Path $backendDir ".venv"))) {
            Write-Host "Creating virtual environment..." -ForegroundColor Yellow
            Set-Location $backendDir
            & uv venv
            & uv pip install -e ".[dev]"
        }

        $pythonPath = Join-Path $backendDir ".venv\Scripts\python.exe"
        if (-not (Test-Path $pythonPath)) {
            Write-Error "Backend virtual environment not found. Run: cd backend; uv venv; uv pip install -e ."
            exit 1
        }

        $backendArgs = @(
            "-m", "uvicorn", "app.main:app",
            "--host", "127.0.0.1",
            "--port", $BackendPort
        )
        if ($Dev) {
            $backendArgs += "--reload"
        }
        $backendProcess = Start-Process -FilePath $pythonPath -ArgumentList $backendArgs -WorkingDirectory $backendDir -PassThru
        $processes += @{ Name = "Backend"; Process = $backendProcess; Port = $BackendPort }
        Write-Host "Backend started (PID: $($backendProcess.Id))" -ForegroundColor Green
    }
}

# 2. Start Frontend
if (-not $SkipFrontend) {
    $frontendDir = Join-Path $projectRoot "frontend"

    if (Test-PortInUse ([int]$FrontendPort)) {
        Write-Host "`nFrontend port $FrontendPort is already in use; using the running frontend." -ForegroundColor Yellow
    } else {
        Write-Host "`nStarting Frontend (Next.js)..." -ForegroundColor Cyan

        if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
            Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
            Set-Location $frontendDir
            & npm install
        }

        $env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:$BackendPort"

        if ($Dev) {
            $frontendProcess = Start-Process -FilePath $npmPath -ArgumentList @("run", "dev", "--", "-H", "127.0.0.1", "-p", $FrontendPort) -WorkingDirectory $frontendDir -PassThru
        } else {
            if (Test-FrontendBuildStale -FrontendDir $frontendDir -ApiUrl $env:NEXT_PUBLIC_API_URL) {
                Write-Host "Building frontend for fast page loads..." -ForegroundColor Yellow
                Push-Location $frontendDir
                try {
                    & $npmPath run build
                    if ($LASTEXITCODE -ne 0) {
                        throw "Frontend production build failed with exit code $LASTEXITCODE."
                    }
                    Set-Content -Path (Join-Path $frontendDir ".next\api-url.txt") -Value $env:NEXT_PUBLIC_API_URL -NoNewline
                } finally {
                    Pop-Location
                }
            } else {
                Write-Host "Using existing frontend production build." -ForegroundColor Green
            }

            $frontendProcess = Start-Process -FilePath $npmPath -ArgumentList @("run", "start", "--", "-H", "127.0.0.1", "-p", $FrontendPort) -WorkingDirectory $frontendDir -PassThru
        }
        $processes += @{ Name = "Frontend"; Process = $frontendProcess; Port = $FrontendPort }
        Write-Host "Frontend started (PID: $($frontendProcess.Id))" -ForegroundColor Green
    }
}

# Wait for services to be ready
Write-Host "`nWaiting for services to be ready..." -ForegroundColor Yellow

$backendReady = $true
$frontendReady = $true

if (-not $SkipBackend) {
    $backendReady = Wait-ForService "Backend" "http://127.0.0.1:$BackendPort/health"
}

if (-not $SkipFrontend) {
    $frontendReady = Wait-ForService "Frontend" "http://127.0.0.1:$FrontendPort/dashboard"
}

if (-not $backendReady) {
    Write-Warning "Backend did not become ready. Check the backend window for errors."
}
if (-not $frontendReady) {
    Write-Warning "Frontend did not become ready. Check the frontend window for errors."
}

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Walmus Pharma ERP is running!" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Backend API:  http://127.0.0.1:$BackendPort" -ForegroundColor Green
Write-Host "API Docs:     http://127.0.0.1:$BackendPort/docs" -ForegroundColor Green
Write-Host "Frontend:     http://127.0.0.1:$FrontendPort" -ForegroundColor Green
Write-Host ("Startup time: {0:N1}s" -f $startupTimer.Elapsed.TotalSeconds) -ForegroundColor Gray

if ($NoBrowser) {
    Write-Host "`nBrowser launch skipped (-NoBrowser)." -ForegroundColor Yellow
} else {
    Write-Host "`nOpening application in default web browser..." -ForegroundColor Cyan
    Start-Process "http://127.0.0.1:$FrontendPort"
}

Write-Host "`nPress Ctrl+C to stop all services..." -ForegroundColor Yellow

# Keep script running and handle cleanup
try {
    while ($true) {
        Start-Sleep -Seconds 5
        # Check if processes are still alive
        foreach ($proc in $processes) {
            if ($proc.Process.HasExited) {
                Write-Warning "`n$($proc.Name) process has exited unexpectedly!"
            }
        }
    }
} catch {
    Write-Host "`nShutting down..." -ForegroundColor Yellow
} finally {
    # Cleanup
    foreach ($proc in $processes) {
        if (-not $proc.Process.HasExited) {
            Write-Host "Stopping $($proc.Name)..." -ForegroundColor Yellow
            Stop-Process -Id $proc.Process.Id -Force -ErrorAction SilentlyContinue
        }
    }

    Write-Host "All services stopped." -ForegroundColor Green
}