# Walmus Pharma ERP - Project Summary

## Project Overview
Complete self-hosted Pharmaceutical ERP and Inventory Management System for small pharmaceutical trading business.

## Project Structure
```
pharma-erp/
├── backend/                 # FastAPI Application
│   ├── app/
│   │   ├── api/            # API Routes (auth legacy, dashboard, medicines, suppliers, customers, purchases, sales, inventory, financial, reports, import/export, settings)
│   │   ├── core/           # Config, Security, Database, Logging, Exceptions
│   │   ├── models/         # SQLAlchemy 2.0 Models (Owner, Medicine, Batch, Invoice, Financial, Audit)
│   │   ├── schemas/        # Pydantic Schemas (Request/Response validation)
│   │   ├── services/       # Business Logic (Inventory, Accounting, Excel import/export)
│   │   ├── repositories/   # Data Access Layer
│   │   ├── accounting/     # Accounting Engine
│   │   ├── inventory/      # Inventory Engine
│   │   └── reports/        # Report Generators
│   ├── scripts/            # Operational scripts (seed_from_excel.py)
│   ├── migrations/         # Alembic Migrations (12 migrations)
│   ├── tests/              # Pytest Tests (unit, integration)
│   ├── pyproject.toml      # Python Dependencies (uv)
│   └── main.py             # FastAPI App Entry Point
├── frontend/               # Next.js 14 Application
│   ├── src/
│   │   ├── app/            # App Router Pages (dashboard, medicines, suppliers, customers, purchases, sales, inventory, financial, reports, import-export, settings, backup)
│   │   ├── components/     # UI Components (shadcn/ui based)
│   │   ├── lib/            # Utilities (API client, cookies, utils)
│   │   ├── hooks/          # Custom React Hooks (useAuth)
│   │   └── types/          # TypeScript Types
│   ├── package.json
│   └── tailwind.config.js
├── docs/                   # Documentation (9 files)
├── scripts/                # PowerShell Scripts (start, stop, backup)
├── run_servers.bat         # One-click start + open browser
├── stop_servers.bat        # One-click stop
├── .env.example
├── .gitignore
└── README.md
```

## Backend Implementation

### Core Modules (app/core/)
- **config.py**: Pydantic Settings with environment variables
- **database.py**: Async SQLAlchemy 2.0 with connection pooling
- **security.py**: Legacy Argon2id/JWT helpers retained for compatibility; `get_current_user` defaults to the single local owner when no token is present
- **logging.py**: Structured logging with structlog
- **exceptions.py**: Custom exceptions with global handlers

### Database Models (app/models/)
- **Enums**: InvoiceStatus, PaymentStatus, PaymentMethod, MovementReason, BatchStatus, AccountType, etc.
- **Owner Settings**: Business configuration singleton
- **App User**: Legacy user table retained for audit references; a single `owner` row is auto-created and used by default
- **Master Data**: Manufacturer, MedicineUnit, Medicine, Supplier, Customer, DoctorInvestment
- **Inventory**: MedicineBatch, PurchaseInvoice/Item, SalesInvoice/Item, PurchaseReturn, SalesReturn, InventoryMovement, StockAdjustment
- **Financial**: FinancialAccount, JournalEntry/Line, Payment/Allocation, Expense/Category, OpeningBalance, NumberSequence
- **Audit**: AuditLog, ApplicationSetting

### Migrations (12 migrations)
1. `001_init_enums_and_core.py` - Enums, owner_settings, app_user
2. `002_master_data.py` - Manufacturer, units, medicine, supplier, customer, doctor_investment
3. `003_inventory.py` - Batches, invoices, returns, movements, adjustments
4. `004_financial.py` - Accounts, journal entries, payments, expenses, opening balances
5. `005_audit_settings.py` - Audit log, app settings
6. `006_seed_data.py` - Default units, expense categories, financial accounts, number sequences
7. `007_views.py` - Reporting views (stock, outstanding, profit)
8. `008_functions_triggers.py` - Voucher numbering, batch updates, FEFO, immutability
9. `009_doctor_investment_transactions.py` - Investment transaction ledger
10. `010_import_tracking.py` - Import batches, sales history, month summaries, customer performance
11. `011_audit_timestamp_alignment.py` - Adds missing `created_at`/`updated_at` columns to early tables
12. `012_payment_invoice_links.py` - Aligns optional payment invoice-link columns with the Payment model

### API Endpoints (app/api/)
- **auth**: Legacy setup/login/refresh/logout/profile endpoints; not used by the no-login frontend
- **dashboard**: Summary, charts (sales, profit, products, expenses, expiry), alerts, low stock, quick actions
- **medicines**: CRUD + manufacturers, units, batches
- **suppliers**: CRUD + purchases, payments, outstanding
- **customers**: CRUD + sales, receipts, investments (ROI)
- **purchases**: Draft creation, posting (stock + journal), cancellation, returns
- **sales**: Draft creation, batch selection (FEFO), posting (stock + journal + COGS), printing, returns
- **inventory**: Summary, batches, movements, adjustments, expiry/expired lists
- **financial**: Accounts, journal entries, payments, expenses, reconciliation, aging
- **reports**: Sales, purchases, profit, inventory, expiry, ROI, monthly summary, real CSV/XLSX export
- **import-export**: Entity templates, preview/commit, full workbook preview/commit, import batches/history, XLSX exports
- **settings**: Owner settings, user profile, app settings

### Services (app/services/)
- **inventory.py**: FEFO allocation, batch validation, expiry checking
- **excel_import_export.py**: CSV/XLSX parsing, row validation, idempotent upserts, workbook seed, XLSX generation

## Frontend Implementation

### Pages (src/app/)
- **Access**: Opens directly on `/dashboard`; legacy `/login` and `/setup` routes redirect into the workspace
- **Dashboard**: Summary cards, charts (Recharts), expiry alerts, low stock, quick actions
- **Medicines**: List with search/filter, form with tabs (basic, pricing, units, tax, inventory)
- **Suppliers**: List, detail with purchases/payments/outstanding tabs
- **Customers**: List, detail with sales/receipts/outstanding/investments tabs
- **Purchases**: List, create/edit with batch/expiry lines, post/cancel/return
- **Sales**: List, create/edit with FEFO batch selection modal, post/cancel/return/print
- **Inventory**: Summary, batch list/detail with movement history, movements, adjustments, expiring/expired
- **Financial**: Accounts, journal entries, payments, expenses, reconciliation, aging
- **Reports**: All report types with filters and CSV/XLSX export
- **Import & Export**: Entity import, workbook seed, templates, exports, and import history
- **Settings**: Owner settings, user profile, app settings
- **Backup**: Local pg_dump guidance and restore checklist; Supabase manual backup is documented but deferred

### UI Components (src/components/ui/)
Complete shadcn/ui implementation:
Button, Input, Card, Label, Select, Table, Dialog, Tabs, Tooltip, Badge, Avatar, Separator, Switch, Popover, HoverCard, AlertDialog, DropdownMenu

### State Management
- **useAuth**: Returns the default single owner; no token management or refresh loop
- **API Client**: Axios with error interceptors (no auth headers required)

## Documentation (docs/)

1. **requirements.md** - Excel analysis, business workflows, data mapping
2. **database-schema.md** - Complete PostgreSQL schema with tables, indexes, constraints, views
3. **accounting-rules.md** - Double-entry rules, revenue recognition, COGS (WAC), doctor investment accounting
4. **expiry-management.md** - Batch lifecycle, FEFO, alert tiers, restrictions, quarantine workflow
5. **implementation-plan.md** - 7-phase plan with tasks, timeline, acceptance criteria
6. **installation-windows.md** - Step-by-step Windows setup guide
7. **backup-and-restore.md** - Supabase manual backup/restore plan (deferred implementation) plus interim local pg_dump/pg_restore
8. **testing-guide.md** - Test pyramid, fixtures, scenarios, CI/CD
9. **user-manual.md** - Complete user guide with workflows and shortcuts

## Deployment Scripts (scripts/)

- **start.ps1**: Starts PostgreSQL, Backend, and the optimized production Frontend; reuses the existing build, rebuilds only when needed, supports `-Dev` live reload, runs health checks, then opens the browser
- **stop.ps1**: Graceful shutdown of all processes; accepts custom backend/frontend ports
- **backup.ps1**: pg_dump with compression, verification, encryption, retention, cleanup
- **run_servers.bat**: Double-click launcher for `start.ps1` and the web app
- **stop_servers.bat**: Double-click launcher for `stop.ps1`

## Key Features Implemented

### Inventory & Expiry Management
- ✅ Batch-level tracking with manufacturing/expiry dates
- ✅ FEFO (First Expiry First Out) allocation with manual override
- ✅ Expiry alert tiers: 90/60/30/7 days + expired
- ✅ Hard block on expired batch sales
- ✅ Revalidation at posting time (concurrency safe)
- ✅ Quarantine workflow for returns/damaged/expired
- ✅ Low stock alerts based on reorder level

### Accounting & Financial
- ✅ Double-entry bookkeeping for all transactions
- ✅ Weighted Average Cost (WAC) for COGS
- ✅ Automatic journal entries from invoices/payments/expenses
- ✅ Customer/Supplier ledgers with aging
- ✅ Doctor investment (ROI) tracking
- ✅ Reconciliation reports

### Purchase & Sales Workflow
- ✅ Draft → Posted workflow (drafts don't affect stock)
- ✅ Batch/expiry entry per line
- ✅ Auto-calculated totals, discounts, taxes
- ✅ Cash/credit purchases and sales
- ✅ Partial payments with allocation
- ✅ Returns with restock/quarantine/destroy options
- ✅ Printable invoices (A4 + thermal)

### Import, Export & Historical Data
- ✅ CSV/XLSX entity import with preview, validation, templates, and idempotent commit
- ✅ Full `Sale Sheet MA-Na.xlsx` workbook seed (products, opening stock, investments, doctor/OLX performance, Medicare, monthly summaries)
- ✅ XLSX exports for master data, transactions, imported history, and monthly summaries
- ✅ CSV/XLSX report exports
- ✅ Import batch history with row counts, status, and errors
- ✅ Historical performance surfaced in doctor ROI and monthly summary reports without double counting

### Access & Local Deployment
- ✅ Single-owner workspace with no login or session requirement
- ✅ Default owner context for audit references
- ✅ Localhost-only binding (127.0.0.1)
- ✅ Environment-based configuration
- ✅ No external dependencies for runtime (optional Supabase deployment)

## Testing

- **Unit Tests**: Inventory logic (FEFO, expiry, WAC, ROI), import validation
- **Integration Tests**: Purchase/sales/payment/return flows
- **Conftest**: Test database fixtures, async client
- **Health Tests**: API health, OpenAPI docs

## Getting Started

```powershell
# 1. Prerequisites: PostgreSQL 16, Python 3.12+, Node.js 20+, uv
# 2. Create database
psql -U postgres -c "CREATE DATABASE pharma_erp; CREATE USER pharma_user WITH PASSWORD 'secure_password'; GRANT ALL ON DATABASE pharma_erp TO pharma_user;"

# 3. Configure
cd D:\WALMUS_ERP
copy .env.example .env
# Edit .env with DATABASE_URL and SECRET_KEY

# 4. Install & Run
cd backend
uv venv
uv pip install -e ".[dev]"
uv run alembic upgrade head

cd ..\frontend
npm install

# 5. Start
.\scripts\start.ps1
# Use .\scripts\start.ps1 -Dev for live reload while editing

# 6. Optional seed from legacy workbook
cd ..\backend
.\.venv\Scripts\python.exe scripts\seed_from_excel.py

# 7. Open http://127.0.0.1:3000 → Dashboard (no login)
```

## Acceptance Criteria Status

| Criteria | Status |
|----------|--------|
| Owner starts app locally | ✅ Implemented |
| No-login single-owner workspace | ✅ Implemented |
| Add distributor & medicines | ✅ Implemented |
| Purchase invoice with batches/expiry | ✅ Implemented |
| Stock increase + supplier liability | ✅ Implemented |
| Dashboard shows correct figures | ✅ Implemented |
| Sales invoice with FEFO batch selection | ✅ Implemented |
| Expiry validation + stock deduction | ✅ Implemented |
| COGS calculation (WAC) | ✅ Implemented |
| Customer payment recording | ✅ Implemented |
| Expenses + supplier payments | ✅ Implemented |
| Outstanding balances | ✅ Implemented |
| Gross/Net profit calculation | ✅ Implemented |
| Expiry/low stock review | ✅ Implemented |
| Print invoices + export reports | ✅ Implemented |
| Excel/CSV import + workbook seed | ✅ Implemented |
| Persistent data after restart | ✅ Implemented |
| Supabase backup + restore | 📋 Documented / deferred |
| Interim local backup scripts | ✅ Available |
| Automated tests passing | ⚠️ 13 backend tests passing; API endpoint coverage is still expanding |

## Next Steps for Full Operation

1. **Install prerequisites** (PostgreSQL, Python, Node.js, uv)
2. **Run database setup** and configure `.env`
3. **Install dependencies** and run migrations
4. **Start application** with `.\scripts\start.ps1`
5. **Review business settings** at http://127.0.0.1:3000/settings
6. **Optional:** seed from `Sale Sheet MA-Na.xlsx` using the Import & Export page or the seed script
7. **Test full workflow**: Purchase → Sale → Payment → Reports → Export
8. **Backups:** plan the manual Supabase backup once the production database is hosted there

The application is operational for local single-owner use. Remaining known gaps: sales/purchase cancellation reversals are incomplete, doctor investment transaction API endpoints are not exposed, and the Supabase backup workflow is deferred.