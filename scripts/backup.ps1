<#>
.SYNOPSIS
    Backup Walmus Pharma ERP PostgreSQL database

.DESCRIPTION
    This script creates a backup of the PostgreSQL database using pg_dump.
    It supports compression, encryption, and retention policies.

.PARAMETER BackupDir
    Directory to store backups (default: from .env or D:\pharma-erp-backups)

.PARAMETER RetainDays
    Number of days to retain backups (default: 30)

.PARAMETER Compress
    Compress backup with gzip (default: $true)

.PARAMETER Encrypt
    Encrypt backup with GPG (requires gpg installed)

.PARAMETER Verify
    Verify backup after creation (default: $true)

.NOTES
    Run from the project root directory or specify full paths.
    Requires pg_dump in PATH (PostgreSQL client tools).
#>

param(
    [string]$BackupDir = "",
    [int]$RetainDays = 30,
    [switch]$Compress = $true,
    [switch]$Encrypt,
    [switch]$Verify = $true
)

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Walmus Pharma ERP - Database Backup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Load environment variables
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent $projectRoot
$envFile = Join-Path $projectRoot ".env"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# Set defaults from environment
if (-not $BackupDir) {
    $BackupDir = $env:BACKUP_DIR
    if (-not $BackupDir) {
        $BackupDir = "D:\pharma-erp-backups"
    }
}
if (-not $RetainDays) {
    $RetainDays = [int]($env:BACKUP_RETENTION_DAYS ?? 30)
}

$DB_HOST = $env:POSTGRES_HOST ?? "localhost"
$DB_PORT = $env:POSTGRES_PORT ?? "5432"
$DB_NAME = $env:POSTGRES_DB ?? "pharma_erp"
$DB_USER = $env:POSTGRES_USER ?? "pharma_user"
$DB_PASS = $env:POSTGRES_PASSWORD ?? ""

Write-Host "Database: $DB_NAME on $DB_HOST:$DB_PORT" -ForegroundColor Gray
Write-Host "Backup directory: $BackupDir" -ForegroundColor Gray
Write-Host "Retention: $RetainDays days" -ForegroundColor Gray

# Check pg_dump
$pgDumpPath = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
if (-not $pgDumpPath) {
    Write-Error "pg_dump not found in PATH. Please install PostgreSQL client tools."
    exit 1
}
Write-Host "pg_dump found: $pgDumpPath" -ForegroundColor Green

# Create backup directory
if (-not (Test-Path $BackupDir)) {
    Write-Host "Creating backup directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

# Generate backup filename
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "pharma_erp_${timestamp}.sql"
if ($Compress) {
    $backupFile += ".gz"
}

Write-Host "`nStarting backup..." -ForegroundColor Cyan
Write-Host "Output: $backupFile" -ForegroundColor Gray

# Set PGPASSWORD for pg_dump
if ($DB_PASS) {
    $env:PGPASSWORD = $DB_PASS
}

# Run pg_dump
$pgDumpArgs = @(
    "-h", $DB_HOST
    "-p", $DB_PORT
    "-U", $DB_USER
    "-d", $DB_NAME
    "--verbose"
    "--no-password"
    "--format=custom"
    "--compress=9"
    "--file", $backupFile
)

try {
    $startTime = Get-Date
    Write-Host "Running pg_dump..." -ForegroundColor Yellow
    
    $process = Start-Process -FilePath $pgDumpPath -ArgumentList $pgDumpArgs -Wait -PassThru -NoNewWindow
    
    if ($process.ExitCode -ne 0) {
        throw "pg_dump failed with exit code $($process.ExitCode)"
    }
    
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    # Get file size
    $fileSize = (Get-Item $backupFile).Length
    $sizeMB = [math]::Round($fileSize / 1MB, 2)
    
    Write-Host "`nBackup completed successfully!" -ForegroundColor Green
    Write-Host "Duration: $($duration.TotalSeconds) seconds" -ForegroundColor Gray
    Write-Host "Size: $sizeMB MB" -ForegroundColor Gray
    
    # Verify backup
    if ($Verify) {
        Write-Host "`nVerifying backup..." -ForegroundColor Yellow
        $pgRestorePath = (Get-Command pg_restore -ErrorAction SilentlyContinue).Source
        if ($pgRestorePath) {
            $verifyArgs = @(
                "--list"
                "--file", $backupFile
            )
            $verifyProcess = Start-Process -FilePath $pgRestorePath -ArgumentList $verifyArgs -Wait -PassThru -NoNewWindow
            if ($verifyProcess.ExitCode -eq 0) {
                Write-Host "Backup verification passed!" -ForegroundColor Green
            } else {
                Write-Warning "Backup verification failed - backup may be corrupted"
            }
        } else {
            Write-Warning "pg_restore not found, skipping verification"
        }
    }
    
    # Encrypt if requested
    if ($Encrypt) {
        Write-Host "`nEncrypting backup..." -ForegroundColor Yellow
        $gpgPath = (Get-Command gpg -ErrorAction SilentlyContinue).Source
        if ($gpgPath) {
            $encryptedFile = $backupFile + ".gpg"
            $gpgArgs = @(
                "--symmetric"
                "--cipher-algo", "AES256"
                "--output", $encryptedFile
                $backupFile
            )
            $gpgProcess = Start-Process -FilePath $gpgPath -ArgumentList $gpgArgs -Wait -PassThru -NoNewWindow
            if ($gpgProcess.ExitCode -eq 0) {
                Remove-Item $backupFile -Force
                $backupFile = $encryptedFile
                Write-Host "Backup encrypted: $encryptedFile" -ForegroundColor Green
            } else {
                Write-Warning "Encryption failed"
            }
        } else {
            Write-Warning "gpg not found, skipping encryption"
        }
    }
    
    # Cleanup old backups
    Write-Host "`nCleaning up old backups (older than $RetainDays days)..." -ForegroundColor Yellow
    $cutoffDate = (Get-Date).AddDays(-$RetainDays)
    $oldBackups = Get-ChildItem -Path $BackupDir -Filter "pharma_erp_*.sql*" | Where-Object { $_.LastWriteTime -lt $cutoffDate }
    foreach ($oldBackup in $oldBackups) {
        Write-Host "Removing: $($oldBackup.Name)" -ForegroundColor Gray
        Remove-Item $oldBackup.FullName -Force
    }
    
    Write-Host "`n=========================================" -ForegroundColor Cyan
    Write-Host "  Backup completed successfully!" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "Backup file: $backupFile" -ForegroundColor Green
    
} catch {
    Write-Error "Backup failed: $_"
    if (Test-Path $backupFile) {
        Remove-Item $backupFile -Force -ErrorAction SilentlyContinue
    }
    exit 1
} finally {
    # Clear password from environment
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}