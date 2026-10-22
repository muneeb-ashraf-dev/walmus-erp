# Walmus Pharma ERP

A self-hosted Pharmaceutical ERP and Inventory Management System for small pharmaceutical trading businesses.

## Features

- **Medicine Master Management** - Products, units, conversions, manufacturers
- **Batch & Expiry Tracking** - FEFO allocation, expiry alerts (90/60/30/7 days), quarantine workflow
- **Purchase Management** - Invoices, supplier payments, returns, batch creation
- **Sales Management** - Invoices, customer receipts, batch selection, printable invoices
- **Financial Accounting** - Double-entry bookkeeping, journal entries, cash/bank, expenses
- **Doctor Investment (ROI)** - Investment tracking, expected vs actual sales
- **Dashboard & Reports** - Real-time metrics, charts, XLSX/CSV report exports
- **Import & Export** - CSV/XLSX entity import with preview and validation, full `Sale Sheet MA-Na.xlsx` workbook seed, templates, import history, and XLSX exports
- **Backup & Restore** - Supabase manual backup plan (implementation deferred); interim local pg_dump scripts included
- **Single-owner access** - No login, user accounts, or sessions; opens directly into the workspace

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: FastAPI, Python 3.12, SQLAlchemy 2.0, PostgreSQL 16
- **Access**: Single-owner local workspace, no authentication in Version 1
- **Deployment**: Local-only (127.0.0.1), PowerShell scripts for Windows; Supabase-compatible PostgreSQL

## Quick Start (Windows)

### Prerequisites

1. **PostgreSQL 16+** - Download from [postgresql.org](https://www.postgresql.org/download/windows/)
2. **Python 3.12+** - Download from [python.org](https://www.python.org/downloads/)
3. **Node.js 20+** - Download from [nodejs.org](https://nodejs.org/)
4. **uv** - Install with `pip install uv`

### Installation

```powershell
# Clone or navigate to project
cd D:\WALMUS_ERP

# Copy environment template
copy .env.example .env

# Edit .env with your settings (especially DATABASE_URL and SECRET_KEY)
notepad .env

# One-click start (also opens the web app in your browser)
.\run_servers.bat

# Or run the PowerShell launcher directly
.\scripts\start.ps1
```

Double-click `run_servers.bat` to start the backend and frontend and open
http://127.0.0.1:3000 automatically. Use `stop_servers.bat` to stop both services.

The launcher uses the optimized Next.js production build by default, so page
switching is fast after startup. The first launch builds the frontend once and
may take a minute; later launches reuse that build. It rebuilds automatically
when frontend source/config files change or when `BackendPort` changes.

For live reload while editing code, run:

```powershell
.\run_servers.bat -Dev
```

To use different ports:

```powershell
.\run_servers.bat -BackendPort 8010 -FrontendPort 3010
.\scripts\stop.ps1 -BackendPort 8010 -FrontendPort 3010
```

### First Run

1. Open http://127.0.0.1:3000 — the application opens directly on the dashboard (no login).
2. Review business details under **Settings**.
3. Optional: open **Import & Export → Workbook Seed**, upload `Sale Sheet MA-Na.xlsx`, preview, and commit.
4. Start using the ERP.

### Seed from the legacy workbook

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\seed_from_excel.py
```

The seed script is idempotent. Re-running it updates imported sales history and skips existing master data, opening batches, investments, and expenses.

## Project Structure

```
pharma-erp/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Config, security, database
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   └── services/       # Business logic
│   ├── migrations/         # Alembic migrations
│   └── pyproject.toml      # Python dependencies
├── frontend/                # Next.js application
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   └── lib/            # Utilities
│   └── package.json
├── docs/                    # Documentation
├── scripts/                 # PowerShell scripts
│   ├── start.ps1
│   ├── stop.ps1
│   └── backup.ps1
├── run_servers.bat          # One-click start + open browser
├── stop_servers.bat         # One-click stop
└── README.md
```

## Configuration

Edit `.env` file:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/pharma_erp

# Legacy auth setting (not used by the no-login build; keep for compatibility)
SECRET_KEY=your-32-char-secret-key

# Interim local backup directory (Supabase manual backup is the long-term plan)
BACKUP_DIR=D:/pharma-erp-backups
```

## API Documentation

Once running, visit:
- **API Docs**: http://127.0.0.1:8000/docs
- **ReDoc**: http://127.0.0.1:8000/redoc

## Import & Export

Open **Import & Export** in the sidebar:

- **Import Data** — upload CSV/XLSX for medicines, customers, suppliers, or sales history. Preview validates every row before commit; imports are idempotent.
- **Workbook Seed** — upload `Sale Sheet MA-Na.xlsx`, preview month/product totals, then commit products, opening stock, investments, doctor performance, OLX/Medicare records, and monthly summaries.
- **Export** — download XLSX workbooks for master data, inventory, invoices, expenses, investments, imported sales history, and monthly summaries.
- **History** — review import runs and imported monthly performance.

Entity endpoints live under `/api/import-export`; report exports live under `/api/reports/export`.

## Backup & Restore

The production database is intended to run on **Supabase**. The long-term requirement is a manual Supabase backup (Dashboard export or `pg_dump` against the Supabase connection string). **The in-app Supabase backup workflow is deferred and not implemented in the current increment.**

While the application runs against a local PostgreSQL instance, the interim scripts remain available:

### Create local backup
```powershell
.\scripts\backup.ps1
```

### Restore local backup
```powershell
pg_restore -h localhost -p 5432 -U pharma_user -d pharma_erp -v "D:\pharma-erp-backups\pharma_erp_20240115_120000.sql.gz"
```

See `docs/backup-and-restore.md` for the Supabase procedure and restore verification steps.

## Development

Use the launcher's development mode to run both services with live reload:

```powershell
.\run_servers.bat -Dev
```

Or run each service manually:

### Backend
```powershell
cd backend
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend
```powershell
cd frontend
npm run dev
```

### Run Tests
```powershell
cd backend
uv run pytest -v
```

### Production build
```powershell
cd frontend
npm run build
npm run start
```

## Database Migrations

```powershell
cd backend
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
```

## License

Proprietary - For internal use only.

## Support

For issues, check the documentation in `/docs` or contact the system administrator.