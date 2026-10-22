# Walmus Pharma ERP - User Manual

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard](#dashboard)
3. [Medicine Management](#medicine-management)
4. [Supplier Management](#supplier-management)
5. [Customer & Doctor Management](#customer--doctor-management)
6. [Purchase Management](#purchase-management)
7. [Sales Management](#sales-management)
8. [Inventory & Expiry Management](#inventory--expiry-management)
9. [Financial Management](#financial-management)
10. [Reports](#reports)
11. [Import & Export](#import--export)
12. [Settings](#settings)
13. [Backup & Maintenance](#backup--maintenance)
14. [Keyboard Shortcuts](#keyboard-shortcuts)
15. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First Run

1. Open your browser and go to **http://127.0.0.1:3000**
2. The application opens directly on the **Dashboard**. There is no login, setup wizard, admin account, or password.
3. Open **Settings** to confirm business information, currency (PKR), invoice prefixes, and financial year start.
4. Optional: use **Import & Export** to seed the system from `Sale Sheet MA-Na.xlsx`.

### Navigation Overview

- **Sidebar** (left): Main navigation menu, including Import & Export
- **Header** (top): Notifications, theme toggle
- **Main Area**: Content for selected module

### User Menu (Top Right)

- **Settings**: Business profile and application settings
- **Theme**: Light/Dark/System

> This is a single-owner local system. Anyone with access to the Windows user session can open the application, so protect the computer with an OS password and keep the backend bound to `127.0.0.1`.

---

## Dashboard

The dashboard provides a real-time overview of your business.

### Summary Cards

| Card | Description |
|------|-------------|
| **Today's Sales** | Total sales posted today |
| **This Month Sales** | Cumulative sales for current month |
| **Today's Purchases** | Total purchases posted today |
| **Month Gross Profit** | Sales - COGS for current month |
| **Month Expenses** | Operating expenses for current month |
| **Net Operating Profit** | Gross Profit - Expenses |
| **Receivables** | Total customer outstanding |
| **Payables** | Total supplier outstanding |
| **Cash & Bank** | Available liquidity |
| **Inventory Value** | Saleable stock at cost |
| **Low Stock** | Items below reorder level |
| **Expiring Batches** | Batches expiring ≤30 days |
| **Expired Stock** | Expired batches value |

### Charts

- **Sales vs Purchases**: 12-month trend
- **Gross Profit Trend**: Monthly profitability
- **Top Products**: Best-selling medicines
- **Expenses by Category**: Expense breakdown
- **Expiry Distribution**: Risk visualization

### Quick Actions

Click any action button for immediate access:
- New Purchase | New Sale | Receive Payment | Pay Supplier
- Add Expense | Add Medicine | Review Expiring Stock

---

## Medicine Management

### Access: Sidebar → Medicines

### Medicine List

**Features:**
- Search by name, product code, barcode, generic name
- Filter by manufacturer, active status
- Sort by any column
- Pagination (50 per page)

**Columns:**
- Product Code | Name | Generic | Manufacturer | Units | Purchase Rate | Sale Rate | Tax | Status

### Adding a Medicine

1. Click **New Medicine**
2. Fill in tabs:

#### Basic Info
- **Product Code** (unique, required) - e.g., `MET400`
- **Barcode** (optional) - Scan or enter
- **Name** (required) - e.g., `MetroMoxy 400mg`
- **Generic Name** - e.g., `Moxifloxacin`
- **Manufacturer** - Select from list
- **Strength** - e.g., `400mg`
- **Dosage Form** - Tablet, Capsule, Syrup, Injection, etc.
- **Packing** - e.g., `10x10 Tablets`

#### Units & Conversions
- **Base Unit** - Smallest unit (Tablet, ml, etc.)
- **Units per Pack** - Base units per purchase pack
- **Purchase Unit** - Unit used for purchasing
- **Purchase Conversion** - Purchase units → Base units
- **Sale Unit** - Unit used for selling
- **Sale Conversion** - Sale units → Base units

> **Example**: Buy by Box (10 strips), Sell by Strip (10 tablets)
> - Base Unit: `TAB` (tablet)
> - Units per Pack: `100` (10 strips × 10 tablets)
> - Purchase Unit: `BOX`, Conversion: `100`
> - Sale Unit: `STRIP`, Conversion: `10`

#### Pricing
- **Default Purchase Rate** - Per purchase unit
- **Default Sale Rate** - Per sale unit
- **Wholesale Rate** - Optional
- **Retail Rate** - Optional
- **Tax Rate %** - Override global default

#### Inventory
- **Reorder Level** - Alert when stock ≤ this
- **Min Stock Qty** - Critical threshold
- **Active/Inactive** - Toggle availability

### Medicine Units

**Access: Medicines → Units tab**

Pre-configured units: `TAB`, `CAP`, `BOT`, `INJ`, `BOX`, `STRIP`, `SACHET`, `TUBE`, `DROP`, `ML`

Add custom units as needed.

### Manufacturers

**Access: Medicines → Manufacturers tab**

Track manufacturer details for purchasing and reporting.

---

## Supplier Management

### Access: Sidebar → Suppliers

### Supplier List

View all suppliers with:
- Contact info
- Credit limit
- Outstanding balance
- Quick actions

### Supplier Detail

Click a supplier to see:
- **Purchases Tab**: All purchase invoices
- **Payments Tab**: Payment history
- **Outstanding Tab**: Unpaid invoices aging

### Adding a Supplier

1. Click **New Supplier**
2. Enter:
   - Name (required)
   - Contact person, phone, email
   - Address
   - Tax number (NTN/STRN)
   - Credit limit
   - Payment terms (days)
   - Opening balance (if migrating)

### Supplier Payments

1. Go to **Payments** tab in supplier detail
2. Click **New Payment**
3. Select invoices to pay (auto-allocates)
4. Enter amount, method, reference
5. Post payment

---

## Customer & Doctor Management

### Access: Sidebar → Customers

### Customer Types

- **Pharmacy** - Retail pharmacies
- **Hospital** - Hospitals, clinics
- **Doctor** - Individual doctors (for ROI tracking)
- **Distributor** - Other distributors
- **Other** - Custom

### Customer Detail

Tabs:
- **Sales**: All sales invoices
- **Receipts**: Payment history
- **Outstanding**: Aging report
- **Investments**: Doctor investments (ROI)

### Adding a Customer

1. Click **New Customer**
2. Select **Customer Type**
3. For **Doctor** type:
   - Specialty (GP, Physician, Gyne, Peads, etc.)
   - Area/Region
2. Enter contact details
3. Set credit limit and payment terms
4. Opening balance (if migrating)

### Doctor Investment (ROI Tracking)

**For Doctor-type customers:**

1. Go to **Investments** tab
2. Click **Add Investment**
3. Enter:
   - Investment Amount
   - Investment Date
   - ROI % (typically 30% or 35%)
4. System calculates **Expected Sales** = Investment ÷ ROI%
5. Track monthly actual sales vs expected

**Example**: Investment 200,000 PKR at 35% ROI
- Expected Sales = 200,000 ÷ 0.35 = 571,429 PKR
- Monthly sales automatically tracked from invoices
- Balance = Expected - Actual

---

## Purchase Management

### Access: Sidebar → Purchases

### Purchase Invoice List

Filter by: Supplier, Status, Date range
Statuses: **Draft**, **Posted**, **Cancelled**

### Creating a Purchase Invoice

1. Click **New Purchase**
2. **Header**:
   - Supplier (required)
   - Invoice Date
   - Received Date (optional)
   - Due Date
   - Supplier Invoice # (reference)
3. **Line Items** (add multiple):
   - Medicine (search by name/code)
   - Batch Number (required)
   - Manufacturing Date
   - Expiry Date (required)
   - Quantity Received
   - Purchase Unit
   - Conversion Factor
   - Purchase Rate (per unit)
   - Discount % / Amount
   - Tax Rate %
4. **Totals** calculated automatically
5. **Save as Draft** or **Post**

### Posting a Purchase

**Draft → Posted** triggers:
- ✅ Creates/updates medicine batches
- ✅ Increases stock (available quantity)
- ✅ Records inventory movements
- ✅ Creates journal entries (Inventory, Payable, Tax)
- ✅ Updates supplier balance
- ✅ Updates Weighted Average Cost (WAC)

> **Important**: Draft invoices do NOT affect stock or financials.

### Purchase Returns

1. Open original posted purchase invoice
2. Click **Create Return**
3. Select items/batches to return
4. Choose action: **Restock**, **Quarantine**, **Destroy**
5. Post return → Creates credit note, updates stock

### Cash vs Credit Purchases

- **Cash**: Enter amount paid at posting
- **Credit**: Leave amount paid = 0, pay later via Supplier Payments

---

## Sales Management

### Access: Sidebar → Sales

### Sales Invoice List

Filter by: Customer, Status, Date range
Statuses: **Draft**, **Posted**, **Cancelled**

### Creating a Sales Invoice

1. Click **New Sale**
2. **Header**:
   - Customer (required)
   - Invoice Date
   - Due Date
   - Notes
3. **Line Items**:
   - Search medicine
   - **Batch Selection**: System shows eligible batches (FEFO order)
     - Green = OK (>90 days)
     - Blue = 61-90 days
     - Yellow = 31-60 days
     - Orange = 8-30 days
     - Red = ≤7 days / Expired
   - Select batch(es) - auto-allocates FEFO, manual override allowed
   - Quantity (validated against available stock)
   - Sale Unit, Rate, Discount, Tax
4. **Payment** (optional): Collect now or later
5. **Save as Draft** or **Post**

### Posting a Sale

**Draft → Posted** triggers:
- ✅ Validates batch expiry & availability (re-checked at post time)
- ✅ Deducts stock from selected batches
- ✅ Records inventory movements
- ✅ Creates journal entries (Receivable/Cash, Revenue, COGS, Inventory)
- ✅ Updates customer balance
- ✅ Tracks doctor investment recovery
- ✅ Calculates Gross Profit per line

### Sales Restrictions (Enforced)

- ❌ **Expired batches** cannot be sold
- ❌ **Insufficient stock** blocks posting
- ❌ **Quarantined batches** not available
- ⚠️ **Warning** for batches ≤30 days expiry
- ✅ **FEFO** (First Expiry First Out) suggested by default

### Printing Invoices

1. Open posted sales invoice
2. Click **Print** (A4) or **Thermal** (80mm)
3. Print dialog opens with formatted invoice

**Invoice includes:**
- Business info, invoice #, date
- Customer details
- Itemized lines: Medicine, Batch, Expiry, Qty, Rate, Discount, Total
- Subtotal, Discount, Tax, Grand Total
- Payment status, Amount received, Balance

### Sales Returns

1. Open original posted sales invoice
2. Click **Create Return**
3. Select items & quantities (validated against original qty - previous returns)
4. Choose restock action: **Restock**, **Quarantine**, **Destroy**
5. Post return → Credit note, stock restored (if restocked)

---

## Inventory & Expiry Management

### Access: Sidebar → Inventory

### Inventory Summary

Overview cards:
- Total products, batches
- Saleable, quarantined, expired quantities & values
- Near-expiry, low-stock counts

### Batch List

**Filters:** Medicine, Supplier, Status, Expiry range

**Columns:** Medicine, Batch #, Mfg Date, Expiry Date, Qty Available, Unit Cost, Total Value, Supplier, Status, Location

**Statuses:**
- 🟢 **Active** - Saleable
- 🟠 **Quarantined** - Held for review
- 🔴 **Expired** - Past expiry date
- ⚫ **Depleted** - Zero quantity

### Batch Detail

Click a batch to see:
- Complete movement history (purchase, sales, adjustments)
- Purchase invoice links
- Sales invoice links
- Current available quantity

### Expiry Dashboard

**Access: Inventory → Expiring**

Tabs for each tier:
- **Expired** - Past expiry (blocked from sale)
- **Critical (≤7 days)** - Urgent action needed
- **Expiring 30 days** - Priority sales
- **Expiring 60 days** - Accelerate sales
- **Expiring 90 days** - Review

Each shows: Medicine, Batch, Expiry, Days Left, Qty, Value, Supplier

### Low Stock Report

**Access: Inventory → Low Stock**

Medicines where total available ≤ reorder level
Shows: Product, Current Stock, Reorder Level, Value

### Stock Adjustments

For: Damaged goods, physical count corrections, write-offs

1. Click **New Adjustment**
2. Enter reason, reference
3. Add lines: Medicine, Batch (optional), Qty change (+/-)
4. Post → Records movement, updates stock

### Stock Movement History

**Access: Inventory → Movements**

Complete audit trail filterable by:
- Medicine, Batch, Reason, Date range
- Reasons: Purchase, Sale, Return, Adjustment, Expired Write-off, Opening Stock

---

## Financial Management

### Access: Sidebar → Financial

### Cash & Bank Accounts

View balances for:
- **Cash in Hand**
- **Bank Account**
- Real-time from journal entries

### Payments (Receipts & Payments)

#### Customer Receipts
**Access: Financial → Receipts**
1. New Receipt → Select Customer
2. Auto-shows outstanding invoices
3. Allocate amount (full/partial)
4. Method: Cash, Bank, Cheque, Card, UPI
5. Post → Updates receivable, cash/bank

#### Supplier Payments
**Access: Financial → Payments**
1. New Payment → Select Supplier
2. Auto-shows outstanding purchase invoices
3. Allocate, enter method, reference
4. Post → Updates payable, cash/bank

### Expenses

**Access: Financial → Expenses**

Categories: Rent, Salary, Electricity, Fuel, Transport, Telephone, Office, Samples, Marketing, Repairs, Insurance, Legal, Bank Charges, Other

**Add Expense:**
1. Date, Category, Account (Cash/Bank)
2. Amount, Tax (if any)
3. Description, Reference
4. **Optional**: Link to Medicine (for product-level P&L)
5. Post → Journal entry created

### Journal Entries

**Access: Financial → Journal Entries**

View all double-entry postings:
- Auto-generated from transactions
- Manual adjustments
- Filter by date, reference type
- Drill down to lines

### Reconciliation

**Access: Financial → Reconciliation**

Checks:
- Customer ledger vs Receivable control
- Supplier ledger vs Payable control
- Inventory valuation vs Inventory account
- Cash/Bank physical vs book

Discrepancies highlighted for investigation.

---

## Reports

### Access: Sidebar → Reports

All reports support: Date range filter, CSV/Excel export

### Available Reports

| Report | Description |
|--------|-------------|
| **Sales Report** | Daily/monthly/annual with filters |
| **Purchase Report** | By supplier, period |
| **Sales by Medicine** | Product performance |
| **Purchases by Supplier** | Supplier analysis |
| **Sales by Customer** | Customer revenue |
| **Customer Outstanding** | Aging (Current, 1-30, 31-60, 61-90, 90+) |
| **Supplier Outstanding** | Payables aging |
| **Gross Profit** | By product, period, margin % |
| **Operating Expenses** | By category, month |
| **Net Operating Profit** | P&L statement |
| **Inventory Valuation** | Stock at cost (WAC) |
| **Stock Movement** | In/Out by product/batch |
| **Expiring Stock** | Batches expiring within N days |
| **Expired Stock** | Expired batches detail |
| **Purchase Returns** | Return history |
| **Sales Returns** | Return history |
| **Receipts** | Customer payments |
| **Supplier Payments** | Payments made |
| **Cash/Bank Balance** | Account balances |
| **Doctor Investment (ROI)** | Investment vs actual sales |
| **Monthly Summary** | Excel-style P&L |

### Exporting Reports

1. Set filters (date range, customer, product, etc.)
2. Click **Export CSV** or **Export Excel**
3. File downloads with formatted data

---

## Import & Export

### Access: Sidebar → Import & Export

The page has four tabs:

#### Import Data

1. Choose a data type: Medicines, Customers & Doctors, Suppliers, or Imported Sales History.
2. Download the XLSX **Template** if you need the expected columns.
3. Select a CSV/XLSX file and click **Preview**.
4. Review valid/invalid counts, warnings, errors, and the parsed rows.
5. Click **Commit Import**. Existing records are skipped or updated; nothing is duplicated on re-import.

#### Workbook Seed

1. Select `Sale Sheet MA-Na.xlsx`.
2. Click **Preview Workbook** to review month totals, products, investments, and warnings.
3. Click **Commit Workbook** to seed products, opening stock (`OPEN-YYYYMM` batches), customers, doctor investments, doctor/OLX performance, Medicare records, and monthly summaries.

Historical monthly sales are stored as performance records and do **not** create sales invoices or affect stock. OLX distributor totals are customer performance only and are not added to product sales history, avoiding double counting.

#### Export

Click the download button next to any entity to receive a formatted XLSX workbook. Available exports: medicines, customers, suppliers, inventory, sales, purchases, expenses, investments, imported sales history, and month summary.

#### History

Review import runs (source file, type, status, row counts) and imported monthly performance. Re-running an import updates the imported history and leaves existing master data unchanged.

---

## Settings

### Access: Sidebar → Settings → Owner Settings

**Business Information:**
- Name, Address, Phone, Email, Tax Number

**Invoice Settings:**
- Currency (PKR)
- Invoice Prefix (default: INV)
- Purchase Prefix (default: PUR)
- Number Format: `{PREFIX}-{YEAR}-{SEQ:06d}`
- Financial Year Start Month (7 = July)

**Financial:**
- Default Tax Rate %
- Default Payment Terms (days)
- Opening Cash/Bank Balance

### User Profile

**Access: Settings**
- Full Name, Email
- No password or login credentials are required in the single-owner build.

### Application Settings

**Access: Settings → App Settings**
- Expiry alert days (default: 90,60,30,7)
- Block sale before expiry (days)
- Default return action
- Backup reminder threshold

---

## Backup & Maintenance

### Supabase Manual Backup (planned primary method — deferred)

The production database is intended to run on Supabase. Take a manual backup from the Supabase Dashboard (**Database → Backups**) or with `pg_dump` against the Supabase session-mode connection string. The in-app Supabase backup/restore workflow is **not implemented yet**. See `docs/backup-and-restore.md` for the full procedure and test-restore checklist.

### Interim Local Backup

```powershell
# From project root
.\scripts\backup.ps1
```

Options:
- `-BackupDir "E:\Backups"` - Custom location
- `-Compress:$false` - No compression
- `-Encrypt` - GPG encryption
- `-Verify:$false` - Skip verification

### Interim Scheduled Local Backup (Task Scheduler)

1. Task Scheduler → Create Basic Task
2. Daily at 2:00 AM
3. Program: `powershell.exe`
4. Arguments: `-ExecutionPolicy Bypass -File "D:\WALMUS_ERP\scripts\backup.ps1"`
5. Start in: `D:\WALMUS_ERP`

### Restore Procedure (local interim)

**⚠️ Test restore first on separate database!**

```powershell
# 1. Stop application
.\scripts\stop.ps1

# 2. Backup current (safety)
pg_dump -h localhost -U pharma_user -d pharma_erp -Fc -f "pre_restore.dump"

# 3. Restore
pg_restore -h localhost -U pharma_user -d pharma_erp -v "backup_file.dump"

# 4. Run migrations
cd backend && uv run alembic upgrade head

# 5. Restart
.\scripts\start.ps1
```

### Database Maintenance

- **Vacuum**: `psql -U pharma_user -d pharma_erp -c "VACUUM ANALYZE;"`
- **Reindex**: `psql -U pharma_user -d pharma_erp -c "REINDEX DATABASE pharma_erp;"`
- **Check Integrity**: Run reconciliation report monthly

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + D` | Dashboard |
| `Alt + M` | Medicines |
| `Alt + S` | Suppliers |
| `Alt + C` | Customers |
| `Alt + P` | Purchases |
| `Alt + L` | Sales (SeLl) |
| `Alt + I` | Inventory |
| `Alt + F` | Financial |
| `Alt + R` | Reports |
| `Alt + T` | Settings |
| `Ctrl + N` | New record (in list views) |
| `Ctrl + S` | Save form |
| `Ctrl + Enter` | Submit/Post |
| `Esc` | Close dialog / Cancel |
| `/` | Focus search |
| `?` | Show shortcuts help |

---

## Troubleshooting

### Common Issues

#### "Cannot connect to database"
- Check PostgreSQL service is running (`services.msc`)
- Verify `.env` credentials
- Check `pg_hba.conf` allows password auth

#### "Port 8000/3000 already in use"
```powershell
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

#### "Backup failed"
- Check disk space
- Verify pg_dump in PATH
- Check PostgreSQL logs

#### "Invoice posting failed"
- Check batch availability
- Verify expiry dates
- Check for duplicate voucher numbers

#### "Frontend not loading"
- Check backend is running (http://127.0.0.1:8000/health)
- Check browser console (F12) for errors
- Clear browser cache

#### "Migration errors"
```powershell
cd backend
uv run alembic downgrade -1
uv run alembic upgrade head
```

### Logs

- **Backend**: Terminal running uvicorn
- **Frontend**: Browser DevTools Console (F12)
- **Database**: PostgreSQL logs in `data/log/`

### Getting Help

1. Check this manual
2. Review API docs: http://127.0.0.1:8000/docs
3. Check GitHub issues (if applicable)
4. Contact system administrator

---

## Business Workflow Examples

### Example 1: Monthly Purchase Cycle

1. **Review Stock** → Dashboard → Low Stock / Expiring
2. **Create Purchase Orders** → Purchases → New (Draft)
3. **Receive Goods** → Update received date, verify batches
4. **Post Purchases** → Stock updated, payables created
5. **Pay Suppliers** → Financial → Payments (as per terms)

### Example 2: Daily Sales Operations

1. **Create Sales** → Sales → New
2. **Select Batches** → System suggests FEFO
3. **Collect Payment** → Cash/Partial/Credit
4. **Post Sale** → Stock deducted, COGS recorded
5. **Print Invoice** → Give to customer

### Example 3: Month-End Closing

1. **Reconcile** → Financial → Reconciliation
2. **Review Expenses** → Financial → Expenses
3. **Run Reports** → Reports → Monthly Summary
4. **Check Expiry** → Inventory → Expiring
5. **Backup** → manual Supabase backup when hosted there; interim local fallback `.\scripts\backup.ps1`

### Example 4: Handling Expired Stock

1. **Identify** → Inventory → Expired
2. **Quarantine** → Batch Detail → Change status
3. **Return to Supplier** → Purchase Return (if eligible)
4. **Write-off** → Stock Adjustment → Destroy
5. **Record Loss** → Automatic journal entry

---

## Appendix: Data Fields Reference

### Medicine Master Fields

| Field | Required | Description |
|-------|----------|-------------|
| Product Code | Yes | Unique SKU |
| Barcode | No | Scan code |
| Name | Yes | Brand/Trade name |
| Generic Name | No | Salt name |
| Manufacturer | No | Linked manufacturer |
| Strength | No | e.g., 400mg |
| Dosage Form | No | Tablet, Syrup, etc. |
| Packing | No | e.g., 10x10 |
| Base Unit | Yes | Smallest unit |
| Units/Pack | Yes | Base units per pack |
| Purchase Unit | No | Buying unit |
| Purchase Conv | Yes | To base units |
| Sale Unit | No | Selling unit |
| Sale Conv | Yes | To base units |
| Purchase Rate | No | Default buy price |
| Sale Rate | No | Default sell price |
| Wholesale Rate | No | Bulk price |
| Retail Rate | No | MRP |
| Tax Rate | No | % override |
| Reorder Level | No | Alert threshold |
| Min Stock | No | Critical level |

### Batch Fields

| Field | Required | Description |
|-------|----------|-------------|
| Medicine | Yes | Linked product |
| Batch Number | Yes | Manufacturer's batch |
| Mfg Date | No | Manufacturing date |
| Expiry Date | Yes | Expiry (blocks sale after) |
| Supplier | No | Source supplier |
| Received Qty | Yes | In base units |
| Available Qty | Auto | Current stock |
| Cost/Unit | Yes | Purchase cost (base) |
| Status | Auto | Active/Quarantined/Expired |
| Location | No | Warehouse location |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-15 | Initial release |

---

**Walmus Pharma ERP v1.0.0**  
*Self-hosted Pharmaceutical ERP for Local Deployment*  
*Secure • Private • Offline-Capable*