# Walmus Pharma ERP - Implementation Plan

## Phase Overview

| Phase | Focus | Duration | Deliverable |
|-------|-------|----------|-------------|
| 1 | Discovery & Design | ✅ Complete | Requirements, Schema, Accounting Rules, Expiry Design |
| 2 | Foundation | 2-3 days | Monorepo, no-login local workspace, DB, Migrations, Health Checks |
| 3 | Master Data & Inventory | 3-4 days | Medicines, Units, Suppliers, Customers, Batches, Opening Stock |
| 4 | Purchases & Sales | 4-5 days | Purchase/Sales Invoices, Returns, Printing |
| 5 | Financial Management | 3-4 days | Payments, Expenses, Journal Entries, Reconciliation |
| 6 | Dashboard & Reporting | 3-4 days | Dashboard, Charts, Reports, Exports, ROI |
| 7 | Import, Testing & Deployment | 3-4 days | CSV/XLSX import, workbook seed, exports, tests, scripts, docs, backup plan |

**Total Estimated**: 17-23 days

---

## Phase 2: Foundation (Week 1)

### 2.1 Monorepo Structure
```
pharma-erp/
├── frontend/                 # Next.js App
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   ├── components/      # Shared UI components
│   │   ├── features/        # Feature-specific components
│   │   ├── lib/             # Utilities, API client
│   │   ├── hooks/           # Custom React hooks
│   │   └── types/           # TypeScript types
│   ├── package.json
│   └── tsconfig.json
├── backend/                  # FastAPI App
│   ├── app/
│   │   ├── api/             # Route handlers
│   │   ├── core/            # Config, security, database
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # Business logic
│   │   ├── repositories/    # Data access
│   │   ├── accounting/      # Accounting engine
│   │   ├── inventory/       # Inventory engine
│   │   └── reports/         # Report generators
│   ├── migrations/          # Alembic migrations
│   ├── tests/               # Pytest tests
│   ├── pyproject.toml
│   └── uv.lock
├── database/
│   └── scripts/             # SQL scripts, seed data
├── docs/                    # Documentation (already created)
├── scripts/
│   ├── start.ps1            # Windows startup
│   ├── stop.ps1             # Windows shutdown
│   └── backup.ps1           # Backup script
├── .env.example
├── .gitignore
└── README.md
```

### 2.2 Technology Versions
- **Python**: 3.12+
- **FastAPI**: 0.110+
- **SQLAlchemy**: 2.0+
- **Alembic**: 1.13+
- **PostgreSQL**: 16+
- **Node.js**: 20+ (LTS)
- **Next.js**: 14+ (App Router)
- **React**: 18+
- **Tailwind CSS**: 3.4+
- **uv**: Latest

### 2.3 Environment Variables (.env.example)
```bash
# Database
DATABASE_URL=postgresql://pharma_user:secure_password@localhost:5432/pharma_erp
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=pharma_erp
POSTGRES_USER=pharma_user
POSTGRES_PASSWORD=secure_password

# Backend
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
SECRET_KEY=your-32-char-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
REFRESH_TOKEN_EXPIRE_DAYS=30

# Frontend
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_APP_NAME=Walmus Pharma ERP

# Backup
BACKUP_DIR=D:/pharma-erp-backups
BACKUP_RETENTION_DAYS=30
```

### 2.4 Backend Setup Tasks
- [ ] Initialize `uv` project with `pyproject.toml`
- [ ] Configure SQLAlchemy 2.0 async engine
- [ ] Set up Alembic with migration environment
- [ ] Create all enum types migration
- [ ] Create owner_settings and legacy app_user tables
- [ ] Single-owner default user context (no login or session)
- [ ] Request validation with Pydantic
- [ ] Global exception handling
- [ ] Structured logging (structlog)
- [ ] Health check endpoint (`/health`)
- [ ] CORS for localhost only
- [ ] OpenAPI docs at `/docs`

### 2.5 Frontend Setup Tasks
- [ ] Initialize Next.js with TypeScript, Tailwind, ESLint
- [ ] Install shadcn/ui, React Hook Form, Zod, Recharts, TanStack Table
- [ ] Configure path aliases (`@/`, `@/components`, etc.)
- [ ] Create API client (Axios/Fetch with interceptors)
- [ ] Default owner context (no token management)
- [ ] Layout: Sidebar, Header, Main content
- [ ] Theme provider (light/dark)
- [ ] Toast notifications
- [ ] Loading states

### 2.6 Database Setup
- [ ] PostgreSQL 16 installation guide (Windows/Linux)
- [ ] Create database & user with minimal privileges
- [ ] Run all migrations
- [ ] Seed: medicine_units, expense_categories, financial_accounts, number_sequences

---

## Phase 3: Master Data & Inventory (Week 1-2)

### 3.1 Medicine Master
**Backend:**
- [ ] CRUD API for Manufacturer
- [ ] CRUD API for Medicine Unit (with base unit constraint)
- [ ] CRUD API for Medicine (full spec from requirements)
- [ ] Duplicate product_code prevention (UNIQUE + service check)
- [ ] Unit conversion logic (purchase ↔ base ↔ sale)

**Frontend:**
- [ ] Manufacturer list + modal form
- [ ] Medicine Unit list + form
- [ ] Medicine list with search, filter, pagination
- [ ] Medicine form: tabs for Basic, Pricing, Units, Tax, Inventory
- [ ] Barcode scanner support (optional)

### 3.2 Supplier & Customer Management
**Backend:**
- [ ] Supplier CRUD + opening balance
- [ ] Customer CRUD + opening balance + doctor fields (specialty, area)
- [ ] Doctor Investment CRUD (linked to customer)
- [ ] Outstanding balance views

**Frontend:**
- [ ] Supplier page with tabs: List, Purchases, Payments, Outstanding
- [ ] Customer page with tabs: List, Sales, Receipts, Outstanding, Investments
- [ ] Doctor Investment form with ROI% and expected sales calculation

### 3.3 Medicine Batch & Opening Stock
**Backend:**
- [ ] Batch CRUD (linked to purchase invoice after Phase 4)
- [ ] Opening Stock Entry wizard (medicine, batch, expiry, qty, cost, supplier)
- [ ] Batch availability queries (FEFO)
- [ ] Expiry status computation

**Frontend:**
- [ ] Opening Stock Entry form (grid with add row)
- [ ] Batch list with filters (medicine, supplier, expiry range, status)
- [ ] Expiry dashboard page

### 3.4 Inventory Movements
**Backend:**
- [ ] Immutable inventory_movement table
- [ ] Movement recording service (called from purchase/sale/adjustment)
- [ ] Stock adjustment API (with reason codes)

**Frontend:**
- [ ] Stock Movement History page (filterable)
- [ ] Stock Adjustment form

---

## Phase 4: Purchases & Sales (Week 2-3)

### 4.1 Purchase Invoice
**Backend:**
- [ ] Draft creation (no stock/financial impact)
- [ ] Line items with batch/expiry entry
- [ ] Validation: supplier, positive qty, valid expiry, unique batch per supplier
- [ ] Posting transaction:
  - Create/update medicine_batch
  - Increment available_quantity
  - Record inventory_movement
  - Create journal entries (Inventory, Payable, Tax, Discount)
  - Update supplier balance
  - Update WAC for medicine
  - Generate voucher number
- [ ] Cancel draft, Cancel posted (reversal)

**Frontend:**
- [ ] Purchase Invoice List (filter: date, supplier, status)
- [ ] Create/Edit Form: Header + Dynamic line items table
- [ ] Batch entry per line (batch#, mfg, expiry, qty, rate)
- [ ] Auto-calc: line totals, subtotal, tax, discount, grand total
- [ ] Post button (confirmation dialog)
- [ ] Print preview (A4)

### 4.2 Supplier Payments
**Backend:**
- [ ] Payment API (cash/bank/cheque)
- [ ] Payment allocation to purchase invoices
- [ ] Journal entries (Payable, Cash/Bank)

**Frontend:**
- [ ] Supplier Payment form
- [ ] Outstanding invoices selection with auto-allocation
- [ ] Payment history

### 4.3 Sales Invoice
**Backend:**
- [ ] Draft creation
- [ ] Medicine search with saleable stock display
- [ ] FEFO batch suggestion + manual override
- [ ] Validation: expiry, availability, status
- [ ] Posting transaction:
  - Decrement batch.available_quantity
  - Record inventory_movement
  - Create journal entries (Receivable/Cash, Revenue, Tax, Discount, COGS, Inventory)
  - Update customer balance
  - Update doctor investment tracking
  - Generate invoice number
- [ ] Credit note / Sales return workflow

**Frontend:**
- [ ] Sales Invoice List
- [ ] Create/Edit Form with batch selection modal
- [ ] Real-time stock/expiry validation
- [ ] Customer selection with credit limit warning
- [ ] Payment collection on invoice (partial/full)
- [ ] Print layout: A4 + Thermal (80mm)

### 4.4 Customer Receipts
**Backend:**
- [ ] Receipt API with allocation to sales invoices
- [ ] Journal entries (Receivable, Cash/Bank)

**Frontend:**
- [ ] Customer Receipt form with invoice allocation

### 4.5 Returns
**Backend:**
- [ ] Purchase Return (against posted purchase invoice)
- [ ] Sales Return (against posted sales invoice)
- [ ] Restock/Quarantine/Destroy options
- [ ] Journal entry reversals

**Frontend:**
- [ ] Return forms with original invoice reference

---

## Phase 5: Financial Management (Week 3-4)

### 5.1 Cash & Bank Accounts
- [ ] Financial Account CRUD
- [ ] Cash/Bank balance display
- [ ] Inter-account transfers

### 5.2 Expense Management
- [ ] Expense Category CRUD (seeded from accounting rules)
- [ ] Expense Entry with category, account, attachment
- [ ] Medicine-tagged expenses for product P&L
- [ ] Monthly/Yearly expense reports

### 5.3 Journal Entries & Double-Entry
- [ ] Automatic JE generation from all transactions
- [ ] Manual JE for adjustments
- [ ] Trial Balance report
- [ ] Balance Sheet / P&L generation

### 5.4 Reconciliation
- [ ] Customer ledger vs Receivable control
- [ ] Supplier ledger vs Payable control
- [ ] Inventory valuation vs Inventory account
- [ ] Cash/Bank reconciliation helper

---

## Phase 6: Dashboard & Reporting (Week 4)

### 6.1 Dashboard
**Summary Cards:**
- Today's Sales / This Month Sales
- Today's Purchases / This Month Purchases
- Gross Profit (Month/YTD)
- Operating Expenses (Month/YTD)
- Net Operating Profit (Month/YTD)
- Total Receivables / Overdue
- Total Payables / Overdue
- Cash + Bank Balance
- Saleable Inventory Value
- Low Stock Count
- Expiring Batches (≤30 days) Count + Value
- Expired Stock Value

**Charts:**
- Monthly Sales vs Purchases (Bar)
- Gross Profit Trend (Line)
- Top 10 Products by Sales (Bar)
- Expenses by Category (Pie)
- Stock Movement Trend (Area)
- Expiry Risk Distribution (Stacked Bar)

**Quick Actions:**
- New Purchase / New Sale / Receive Payment / Pay Supplier / Add Expense / Add Medicine / Review Expiring

### 6.2 Reports (All with Date Range, Export CSV/Excel)
1. Daily/Monthly/Annual Sales
2. Purchase History
3. Sales by Medicine
4. Purchases by Supplier
5. Sales by Customer
6. Customer Outstanding (Aging)
7. Supplier Outstanding (Aging)
8. Gross Profit (by Product/Period)
9. Operating Expenses
10. Net Operating Profit
11. Inventory Valuation
12. Stock Movement
13. Expiring Stock
14. Expired Stock
15. Purchase Returns
16. Sales Returns
17. Payments Received
18. Supplier Payments
19. Cash/Bank Balances
20. ROI / Doctor Tracking
21. Monthly/Annual Summary (Excel-style)

### 6.3 ROI Module
- Doctor Investment entry
- Monthly sales tracking per doctor (auto from sales invoices)
- Expected vs Actual comparison
- Balance (Investment - Recovered)
- Investment recovery allocation

---

## Phase 7: Testing & Deployment (Week 4-5)

### 7.1 Automated Tests (Backend - pytest)
| Test Category | Scenarios |
|---------------|-----------|
| Access | Default owner resolution, no-login workspace, local request handling |
| Medicine | Create, duplicate code rejection, unit conversion |
| Purchase | Calculations, stock increase, WAC update, posting |
| Batch | Expiry tracking, FEFO selection, expired exclusion |
| Sales | FEFO, expiry validation, stock decrement, COGS |
| Payments | Partial/full, allocation, balance updates |
| Returns | Purchase/Sales returns, stock restoration, reversals |
| Financial | Gross profit, expense, net profit calculations |
| Invoice Numbers | Uniqueness, sequence per FY |
| Concurrency | Double submit protection, row locking |
| Transactions | Rollback on failure |
| Backup/Restore | Verify backup, restore to test DB |
| Expiry | Date boundaries, alert tiers |

### 7.2 Frontend Tests
- [ ] Component tests (React Testing Library)
- [ ] E2E tests (Playwright): Dashboard → Purchase → Sale → Payment → Report → Export

### 7.3 Local Deployment Scripts
**Windows (PowerShell):**
- `scripts/start.ps1` - Start PostgreSQL, Backend, Frontend
- `scripts/stop.ps1` - Graceful shutdown
- `scripts/backup.ps1` - `pg_dump` with timestamp, verify, retention

**Linux (Bash):**
- Equivalent `.sh` scripts

### 7.4 Documentation
- [ ] Installation Guide (Windows)
- [ ] Installation Guide (Linux)
- [ ] Backup & Restore Guide
- [ ] User Manual (PDF)
- [ ] Testing Guide
- [ ] API Documentation (OpenAPI)

---

## Development Rules Checklist

- [ ] No mock data in production code
- [ ] All TODOs resolved before phase complete
- [ ] Business rules from Excel preserved
- [ ] No floating-point for money
- [ ] No expired stock sales
- [ ] No stock deduction before sale post
- [ ] No hardcoded dashboard values
- [ ] Localhost-only binding
- [ ] Env vars for all secrets
- [ ] Migrations for every schema change
- [ ] Tests for every critical path

---

## Acceptance Test Script (End-to-End)

```bash
# 1. Start application
./scripts/start.ps1

# 2. First run - no login
#    → http://localhost:3000/dashboard (opens directly)

# 3. Review business settings
#    → http://localhost:3000/settings

# 4. Add Distributor (Supplier)
#    → Suppliers → New → "ABC Pharma Distributors"

# 5. Add Medicines
#    → Medicines → New → "MetroMoxy 400mg" (Box/Strip/Tablet units)

# 6. Record Purchase Invoice
#    → Purchases → New → Select supplier, add lines with batches/expiry
#    → Post → Verify stock increased

# 7. Check Dashboard
#    → Verify inventory value, payables, expiring batches

# 8. Create Sales Invoice
#    → Sales → New → Select customer, add lines
#    → Batch selection (FEFO suggested)
#    → Post → Verify stock decremented, COGS recorded

# 9. Record Customer Payment
#    → Receipts → New → Allocate to invoice

# 10. Record Expenses & Supplier Payment
#    → Expenses → New → Rent, Salary, Fuel
#    → Payments → Supplier → Pay ABC Pharma

# 11. Verify Financials
#    → Reports → Gross Profit, Net Profit, Receivables, Payables

# 12. Expiry Review
#    → Dashboard → Expiring batches → Drill down

# 13. Print Invoice
#    → Sales → View → Print → Verify layout

# 14. Restart Test
#    → ./scripts/stop.ps1
#    → Reboot computer
#    → ./scripts/start.ps1
#    → Verify all data intact

# 15. Backup & Restore
#    → ./scripts/backup.ps1
#    → Verify backup file exists
#    → Restore to test database
#    → Verify data integrity

# 16. Run Automated Tests
#    → cd backend && uv run pytest -v
```

---

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Discovery & Design | ✅ Complete | Requirements, Schema, Accounting, Expiry docs created |
| 2. Foundation | ⏳ Next | Start with monorepo setup |
| 3. Master Data | ⏳ Pending | |
| 4. Purchases & Sales | ⏳ Pending | |
| 5. Financial | ⏳ Pending | |
| 6. Dashboard | ⏳ Pending | |
| 7. Testing | ⏳ Pending | |

---

## Next Steps

1. Create monorepo structure
2. Initialize backend with `uv`
3. Initialize frontend with Next.js
4. Set up PostgreSQL database
5. Run first migration (enums + owner_settings + app_user)
6. Implement the single-owner no-login workspace
7. Build business settings and the legacy-workbook import