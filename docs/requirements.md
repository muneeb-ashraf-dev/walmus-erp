# Walmus Pharma ERP - Requirements & Data Mapping Document

## 1. Source Workbook Analysis

### 1.1 Worksheets Overview

| Worksheet | Purpose | Key Data |
|-----------|---------|----------|
| **Sales Sheet** | Primary inventory, purchase, sales, and profit tracking | Monthly product tracking, purchase/sales units & rates, customer-wise sales, expenses, profit calculation |
| **ROI Sheet** | Doctor/Customer investment & sales tracking | Investment per doctor, expected sales (ROI%), monthly actual sales, balance tracking |
| **OLX** | Distributor sales report | Dealer-wise product sales from external distributor (MA Distributor) |
| **Sheet2** | Balance Sheet summary | Customer-wise sales, credit, discount, expenses, profit |
| **Sheet1** | Monthly P&L summary | Total sale, discount %, discount amount, expense, running balance |

---

## 2. Sales Sheet - Detailed Analysis

### 2.1 Structure
The Sales Sheet contains **monthly blocks** (November 2024, December 2024, January 2025, etc.) stacked vertically. Each month block has:

#### Left Section: Purchase & Inventory Tracking
| Column | Header | Formula/Logic | Description |
|--------|--------|---------------|-------------|
| A | S.No. | Sequential | Row number |
| B | Products | Text | Medicine/Product name |
| C | Purchase U | Numeric/Formula | Purchase Units (opening stock + new purchases) |
| D | Purchase R | Numeric | Purchase Rate per unit |
| E | Purchase S | =C*D | Purchase Subtotal (Cost) |
| F-I | 1st, 2nd, 3rd, 4th | Numeric | Sales quantities to 4 different customers/channels |
| N | T.P | Numeric | Trade Price / Sale Rate per unit |
| O | Sale Unit | =SUM(F:I) | Total units sold |
| P | Total Sale | =O*N | Total Sales Revenue |
| Q | Balance | =C-O-W | Remaining stock (Purchase U - Sale Unit - Wastage) |
| R | Purchase Out | =D*O | Cost of Goods Sold (Purchase Rate * Units Sold) |
| S | Profit | =P-R | Gross Profit per product |
| T-W | Exp. Detail, Exp., Pet Profit, New Stock | Mixed | Expenses (Petrol, Sample), wastage, new stock received |

#### Right Section: Customer-wise Sales Tracking
| Column | Header | Description |
|--------|--------|-------------|
| AE-AN | Customer columns (1st, 2nd, 3rd... 10th) | Sales quantities per customer per date |
| AO | Sale Unit | =SUM(AE:AN) |
| AP | Sale Value | =AO*AD (AD = N.Rate) |
| AQ | Net Sale | =AO*AC (AC = Rate) |
| AR | Profit | =AP-AQ |
| AS-BF | Date columns (45627, 45658... = Excel serial dates) | Daily sales quantities per product |

### 2.2 Key Formulas & Business Logic

1. **Purchase Subtotal**: `Purchase S = Purchase U × Purchase R`
2. **Total Sale Units**: `Sale Unit = SUM(1st, 2nd, 3rd, 4th)`
3. **Total Sales Revenue**: `Total Sale = Sale Unit × T.P (Trade Price)`
4. **Closing Balance**: `Balance = Purchase U - Sale Unit - Wastage (W column)`
5. **COGS**: `Purchase Out = Purchase R × Sale Unit`
6. **Gross Profit**: `Profit = Total Sale - Purchase Out`
7. **Expense Allocation**: 40% of revenue allocated to expenses (Petrol, Sample)
8. **Net Profit**: `Pet Profit = Profit - Expenses`

### 2.3 Monthly Carry-Forward Logic
- Opening stock of next month = Closing balance of previous month + New Stock received
- Formula example: `C16 = S6 + Z16` (Dec opening = Nov balance + Nov new stock)

### 2.4 Customer Sections
Right side tracks sales by customer/doctor:
- Gujrat Hospital (January 2025)
- Dr. Shafiq SB (January 2025)
- Dr. Gulzar Ahmed
- Others

Each customer section has daily sales columns (Excel serial dates: 45627 = Jan 1, 2025, etc.)

---

## 3. ROI Sheet - Detailed Analysis

### 3.1 Structure
Two yearly sections: Year 2024 and Year 2025

### 3.2 Columns
| Column | Header | Formula/Logic |
|--------|--------|---------------|
| A | S.No. | Sequential |
| B | DR. Name | Doctor/Customer name |
| C | Spl. | Specialty (GP, Phy, Gyne, Peads) |
| D | Area | Geographic area |
| E | Investment | Amount invested/advanced to doctor |
| F | Date of Investment | Excel serial date |
| G | Expected Sale | =E / ROI% (e.g., /30% or /35%) |
| H-AE | Monthly sales columns | Actual sales per month (bi-weekly dates) |
| AF | TOTAL | =SUM(H:AE) |
| AG | BALANCE | =AF - G (Actual - Expected) |

### 3.3 ROI Percentages
- 30% for most doctors (General Physicians, Physicians)
- 35% for some (GP - General Practitioners)
- Expected Sale = Investment / ROI%

### 3.4 Business Logic
- Investment is an advance/credit given to doctors
- Expected sales target derived from investment
- Monthly tracking of actual sales vs target
- Balance shows over/under achievement

---

## 4. OLX Sheet - Distributor Sales

### 4.1 Structure
External distributor (MA Distributor) sales report for dealers

### 4.2 Columns
| Column | Description |
|--------|-------------|
| Product Code | Distributor's product code |
| Name of Product | Product name |
| Packing | Pack size (e.g., "10,", "20,") |
| Item Rate | Unit price |
| Gross Sale | Quantity sold |
| Sales Return | Return quantity |
| Net Sale Qty | = Gross Sale (no returns in sample) |
| Amount | = Item Rate × Net Sale Qty |

### 4.3 Grouping
- Grouped by Dealer Code (e.g., "0026-0004 MEDICARE HOSPITAL")
- Subtotals per dealer
- Grand total with MROUND

---

## 5. Sheet2 - Balance Sheet

### 5.1 Columns
| Column | Description |
|--------|-------------|
| Customer | Customer/Doctor name |
| Factory Rate | Cost rate |
| Opening Stock | Opening inventory value |
| Sale | Sales amount |
| Credit | Credit sales |
| Discount | Discount given |
| Pending Sale | Outstanding receivable |
| Expense | Expenses incurred |
| Profit | Net profit |

### 5.2 Sections
- Monthly summaries (Opening stock, Stock Retail Sale Out)
- Customer-wise entries (Dr. Shafiq, Dr. Gulzar, Gujrat Hospital, etc.)
- Expense entries
- New stock purchases
- Credit entries

---

## 6. Sheet1 - Monthly P&L

### 6.1 Columns
| Column | Formula |
|--------|---------|
| Month | Text |
| Description | Text |
| Total Sale | Numeric |
| Dis.% | 40% (fixed) |
| Dis. Amount | =Total Sale × Dis.% |
| Expense | Numeric |
| Balance | =Dis. Amount - Expense + Previous Balance |

---

## 7. Data Mapping to ERP Entities

### 7.1 Core Entities Identified

| Excel Concept | ERP Entity | Notes |
|---------------|------------|-------|
| Products (Medicine names) | Medicine Master | With strength, packing, manufacturer |
| Purchase U, Purchase R, Purchase S | Purchase Invoice Lines | Batch-level tracking needed |
| 1st, 2nd, 3rd, 4th (sales channels) | Sales Invoice Lines | Map to Customer/Doctor |
| T.P (Trade Price) | Sale Price | Per medicine, per customer type |
| Balance | Inventory Stock | Batch-level (FEFO) |
| Exp. Detail (Petrol, Sample) | Expense Entries | Categorized expenses |
| Customer sections (Gujrat Hospital, Dr. Shafiq) | Customers/Doctors | With credit limits, ROI tracking |
| ROI Investment | Doctor Investment | Separate module |
| OLX Dealer data | Distributor Sales | External distributor integration |
| Monthly blocks | Financial Periods | Financial year support |

### 7.2 Missing/Implicit Requirements
1. **Batch/Expiry tracking** - Not in Excel but critical for pharma
2. **Supplier/Distributor master** - Only "MA Distributor" in OLX
3. **Payment tracking** - Partial payments, outstanding balances
4. **Purchase Returns / Sales Returns** - Not explicitly tracked
5. **Multi-location** - Not in Excel but may be needed
6. **Tax/GST** - Not visible, needed for compliance
7. **User roles** - Single owner per requirements

---

## 8. Accounting Rules Derived

### 8.1 Revenue Recognition
- Sales recognized at invoice creation (accrual)
- Trade Price (T.P.) = Sale rate per unit
- Discount = 40% of sale (per Sheet1) - configurable

### 8.2 Cost of Goods Sold
- COGS = Purchase Rate × Units Sold
- Uses purchase rate at time of sale (weighted average or FIFO)
- Excel uses current month's purchase rate

### 8.3 Gross Profit
- Gross Profit = Sales Revenue - COGS
- Per product, per month

### 8.4 Operating Expenses
- Petrol, Sample tracked per product
- 40% of revenue allocated (per Sheet1)
- Other expenses: Rent, Salary, etc. (from Sheet2)

### 8.5 Net Profit
- Net Profit = Gross Profit - Operating Expenses

### 8.6 Inventory Valuation
- At purchase cost (Purchase R × Balance Units)
- Batch-level for expiry management

### 8.7 Doctor Investment (ROI)
- Investment = Advance to doctor
- Expected Sales = Investment / ROI%
- Not revenue/expense - balance sheet item
- Recovered through sales to that doctor

---

## 9. Implementation Priority

### Phase 1: Foundation
- [ ] Database schema design
- [ ] Single-owner local profile (no authentication; login deferred/not required)
- [ ] Medicine master with units/conversions
- [ ] Supplier/Customer/Doctor master

### Phase 2: Inventory & Purchases
- [ ] Purchase invoice with batch/expiry
- [ ] Stock management (FEFO)
- [ ] Opening stock entry

### Phase 3: Sales & Invoicing
- [ ] Sales invoice with batch selection
- [ ] Customer/Doctor sales tracking
- [ ] Printable invoices

### Phase 4: Financials
- [ ] Payment receipts (customer/supplier)
- [ ] Expense management
- [ ] Profit calculation (Gross/Net)

### Phase 5: ROI & Reporting
- [ ] Doctor investment tracking
- [ ] ROI monitoring dashboard
- [ ] All reports with exports

### Phase 6: Expiry & Alerts
- [ ] Expiry dashboard
- [ ] Alerts (90/60/30/7 days)
- [ ] Quarantine/Write-off workflow

### Phase 7: Import & Export
- [ ] CSV/XLSX entity import with preview and validation
- [ ] `Sale Sheet MA-Na.xlsx` workbook seed
- [ ] XLSX exports for master data, transactions, history, and reports
- [ ] Import run history and reconciliation summary

---

## 10. Open Questions for Clarification

1. **Costing Method**: Excel uses current month purchase rate for COGS. Should ERP use Weighted Average Cost (WAC) or FIFO at batch level?
2. **Tax/GST**: What tax rates apply? Inclusive or exclusive?
3. **Units**: "Purchase U" vs "Sale Unit" - are these different UOMs? (e.g., buy by box, sell by strip)
4. **Customer vs Doctor**: Are doctors also customers? Separate entities?
5. **Investment Accounting**: Is doctor investment a loan, advance, or marketing expense?
6. **Multi-currency**: Only PKR or multiple?
7. **Financial Year**: Starts when? (Excel shows Nov 2024 start)
8. **Backup**: Resolved — production database is Supabase; manual Supabase backup is the required procedure, but the in-app workflow is deferred. Local pg_dump scripts are an interim fallback.