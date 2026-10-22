# Product Requirements Document (PRD)
# Self-Hosted Pharmaceutical ERP and Business Management System

**Project type:** Full-stack, locally hosted business application  
**Version:** 1.1  
**Status:** Implemented specification (single-owner, no-login build)  
**Primary user:** Business owner  
**Frontend:** Next.js with TypeScript  
**Backend:** Python with FastAPI  
**Database:** PostgreSQL  
**Python package manager:** uv  
**Deployment:** Local computer, no cloud dependency  
**Currency:** PKR (Pakistani Rupee) by default

---

## 1. Product Overview

### 1.1 Purpose

The purpose of this project is to develop a complete pharmaceutical business management system that replaces manual Excel-based workflows with a centralized, reliable, database-driven application.

The owner purchases medicines from distributors, manages batches and expiry dates, sells medicines to customers, creates invoices, records payments, manages expenses, invests in or provides documented financial support to doctors or other healthcare-related business contacts where legally permitted, and monitors business performance.

The application will consolidate these activities into a single interface.

### 1.2 Problem Statement

The current workflow relies on multiple Excel worksheets to manage:

- Medicine purchases and sales.
- Opening stock and stock movement.
- Distributor purchase details.
- Customer and doctor-related transactions.
- Investment amounts and expected sales.
- Monthly sales tracking.
- Expenses, discounts, and balances.
- Monthly business summaries.

This approach creates risks of duplicated entries, incorrect calculations, inconsistent balances, limited traceability, and difficulty identifying medicines approaching expiry.

The application must centralize these records and calculate business figures from their underlying transactions.

### 1.3 Product Vision

Build a dependable, easy-to-use pharmaceutical ERP that enables one owner to understand the complete financial and operational position of the business at any time.

The owner should be able to answer questions such as:

- How much stock do I currently have?
- Which medicine batches are expiring soon?
- How much money have I invested in each doctor-related business arrangement?
- How much has been recovered, and how much remains outstanding?
- What sales have been recorded against each doctor or business contact?
- Which products generate the most gross profit?
- How much money do distributors owe me, and how much do I owe them?
- What is the actual profit after expenses?
- Which investments or business arrangements are performing according to their recorded targets?

---

## 2. Goals and Non-Goals

### 2.1 Product Goals

1. Replace the existing Excel workflow with structured data management.
2. Maintain accurate medicine inventory at batch level.
3. Record purchase and sales invoices with complete transaction histories.
4. Track medicine manufacturing and expiry dates.
5. Manage customer receipts, supplier payments, and expenses.
6. Provide a dedicated doctor investment and ROI tracking module.
7. Produce accurate monthly and annual business reports.
8. Maintain reliable financial and inventory records.
9. Operate locally on one computer under the control of one owner.
10. Provide dependable backups and recovery procedures.

### 2.2 Non-Goals for Version 1

The initial release will not include:

- Public cloud hosting or SaaS subscriptions.
- Multi-tenant functionality.
- Multiple employee accounts or a complex role-based permission system.
- A customer-facing e-commerce website.
- Online payment gateway integration.
- Mobile applications.
- AI-powered forecasting as a required feature.
- Automatic synchronization with distributor systems.
- Direct integration with hospital or government systems.
- Automatic prescribing or prescription recommendation features.
- Automatic financial payments to doctors or other contacts.
- Any mechanism for rewarding prescribing decisions or referrals.

Future versions may introduce additional functionality after the core application is stable.

---

## 3. Target User and Operating Environment

### 3.1 Primary User

**Business owner**

The owner is the only user of the system. The application is operated directly from the owner's local computer and does not require a login, user account, password, or session. The owner is responsible for:

- Configuring the business.
- Managing medicines, batches, and stock.
- Recording purchases and sales.
- Managing suppliers and customers.
- Recording doctor-related investments and recoveries.
- Entering expenses and payments.
- Reviewing reports.
- Maintaining backups.

### 3.2 Deployment Requirements

The application must:

- Run on the owner's local computer.
- Use a locally installed PostgreSQL database.
- Start through a documented command or Windows PowerShell script.
- Continue to work without an internet connection after installation, apart from optional updates or other explicitly configured external services.
- Store business records persistently.
- Restart safely after a computer shutdown.
- Keep the PostgreSQL database inaccessible from the public internet.
- Default to localhost access.

The application may be designed so that local-network access can be enabled in a later release, but it must not be exposed by default.

---

## 4. Product Architecture

### 4.1 Frontend

Use Next.js with TypeScript and the App Router.

Responsibilities:

- Dashboard and navigation.
- Data entry forms.
- Invoice creation and printing.
- Inventory and batch management.
- Doctor investment tracking.
- Financial reports.
- Search, sorting, filtering, and exports.
- Validation feedback and confirmation dialogs.

### 4.2 Backend

Use Python and FastAPI.

Responsibilities:

- Business logic.
- Invoice calculations.
- Inventory movement validation.
- Batch and expiry validation.
- Investment and recovery calculations.
- Accounting and balance calculations.
- Report generation.
- Excel/CSV import, validation, preview, and export.
- Database transaction handling.
- Local single-owner operation without authentication or session management.

### 4.3 Database

Use PostgreSQL with SQLAlchemy and Alembic.

Responsibilities:

- Persistent business records.
- Relational integrity.
- Unique invoice numbers.
- Transaction history.
- Financial records.
- Inventory movements.
- Audit logs.
- Database migrations.

Use `uv` for Python dependencies and environment management.

### 4.4 Architecture Rules

- The frontend must never connect directly to PostgreSQL.
- All business operations must pass through the FastAPI backend.
- Financial and inventory changes must be performed transactionally.
- All monetary values must use appropriate decimal or PostgreSQL `NUMERIC` types.
- Historical invoices must preserve the prices and discounts used when they were posted.
- Reports must be calculated from actual persisted records.
- Database migrations must preserve existing business data.

---

## 5. Functional Requirements

### Module 1: Initial Setup and Business Configuration

**Objective:** Prepare the application for use by the owner.

Requirements:

- Provide an in-app business settings page for initial configuration (no first-run login wizard).
- Configure business name, address, contact details, and invoice information.
- Set currency and financial reporting preferences.
- Configure invoice numbering.
- Define default payment methods.
- Configure expense categories.
- Configure expiry alert thresholds.
- Import opening stock and opening balances.
- Configure medicine units and pack conversions.
- Initialize a single local owner/business profile without creating login credentials.
- Optionally seed the system from the existing `Sale Sheet MA-Na.xlsx` workbook.
- Store settings persistently.

**Acceptance criteria**

- The owner can complete initial setup without editing source code or creating a password.
- The application cannot accidentally initialize a second unrelated business dataset over existing data.
- Initial stock and financial balances can be reconciled against their source records.
- Re-running the workbook seed does not duplicate master data, opening batches, investments, or expenses.

### Module 2: Medicine Master

**Objective:** Maintain a centralized catalogue of medicines.

Each medicine must support:

- Product ID.
- Product code or SKU.
- Optional barcode.
- Brand or product name.
- Generic name.
- Manufacturer.
- Strength.
- Dosage form.
- Packing description.
- Base unit.
- Units per pack.
- Default purchase rate.
- Default sale rate.
- Optional wholesale and retail prices.
- Tax configuration where applicable.
- Reorder threshold.
- Active or inactive status.
- Notes.

Requirements:

- Search by product name, code, or barcode.
- Prevent duplicate product codes.
- Support configurable unit conversions.
- Maintain purchase and sales prices separately.
- Keep product master records separate from individual batches.

**Acceptance criteria**

- A medicine can have multiple batches.
- Updating a default sale price does not change prices on historical invoices.
- Unit conversions produce consistent quantities and amounts.

### Module 3: Supplier and Distributor Management

**Objective:** Maintain supplier information and financial relationships.

Requirements:

- Create, edit, and search supplier records.
- Record contact details and business information.
- Record opening payable balances.
- View purchase invoices and returns.
- Record payments made.
- Calculate outstanding payables.
- Display supplier transaction history.
- Filter by date and payment status.

**Acceptance criteria**

The supplier balance must reconcile with opening balances, posted purchases, purchase returns, payments, and other explicitly recorded adjustments.

### Module 4: Purchase Management

**Objective:** Record medicine purchases and update inventory.

Each purchase invoice must contain:

- Internal invoice ID.
- Unique purchase voucher number.
- Supplier invoice number.
- Supplier.
- Invoice date.
- Goods receipt date.
- Due date, if applicable.
- Invoice status.
- Medicine lines.
- Batch numbers and expiry dates.
- Quantities and units.
- Purchase rates.
- Discounts and applicable taxes.
- Invoice total.
- Amount paid.
- Outstanding balance.

Requirements:

- Support cash and credit purchases.
- Support partial payments.
- Allow drafts before posting.
- Update inventory only when the purchase is confirmed.
- Create inventory movements for received quantities.
- Update supplier balances.
- Preserve supplier invoice references.
- Support purchase returns and credit notes.

**Acceptance criteria**

Posting a purchase increases the correct batch quantities and records the corresponding supplier liability or payment. Draft invoices must not affect stock or financial balances.

### Module 5: Batch and Expiry Management

**Objective:** Track medicine stock by individual batch and prevent expired stock from being sold.

Each batch must contain:

- Medicine ID.
- Batch number.
- Manufacturing date, if available.
- Expiry date.
- Purchase invoice reference.
- Supplier.
- Received quantity.
- Available quantity.
- Purchase cost.
- Batch status.

Required features:

- Batch-level stock tracking.
- Expiry alerts at configurable intervals.
- Expired stock reports.
- Near-expiry stock valuation.
- Quarantine for expired or damaged stock.
- Supplier return tracking.
- Stock adjustments with reasons.
- FEFO batch selection.
- Batch movement history.

The application must prevent the sale of expired, quarantined, or unavailable quantities.

**Acceptance criteria**

- An expired batch cannot be posted on a sales invoice.
- A near-expiry alert includes the medicine, batch, expiry date, available quantity, and estimated cost value.
- Stock movements can be traced to the relevant purchase, sale, return, or adjustment.
- Expired stock is excluded from saleable inventory.

### Module 6: Sales and Invoicing

**Objective:** Create sales invoices and manage customer balances.

Requirements:

- Create and manage customer records.
- Create sales invoices.
- Select eligible medicine batches.
- Use FEFO as the default batch-selection strategy.
- Calculate line totals, discounts, taxes, and invoice totals.
- Support cash and credit sales.
- Record partial and complete customer payments.
- Print invoices.
- Support sales returns and credit notes.
- Track customer receivables.

**Acceptance criteria**

Posting a sales invoice deducts stock from the correct batches, records sales revenue and cost of goods sold, and updates the customer balance and payment records correctly.

The same invoice cannot be posted twice.

### Module 7: Doctor Investment and ROI Management

**Priority:** Core business module.

**Objective:** Record, monitor, and report investments or documented financial arrangements associated with doctors and other relevant business contacts.

The existing ROI worksheet must be used as a reference for field names and reporting expectations.

The initial worksheet contains fields for doctor or organization name, specialty, area, investment amount, investment date, expected sales, and monthly sales figures.

The software must extend this workflow into a structured transaction-based module.

#### 7.1 Doctor or Contact Profile

Each record must support:

- Unique record ID.
- Doctor or organization name.
- Specialty or designation.
- Area or location.
- Contact details, if required.
- Date the relationship was established.
- Notes.
- Active or inactive status.
- Related investment records.
- Related sales records, where applicable.
- Related financial transactions.

The system should support hospitals, clinics, and other configured business contacts where relevant.

#### 7.2 Investment Record

Each investment must have its own record.

Fields:

- Investment ID.
- Doctor or contact.
- Investment date.
- Investment amount.
- Investment category.
- Purpose or description.
- Payment method.
- Source cash or bank account.
- Reference number.
- Expected sales target, if applicable.
- Expected recovery date, if applicable.
- Agreement or supporting document reference.
- Current status.
- Notes.

Investment categories may include documented recoverable advances, approved business arrangements, lawful research or educational support, or other categories explicitly configured by the owner.

The application must not assume that all investments are recoverable loans or that all are expenses. The accounting treatment must be specified for each category.

#### 7.3 Investment Transactions

Support multiple transactions against a single investment.

Transaction types may include:

- Initial disbursement.
- Additional disbursement.
- Recovery or repayment.
- Approved adjustment.
- Write-off.
- Reversal of an incorrect entry.

Each transaction must record its date, amount, payment account, reference, notes, and linked investment.

Posted transactions must not be deleted silently. Corrections must use reversal or adjustment entries.

#### 7.4 Investment Balance

For recoverable investments, calculate:

**Outstanding principal = Total disbursements - Principal recovered - Approved principal reductions**

Display:

- Original investment.
- Additional disbursements.
- Total amount disbursed.
- Total amount recovered.
- Approved reductions.
- Outstanding principal.
- Recovery percentage.
- Days since investment.
- Last transaction date.

Do not include unrelated sales revenue in the recovery calculation unless an explicit, documented allocation links that revenue to the investment.

#### 7.5 Expected Sales and Actual Monthly Sales

Allow the owner to set expected sales for each relevant doctor or business contact.

Requirements:

- Monthly sales targets.
- Actual sales for each month.
- Yearly sales totals.
- Variance between target and actual sales.
- Percentage of target achieved.
- Historical performance.
- Date-range filtering.
- Notes explaining significant changes.

**Target variance = Actual sales - Target sales**

**Target achievement (%) = Actual sales ÷ Target sales × 100**

If the target is zero or missing, display the percentage as unavailable rather than dividing by zero.

Actual sales must be linked to posted sales transactions or explicitly imported historical records. Do not count draft or cancelled invoices.

The system must clearly distinguish sales associated with a contact from money recovered against an investment.

#### 7.6 Investment ROI

Provide investment performance metrics, with definitions shown in the interface.

Where attributable financial returns and a valid investment basis are available:

**ROI (%) = (Attributable net return ÷ Investment cost basis) × 100**

The system must not automatically treat sales revenue as profit or as a return on investment.

For investments where net return cannot be calculated reliably, display sales performance, outstanding balance, and recovery information separately instead of inventing an ROI percentage.

If the owner defines an expected-sales ratio based on a percentage in the existing workbook, store that as a separate, explicitly named business metric. Do not label it ROI unless its meaning is established.

#### 7.7 Doctor Investment Dashboard

Display:

- Total amount invested.
- Total outstanding recoverable principal.
- Total recovered amount.
- Number of active investments.
- Investments approaching their expected recovery date.
- Monthly sales against targets.
- Highest and lowest sales target achievement.
- Investment transaction history.
- Sales performance by doctor or organization.
- Investment performance by area.
- Historical monthly and annual summaries.

Provide filters by doctor, area, investment category, status, date range, and reporting year.

#### 7.8 Investment Reports

Generate:

- Individual investment statements.
- Doctor-wise investment summaries.
- Monthly sales versus targets.
- Annual sales performance.
- Recoveries and outstanding principal.
- Investment aging.
- Investment transaction history.
- ROI reports where the required financial data exists.
- Exportable CSV and Excel reports.

#### 7.9 Financial Integration

Investment transactions must integrate with the financial system.

For example, when the owner disburses a recoverable advance from a bank account:

- The bank balance decreases.
- The investment receivable increases.
- The transaction is linked to the relevant investment.
- The transaction appears in the account ledger.
- The outstanding investment balance updates.

When principal is recovered:

- The bank or cash balance increases.
- The investment receivable decreases.
- The transaction is linked to the original investment.
- Recovery reports update automatically.

For a non-recoverable approved expense, the system must apply the configured expense treatment instead of creating a recoverable balance.

The same transaction must never be counted twice.

#### 7.10 Compliance and Controls

The module is intended for transparent business recordkeeping and lawful arrangements.

- Require a documented purpose and category for each disbursement.
- Support storing relevant agreements and receipts.
- Provide transaction history and auditability.
- Allow the owner to flag transactions requiring compliance review.
- Do not create or automate payments, rewards, or benefits in exchange for prescriptions, referrals, or preferential medicine recommendations.
- Require the owner to classify arrangements according to applicable laws and professional requirements before posting them.

**Acceptance criteria**

The owner can create an investment, record multiple disbursements and recoveries, define monthly sales targets, view actual associated sales, calculate outstanding balances, and generate a complete investment statement without confusing sales revenue with investment recovery.

### Module 8: Payments and Financial Accounts

**Objective:** Maintain accurate cash, bank, receivable, and payable balances.

Requirements:

- Create cash and bank accounts.
- Record opening balances.
- Record customer receipts.
- Record supplier payments.
- Record investment disbursements and recoveries.
- Record transfers between accounts.
- Link payments to invoices or investments.
- Support partial payments.
- Prevent duplicate payment records.
- Provide account transaction statements.

Cash and bank balances must be calculated from opening balances and posted financial movements.

Transfers between accounts must not be counted as income or expenses.

### Module 9: Expense Management

**Objective:** Track business expenses separately from inventory purchases and financial transfers.

Requirements:

- Create expense categories.
- Record expense date and amount.
- Select the payment account.
- Add a description and reference.
- Attach supporting documents where practical.
- View monthly and annual expenses.
- Filter expenses by category.
- Export expense reports.

The system must distinguish operating expenses from inventory purchases, recoverable advances, capital expenditure, and transfers between accounts.

### Module 10: Dashboard and Business Analytics

**Objective:** Provide a consolidated view of business operations.

The main dashboard must include:

- Today's sales.
- Monthly sales.
- Monthly purchases.
- Gross profit.
- Operating expenses.
- Net operating profit.
- Cash and bank balances.
- Customer receivables.
- Supplier payables.
- Saleable stock value.
- Low-stock products.
- Near-expiry batches.
- Expired stock value.
- Total doctor-related recoverable investment.
- Total investment recovery.
- Monthly sales against doctor-related targets.

Provide charts for:

- Monthly sales and purchases.
- Gross profit trends.
- Expense categories.
- Inventory movement.
- Expiry distribution.
- Sales target achievement.
- Investment recovery trends.

All metrics must be derived from database transactions and have clearly documented definitions.

### Module 11: Reports and Data Export

Provide date filters and reporting periods for:

- Daily, monthly, and annual sales.
- Purchase history.
- Sales by medicine.
- Sales by customer or contact.
- Purchases by supplier.
- Inventory valuation.
- Stock movement.
- Expiring and expired stock.
- Gross profit and operating profit.
- Customer receivables.
- Supplier payables.
- Account statements.
- Expenses.
- Doctor investments and recoveries.
- Sales targets and actual sales.
- Investment aging.
- Monthly and annual business summaries.

Export requirements:

- Provide XLSX workbooks for medicines, customers, suppliers, inventory, sales, purchases, expenses, investments, imported sales history, and monthly summaries.
- Provide CSV exports for report views (sales, purchases, profit, inventory, expiry, doctor investments, monthly summary).
- Exports must never include another business dataset and must reflect committed data only.
- Historical imported data must be distinguishable from newly recorded transactions.

Import requirements:

- Provide an Import & Export page with separate workflows for entity import, full-workbook seed, export, and history.
- Support CSV and XLSX uploads with a preview/validation step before commit.
- Imported rows must be idempotent: re-importing the same file must update or skip existing records rather than duplicating them.
- Record every import run (source file, row counts, status, summary, errors) for traceability.
- Provide downloadable XLSX templates for each import entity.

### Module 12: Backup and Recovery

The production database is intended to run on Supabase (managed PostgreSQL). The backup requirement is therefore a manual Supabase backup performed by the owner.

Requirements:

- Document how to take a manual Supabase backup (Dashboard database export / `pg_dump` against the Supabase connection string).
- Document how to restore a Supabase backup into a test project before replacing production data.
- Provide an XLSX exporter inside the application for business-level data copies (medicines, inventory, invoices, imported history, and reports).
- Require explicit confirmation before any destructive restore.
- Keep the Supabase service-role key and database credentials in environment variables and out of source control.
- Preserve data across restarts and system shutdowns.

**Implementation status:** Deferred. The in-application Supabase backup/restore workflow is not implemented in the current increment. The existing local `pg_dump` scripts and Backup & Recovery page remain available as an interim local fallback but are not the long-term Supabase backup mechanism. See `docs/backup-and-restore.md`.

---

## 6. Data Model Requirements

The following entities are expected. The final normalized schema may introduce additional tables.

| Entity | Purpose |
|---|---|
| `owner_settings` | Business profile and application configuration |
| `medicines` | Medicine master catalogue |
| `manufacturers` | Manufacturer information |
| `medicine_units` | Unit conversions |
| `medicine_batches` | Batch numbers, expiry dates, quantities, and costs |
| `suppliers` | Distributor and supplier records |
| `customers` | Customer profiles |
| `purchase_invoices` | Purchase headers |
| `purchase_invoice_items` | Purchase line items |
| `sales_invoices` | Sales headers |
| `sales_invoice_items` | Sales line items |
| `inventory_movements` | Immutable stock movement history |
| `stock_adjustments` | Approved stock corrections |
| `purchase_returns` | Supplier returns |
| `sales_returns` | Customer returns |
| `financial_accounts` | Cash and bank accounts |
| `payments` | Incoming and outgoing payments |
| `payment_allocations` | Payment amounts allocated to invoices or balances |
| `expenses` | Operating expense records |
| `expense_categories` | Expense classification |
| `business_contacts` | Doctors, hospitals, clinics, and other relevant contacts |
| `investments` | Investment or financial arrangement records |
| `investment_transactions` | Disbursements, recoveries, adjustments, and reversals |
| `sales_targets` | Monthly and annual performance targets |
| `sales_attributions` | Explicit links between sales and relevant contacts |
| `journal_entries` | Accounting journal headers, if double-entry accounting is implemented |
| `journal_entry_lines` | Balanced debit and credit lines |
| `audit_logs` | Record of important system actions |
| `import_batches` | One row per import run, with source file, status, row counts, and errors |
| `imported_sales_history` | Product-month historical sales, purchase, profit, and closing quantity |
| `imported_month_summary` | Month-wise historical totals used in reports |
| `imported_customer_performance` | Doctor and OLX monthly performance imported from the workbook |

### Data Integrity

- Use primary and foreign keys.
- Use unique constraints for product codes and invoice numbers.
- Use appropriate `NUMERIC` types for money.
- Use explicit statuses for draft and posted transactions.
- Maintain timestamps and transaction references.
- Preserve historical invoice values.
- Prevent deletion of referenced posted transactions.
- Use database transactions for all multi-record business operations.
- Maintain an audit trail for material financial and inventory changes.

---

## 7. Accounting and Calculation Rules

The application must use a consistent accounting model.

### Sales

Net Sales = Gross Sales - Sales Discounts - Sales Returns, subject to the defined treatment of applicable taxes.

### Gross Profit

Gross Profit = Net Sales Revenue - Cost of Goods Sold.

### Operating Profit

Operating Profit = Gross Profit - Operating Expenses.

### Customer Receivables

Outstanding Receivables = Opening Receivables + Posted Credit Sales - Allocated Receipts - Approved Credit Notes and Adjustments.

### Supplier Payables

Outstanding Payables = Opening Payables + Posted Credit Purchases - Allocated Supplier Payments - Approved Supplier Credits and Adjustments.

### Recoverable Investment

Outstanding Principal = Opening Principal + Additional Disbursements - Principal Recoveries - Approved Principal Reductions.

### Inventory

Available Stock = Opening Stock + Posted Receipts - Posted Sales - Returns Out - Approved Write-offs and Other Stock Movements, with saleable and quarantined quantities tracked separately.

All formulas must be implemented consistently in backend services and verified with automated tests.

---

## 8. Access Control and Data Protection

Version 1 is a single-owner, locally operated system. Authentication is not required: the application opens directly into the business workspace, and the owner is the only operator. Protection relies on the operating-system user account, localhost-only network binding, and database credentials rather than an application login.

Requirements:

- No login, registration, password reset, or session-management flow in Version 1.
- No public registration endpoint and no user-facing account administration.
- Server-side validation for every write operation; frontend validation is supplementary.
- Database credentials and Supabase keys stored in environment variables, never committed to source control.
- PostgreSQL/Supabase accessible only to the application and authorized local administration; no public network binding by default.
- Audit logs for posted transactions, reversals, imports, and material settings changes.
- Confirmation before irreversible or high-impact operations.
- No unnecessary transmission of business records to external services.

If the application is later exposed to a local network or the internet, authentication and transport security must be added before exposure. Security controls must never depend solely on hiding buttons in the frontend.

---

## 9. Non-Functional Requirements

### Performance

- Common dashboard views should load quickly with realistic business data.
- Search and filtering must remain usable as the database grows.
- Use indexes for frequently queried fields, including product codes, batch numbers, invoice dates, and expiry dates.

### Reliability

- Financial and inventory operations must be atomic.
- Duplicate submissions must not create duplicate transactions.
- Failed transactions must roll back completely.
- The application must recover safely after restart.

### Maintainability

- Keep frontend, backend, and database logic separate.
- Use reusable components and backend services.
- Maintain migration files and automated tests.
- Document configuration and business rules.

### Usability

- Prioritize desktop data entry.
- Use clear forms and validation messages.
- Provide keyboard-friendly invoice entry.
- Use consistent date, quantity, and currency formats.
- Highlight expiry and balance warnings clearly.

---

## 10. User Interface Structure

The main navigation should contain:

1. Dashboard
2. Medicines
3. Inventory and Batches
4. Purchases
5. Sales and Invoices
6. Suppliers
7. Customers and Business Contacts
8. Doctor Investments and ROI
9. Payments and Accounts
10. Expenses
11. Reports
12. Import & Export
13. Settings
14. Backup and Recovery

The doctor investment module must have its own dashboard, list view, detail page, transaction history, monthly performance view, and printable statement.

The design should use a professional, restrained color palette, clear typography, consistent spacing, and prominent warnings for expired medicines and overdue balances.

---

## 11. Importing Existing Excel Data

The source workbook is `Sale Sheet MA-Na.xlsx` in the project root. It contains 24 monthly blocks (November 2024 through October 2026), 37 products, 434 product-month rows, doctor investment records, OLX distributor totals, and Medicare items.

Implemented import workflow:

1. **Entity import** — CSV/XLSX upload for medicines, customers, suppliers, and sales history.
2. **Preview** — parse the file, report headers/sheet/row counts, validate required fields and numeric/date values, detect duplicate keys, and display the first 100 parsed rows before anything is saved.
3. **Commit** — apply validated rows in a single database transaction and record an import batch with imported/skipped/failed counts.
4. **Workbook seed** — parse the full `Sale Sheet MA-Na.xlsx` structure and seed master data, opening stock, investments, doctor performance, OLX performance, Medicare items, and monthly summaries.
5. **History** — list import runs and month-wise totals, and expose the imported sales history through reports.

Workbook seed rules:

- Products are matched by product code or normalized name; existing master records are reused/skipped rather than duplicated.
- One opening-stock batch is created per product from its latest workbook closing balance, using batch number `OPEN-YYYYMM` and the workbook purchase rate.
- Historical monthly sales are imported as performance records only; they do not create sales invoices.
- Doctor investment amounts and monthly performance are imported into the doctor ROI module.
- OLX distributor totals are stored as customer performance only and are not added to product sales history, avoiding double counting.
- Medicare items are stored in the import summary.
- Re-running the seed is idempotent: existing sales-history rows are updated, and existing master data, batches, investments, and expenses are not duplicated.

The import tool always requires a preview before commit. Invalid rows are reported with row numbers and messages; valid rows can still be committed when the owner accepts the partial import.

---

## 12. Development Phases

### Phase 1: Discovery and Requirements

- Inspect the complete Excel workbook.
- Document existing formulas and business rules.
- Define the investment and recovery workflow.
- Resolve ambiguous accounting calculations.
- Finalize the database schema.
- Document expiry and inventory rules.

### Phase 2: Application Foundation

- Create the monorepo.
- Configure Next.js, FastAPI, PostgreSQL, and `uv`.
- Add migrations.
- Create the single-owner local workspace (no login or user accounts).
- Create shared layout and navigation.
- Add logging and error handling.

### Phase 3: Master Data and Inventory

- Medicine catalogue.
- Unit conversions.
- Suppliers and customers.
- Batch-level inventory.
- Expiry alerts.
- Opening stock.
- Stock movement history.

### Phase 4: Purchases and Sales

- Purchase invoices.
- Sales invoices.
- Batch allocation.
- Payments.
- Returns.
- Printable invoices.

### Phase 5: Financial Management

- Cash and bank accounts.
- Customer receivables.
- Supplier payables.
- Expenses.
- Investment disbursements and recoveries.
- Financial reconciliation.

### Phase 6: Doctor Investment and ROI

- Business contact profiles.
- Investment records.
- Investment transactions.
- Monthly sales targets.
- Actual sales attribution.
- Outstanding investment calculations.
- Performance dashboards and reports.

### Phase 7: Reporting and Analytics

- Dashboard metrics.
- Financial reports.
- Inventory reports.
- Expiry reports.
- Investment reports.
- Excel and CSV exports.

### Phase 8: Import, Testing, and Deployment

- Excel import, workbook seed, and reconciliation.
- Automated tests.
- End-to-end workflow testing.
- Windows startup scripts and interim local backup scripts.
- Supabase manual backup/restore documentation (implementation deferred).
- User documentation.

---

## 13. Acceptance Criteria

The project is ready for initial production use when all of the following are verified.

1. The owner can install and run the application locally.
2. The owner can open the application directly into the dashboard without a login step.
3. The owner can create medicines, suppliers, and customers.
4. The owner can record purchases containing multiple medicine batches and expiry dates.
5. The system updates stock and supplier balances correctly.
6. Expired and quarantined stock cannot be sold.
7. The owner can create and print sales invoices.
8. The system calculates sales revenue and cost of goods sold correctly.
9. The owner can record customer receipts, supplier payments, and expenses.
10. The owner can create a doctor-related investment record.
11. The owner can record multiple disbursements and recoveries against that investment.
12. The system calculates outstanding recoverable principal correctly.
13. The owner can define monthly sales targets and view actual sales linked to the relevant contact.
14. The system distinguishes sales performance, cash recovery, profit, and investment balance.
15. Monthly and annual reports reconcile with posted transactions.
16. The owner can import entity data and seed the full workbook with a preview, validation report, and idempotent commit.
17. The owner can export XLSX workbooks for master data, transactions, imported history, and monthly summaries.
18. Supabase backup and restore are documented; the automated in-app backup workflow is explicitly marked deferred.
19. Existing local backup scripts remain available as an interim fallback.
20. Automated tests pass for the implemented critical workflows (health, inventory/expiry, import validation); invoice, financial, and investment coverage must be expanded before final sign-off.
21. The application works without requiring cloud hosting.
22. No core feature is presented as complete while still relying on mock data.

---

## 14. Final Deliverables

The development team or coding agent must deliver:

- Complete Next.js frontend.
- Complete Python FastAPI backend.
- PostgreSQL schema and migrations.
- Database seed or initial setup mechanism, including the `Sale Sheet MA-Na.xlsx` workbook seed.
- Single-owner local workspace with no login requirement.
- Medicine and batch management.
- Purchase and sales workflows.
- Expiry management.
- Doctor investment and ROI module.
- Financial accounts and expense management.
- Dashboard and reports.
- Excel/CSV import tools with preview, validation, templates, and import history.
- XLSX exports for master data, transactions, imported history, and reports.
- Automated tests.
- Windows startup scripts and interim local backup scripts.
- Supabase manual backup/restore documentation (implementation deferred).
- Environment configuration template.
- Installation guide.
- Database schema documentation.
- Accounting rules documentation.
- User manual.
- Backup and recovery guide.
- Implementation status report.

## 15. Final Product Principle

The system must be built around reliable transactions, not spreadsheet-style manual balances.

Every important figure displayed to the owner must be traceable to the underlying records.

Medicine stock must be traceable to batches and expiry dates. Financial balances must be traceable to posted transactions. Doctor-related investments must be traceable to disbursements, recoveries, documented arrangements, and associated business performance.

The final product must be practical for one owner to operate independently on a local computer while maintaining accurate, auditable business records.