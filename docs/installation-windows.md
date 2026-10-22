# Installation Guide - Windows

## Prerequisites

### 1. PostgreSQL 16+

1. Download from: https://www.postgresql.org/download/windows/
2. Run installer with default settings
3. Remember the password for `postgres` superuser
4. Default port: 5432
5. Add PostgreSQL `bin` directory to PATH (e.g., `C:\Program Files\PostgreSQL\16\bin`)

### 2. Python 3.12+

1. Download from: https://www.python.org/downloads/windows/
2. **Important**: Check "Add Python to PATH" during installation
3. Verify: `python --version` should show 3.12+

### 3. Node.js 20+ (LTS)

1. Download from: https://nodejs.org/en/download/
2. Choose LTS version
3. Verify: `node --version` should show v20+

### 4. uv (Python package manager)

```powershell
pip install uv
```

Or using pipx:
```powershell
pipx install uv
```

## Database Setup

### Create Database and User

Open **pgAdmin 4** or **psql** and run:

```sql
-- Connect as postgres superuser
CREATE DATABASE pharma_erp;
CREATE USER pharma_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE pharma_erp TO pharma_user;
ALTER DATABASE pharma_erp OWNER TO pharma_user;

-- Connect to pharma_erp database
\c pharma_erp
GRANT ALL ON SCHEMA public TO pharma_user;
```

Or via command line:
```powershell
psql -U postgres -c "CREATE DATABASE pharma_erp;"
psql -U postgres -c "CREATE USER pharma_user WITH ENCRYPTED PASSWORD 'secure_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE pharma_erp TO pharma_user;"
psql -U postgres -c "ALTER DATABASE pharma_erp OWNER TO pharma_user;"
psql -U postgres -d pharma_erp -c "GRANT ALL ON SCHEMA public TO pharma_user;"
```

## Application Setup

### 1. Clone/Extract Project

```powershell
# If using git
git clone <repository-url> D:\WALMUS_ERP
cd D:\WALMUS_ERP

# Or extract ZIP to D:\WALMUS_ERP
```

### 2. Configure Environment

```powershell
cd D:\WALMUS_ERP
copy .env.example .env
notepad .env
```

Edit `.env` with your values:

```env
# Database (update with your credentials)
DATABASE_URL=postgresql://pharma_user:secure_password@localhost:5432/pharma_erp
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=pharma_erp
POSTGRES_USER=pharma_user
POSTGRES_PASSWORD=secure_password

# Legacy auth setting (not used by the no-login build; keep for compatibility)
# Run: python -c "import secrets; print(secrets.token_urlsafe(32))"
SECRET_KEY=your-generated-secret-key-here

# Interim local backup directory (Supabase manual backup is the long-term plan)
BACKUP_DIR=D:/pharma-erp-backups
```

### 3. Generate Secret Key (legacy, optional)

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output to `SECRET_KEY` in `.env`. This is retained only for backward compatibility; the current frontend does not require a login.

### 4. Install Backend Dependencies

```powershell
cd D:\WALMUS_ERP\backend
uv venv
uv pip install -e ".[dev]"
```

### 5. Run Migrations

```powershell
cd D:\WALMUS_ERP\backend
uv run alembic upgrade head
```

### 6. Install Frontend Dependencies

```powershell
cd D:\WALMUS_ERP\frontend
npm install
```

### 7. Build Frontend (for production)

```powershell
cd D:\WALMUS_ERP\frontend
npm run build
```

## Running the Application

### Development Mode

```powershell
cd D:\WALMUS_ERP
.\run_servers.bat
```

Or run the PowerShell launcher directly:

```powershell
.\scripts\start.ps1
```

This starts:
- PostgreSQL (if not running)
- Backend API at http://127.0.0.1:8000
- Frontend at http://127.0.0.1:3000
- Opens the web app in your default browser when the frontend is ready

### Production Mode

```powershell
# Terminal 1 - Backend
cd D:\WALMUS_ERP\backend
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 2 - Frontend
cd D:\WALMUS_ERP\frontend
npm run start
```

## First Run - Single-Owner Workspace

1. Open http://127.0.0.1:3000 — the application opens directly on the dashboard. There is no login or setup wizard.
2. Open **Settings** and confirm the business name, address, currency (PKR), invoice prefixes, and financial year start month.
3. Optional: open **Import & Export → Workbook Seed** and upload `Sale Sheet MA-Na.xlsx`, or run the seed script:

```powershell
cd D:\WALMUS_ERP\backend
.\.venv\Scripts\python.exe scripts\seed_from_excel.py
```

The script is idempotent; re-running it updates imported sales history and skips existing master data.

## Verification

### Check Services

- **Backend Health**: http://127.0.0.1:8000/health
- **API Docs**: http://127.0.0.1:8000/docs
- **Frontend**: http://127.0.0.1:3000

### Run Tests

```powershell
cd D:\WALMUS_ERP\backend
uv run pytest -v
```

## Backup Setup

### Supabase Manual Backup (planned primary method — deferred)

The production database is intended to run on Supabase. Take a manual backup from the Supabase Dashboard (**Database → Backups**) or with `pg_dump` against the Supabase session-mode connection string. The in-app Supabase backup workflow is not implemented yet. See `docs/backup-and-restore.md`.

### Interim Local Backup

```powershell
cd D:\WALMUS_ERP
.\scripts\backup.ps1
```

### Scheduled Local Backup (Task Scheduler, interim)

1. Open **Task Scheduler**
2. Create Basic Task → Daily at 2:00 AM
3. Action: Start a Program
   - Program: `powershell.exe`
   - Arguments: `-ExecutionPolicy Bypass -File "D:\WALMUS_ERP\scripts\backup.ps1"`
   - Start in: `D:\WALMUS_ERP`

## Firewall (Optional)

If accessing from other machines on LAN (not recommended for security):

```powershell
# Allow inbound on ports 3000 and 8000
New-NetFirewallRule -DisplayName "Pharma ERP Frontend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Pharma ERP Backend" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

**Security Note**: Default configuration binds to 127.0.0.1 only. Do not expose to internet.

## Troubleshooting

### Port Already in Use

```powershell
# Check what's using port 8000
netstat -ano | findstr :8000

# Kill process
taskkill /PID <PID> /F
```

### Database Connection Failed

1. Check PostgreSQL service is running: `services.msc` → PostgreSQL
2. Verify credentials in `.env`
3. Check `pg_hba.conf` allows password authentication

### Migration Errors

```powershell
cd backend
uv run alembic downgrade -1
uv run alembic upgrade head
```

### Frontend Build Errors

```powershell
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Uninstall

```powershell
# Stop services (or double-click stop_servers.bat)
.\scripts\stop.ps1

# Remove database
psql -U postgres -c "DROP DATABASE pharma_erp;"
psql -U postgres -c "DROP USER pharma_user;"

# Remove project folder
rm -rf D:\WALMUS_ERP
```

## Support

Check logs in:
- Backend: Terminal running uvicorn
- Frontend: Browser console (F12)
- Database: PostgreSQL logs in `data/log/` directory