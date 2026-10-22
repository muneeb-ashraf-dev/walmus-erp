# Backup and Restore Guide

## Overview

The production database is intended to run on **Supabase** (managed PostgreSQL). The long-term backup requirement is a **manual Supabase backup** performed by the owner from the Supabase Dashboard or with `pg_dump` against the Supabase connection string.

> **Implementation status: deferred.** The in-application Supabase backup/restore workflow is not implemented in the current increment. This document defines the intended procedure. The existing local `pg_dump`/`pg_restore` scripts remain available only as an interim fallback while the application runs against a local PostgreSQL instance.

## Supabase Manual Backup (Planned Primary Method)

### Option A — Supabase Dashboard

1. Open the Supabase project → **Database** → **Backups**.
2. Confirm the most recent automated backup is available, or trigger a manual backup if the plan supports it.
3. Download the backup artifact to a secure location outside the project.
4. Record the backup timestamp and the application migration revision (`alembic current`).

### Option B — `pg_dump` against Supabase

Use the **session-mode** connection string (port `5432`) and the database password from the Supabase project settings.

```powershell
$env:PGPASSWORD = "<supabase-db-password>"

pg_dump `
  -h db.<project-ref>.supabase.co `
  -p 5432 `
  -U postgres `
  -d postgres `
  -Fc -Z 9 `
  -f "D:\walmus-backups\walmus_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
```

Verify the archive:

```powershell
pg_restore --list "D:\walmus-backups\walmus_YYYYMMDD_HHMMSS.dump"
```

### Supabase Restore Verification

1. Create a **separate test Supabase project** (never restore over production first).
2. Restore with `pg_restore` using the test project's session-mode connection string.
3. Run `alembic upgrade head` against the test project.
4. Verify row counts for `medicine`, `medicine_batch`, `sales_invoice`, `purchase_invoice`, `imported_sales_history`, and `imported_month_summary`.
5. Start the application against the test project and verify dashboard, reports, and exports.
6. Only after verification, schedule a maintenance window for production restore.

### Interim Application Export

Independently of database backups, use **Import & Export → Export** or `GET /api/reports/export` to download XLSX/CSV copies of business data. These exports are convenient for reconciliation and offsite storage, but they are **not** a substitute for a full database backup.

## Local Backup Strategy (Interim Fallback)

The remainder of this guide describes the local PostgreSQL scripts. These are useful for development and as a temporary fallback, but they are not the long-term Supabase backup mechanism.

### What Gets Backed Up

- **Full database dump** (custom format) including:
  - All tables, indexes, constraints
  - Views, functions, triggers
  - Sequences, enum types
  - Data in all tables

### What's NOT Backed Up

- Application code (in git)
- Uploaded files/attachments (separate backup needed)
- Configuration files (.env - keep in secure location)

## Backup Methods

### Method 1: Automated Script (Recommended)

```powershell
# Run from project root
cd D:\WALMUS_ERP
.\scripts\backup.ps1
```

Options:
```powershell
# Custom backup directory
.\scripts\backup.ps1 -BackupDir "E:\Backups"

# Without compression
.\scripts\backup.ps1 -Compress:$false

# With encryption (requires GPG)
.\scripts\backup.ps1 -Encrypt

# Without verification (faster)
.\scripts\backup.ps1 -Verify:$false
```

### Method 2: Manual pg_dump

```powershell
# Set password
$env:PGPASSWORD = "your_password"

# Custom format (recommended)
pg_dump -h localhost -p 5432 -U pharma_user -d pharma_erp -Fc -Z 9 -f "D:\backups\pharma_erp_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"

# SQL format (human readable)
pg_dump -h localhost -p 5432 -U pharma_user -d pharma_erp --no-owner --no-privileges -f "D:\backups\pharma_erp_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
```

### Method 3: pgAdmin GUI

1. Open pgAdmin 4
2. Right-click database `pharma_erp` → **Backup**
3. Configure:
   - Format: **Custom** (for pg_restore) or **Plain** (SQL)
   - Compression: **9** (maximum)
   - Filename: Choose location
4. Click **Backup**

## Backup Schedule

### Recommended Schedule

| Frequency | Retention | Purpose |
|-----------|-----------|---------|
| Daily (2 AM) | 30 days | Point-in-time recovery |
| Weekly (Sunday 3 AM) | 12 weeks | Weekly snapshots |
| Monthly (1st of month 4 AM) | 12 months | Monthly archives |
| Before major changes | Until verified | Pre-deployment safety |

### Windows Task Scheduler Setup

1. Open **Task Scheduler**
2. **Create Basic Task** → Name: "Pharma ERP Daily Backup"
3. Trigger: **Daily** at 2:00 AM
4. Action: **Start a Program**
   - Program: `powershell.exe`
   - Arguments: `-ExecutionPolicy Bypass -File "D:\WALMUS_ERP\scripts\backup.ps1"`
   - Start in: `D:\WALMUS_ERP`
5. Finish

## Backup Verification

### Automated Verification (Built-in)

The backup script automatically verifies using `pg_restore --list`:

```powershell
pg_restore --list "D:\backups\pharma_erp_20240115_020000.dump"
```

Success = exit code 0, lists all objects in backup.

### Manual Verification

```powershell
# Test restore to temporary database
createdb -h localhost -p 5432 -U postgres pharma_erp_test
pg_restore -h localhost -p 5432 -U postgres -d pharma_erp_test "D:\backups\pharma_erp_20240115_020000.dump"

# Verify row counts
psql -h localhost -p 5432 -U postgres -d pharma_erp_test -c "SELECT COUNT(*) FROM medicine;"
psql -h localhost -p 5432 -U postgres -d pharma_erp_test -c "SELECT COUNT(*) FROM sales_invoice;"

# Cleanup
dropdb -h localhost -p 5432 -U postgres pharma_erp_test
```

## Restore Procedures

### ⚠️ CRITICAL: Read Before Restoring

- **Restoring overwrites ALL data** in the target database
- **Test restore first** on a separate database
- **Backup current database** before restoring
- **Stop application** before restore

### Restore to Production (Disaster Recovery)

```powershell
# 1. Stop application
.\scripts\stop.ps1

# 2. Backup current database (safety)
$env:PGPASSWORD = "current_password"
pg_dump -h localhost -p 5432 -U pharma_user -d pharma_erp -Fc -f "D:\backups\pre_restore_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"

# 3. Drop and recreate database
psql -h localhost -p 5432 -U postgres -c "DROP DATABASE pharma_erp;"
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE pharma_erp OWNER pharma_user;"
psql -h localhost -p 5432 -U postgres -c "GRANT ALL ON SCHEMA public TO pharma_user;"

# 4. Restore from backup
$env:PGPASSWORD = "your_password"
pg_restore -h localhost -p 5432 -U pharma_user -d pharma_erp -v "D:\backups\pharma_erp_20240115_020000.dump"

# 5. Run migrations (if schema changed)
cd D:\WALMUS_ERP\backend
uv run alembic upgrade head

# 6. Restart application
.\scripts\start.ps1
```

### Restore to Test Database (Verification)

```powershell
# Create test database
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE pharma_erp_restore_test OWNER pharma_user;"

# Restore
$env:PGPASSWORD = "your_password"
pg_restore -h localhost -p 5432 -U pharma_user -d pharma_erp_restore_test -v "D:\backups\pharma_erp_20240115_020000.dump"

# Verify
psql -h localhost -p 5432 -U postgres -d pharma_erp_restore_test -c "
SELECT 'medicine' as table_name, COUNT(*) FROM medicine
UNION ALL SELECT 'batch', COUNT(*) FROM medicine_batch
UNION ALL SELECT 'sales', COUNT(*) FROM sales_invoice
UNION ALL SELECT 'purchase', COUNT(*) FROM purchase_invoice;
"

# Cleanup
psql -h localhost -p 5432 -U postgres -c "DROP DATABASE pharma_erp_restore_test;"
```

### Point-in-Time Recovery (PITR)

If using PostgreSQL WAL archiving:

```powershell
# 1. Stop PostgreSQL
Stop-Service postgresql-x64-16

# 2. Restore base backup
# Copy base backup to data directory

# 3. Create recovery.signal and restore_command
# In postgresql.conf:
# restore_command = 'copy "D:\pg_archive\%f" "%p"'
# recovery_target_time = '2024-01-15 14:30:00'

# 4. Start PostgreSQL
Start-Service postgresql-x64-16

# 5. Check logs for recovery completion
```

## Backup Storage

### Local Storage

- **Primary**: `D:\pharma-erp-backups\` (fast SSD)
- **Secondary**: External USB drive (rotated weekly)
- **Offsite**: Cloud storage (OneDrive, Google Drive, AWS S3)

### Recommended Structure

```
D:\pharma-erp-backups\
├── daily\
│   ├── pharma_erp_20240115_020000.dump
│   └── ...
├── weekly\
│   ├── pharma_erp_20240114_weekly.dump
│   └── ...
├── monthly\
│   └── pharma_erp_202401_monthly.dump
└── pre_deploy\
    └── pharma_erp_20240115_pre_v1.2.dump
```

### Cloud Backup (AWS S3 Example)

```powershell
# Install AWS CLI
# Configure: aws configure

# Sync to S3
aws s3 sync D:\pharma-erp-backups s3://your-bucket/pharma-erp-backups/ --storage-class STANDARD_IA
```

## Retention Policy

| Tier | Frequency | Retain | Location |
|------|-----------|--------|----------|
| Daily | 2:00 AM | 30 days | Local SSD |
| Weekly | Sunday 3 AM | 12 weeks | Local + External |
| Monthly | 1st 4 AM | 12 months | Local + Cloud |
| Pre-deploy | Manual | Until next deploy | Local |

### Automated Cleanup

The backup script automatically removes backups older than retention period:

```powershell
# Keep last 30 days
$cutoffDate = (Get-Date).AddDays(-30)
Get-ChildItem D:\pharma-erp-backups\daily -Filter "*.dump" | Where-Object { $_.LastWriteTime -lt $cutoffDate } | Remove-Item
```

## Disaster Recovery Checklist

### Before Incident
- [ ] Backup script tested and working
- [ ] Restore procedure tested quarterly
- [ ] Backup location accessible
- [ ] Retention policy configured
- [ ] Monitoring alerts for backup failures

### During Incident
1. [ ] Assess scope (data corruption, hardware failure, ransomware)
2. [ ] Stop application immediately
3. [ ] Backup current state (if possible)
4. [ ] Identify last good backup
5. [ ] Perform restore to test database
6. [ ] Verify data integrity
7. [ ] Restore to production
8. [ ] Run migrations
9. [ ] Restart application
10. [ ] Verify functionality

### After Incident
- [ ] Document root cause
- [ ] Update procedures if needed
- [ ] Verify backup chain integrity
- [ ] Test restore again after changes

## Monitoring

### Backup Success Alerts

Check for:
- Backup file created with expected size (> 1 MB)
- `pg_restore --list` succeeds
- Backup age < 25 hours (for daily)

### Alerting (Windows Event Log)

```powershell
# In backup script, add:
if ($LASTEXITCODE -ne 0) {
    Write-EventLog -LogName Application -Source "PharmaERP" -EventId 1001 -EntryType Error -Message "Backup failed"
} else {
    Write-EventLog -LogName Application -Source "PharmaERP" -EventId 1000 -EntryType Information -Message "Backup completed: $backupFile"
}
```

## Security

### Backup Encryption

```powershell
# Encrypt with GPG
gpg --symmetric --cipher-algo AES256 --output backup.dump.gpg backup.dump

# Decrypt
gpg --output backup.dump --decrypt backup.dump.gpg
```

### Access Control

- Backup directory: Read/Write only for service account
- Encryption password: Stored in password manager
- Cloud bucket: Private, versioned, encrypted at rest

## Quick Reference

| Command | Description |
|---------|-------------|
| `.\scripts\backup.ps1` | Full interim local backup |
| `pg_dump -Fc -d pharma_erp -f backup.dump` | Manual dump |
| `pg_restore -d pharma_erp backup.dump` | Full restore |
| `pg_restore -l backup.dump` | Verify backup |
| `pg_restore -t medicine -d pharma_erp backup.dump` | Single table restore |
| `.\scripts\backup.ps1 -Verify:$false` | Quick backup (no verify) |

## Emergency Contacts

- **Database Admin**: [Name/Contact]
- **System Admin**: [Name/Contact]
- **PostgreSQL Support**: [If enterprise]

---

**Remember**: A backup is only as good as your last successful restore test. Test quarterly!