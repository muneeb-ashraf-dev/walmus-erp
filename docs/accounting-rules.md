# Walmus Pharma ERP - Accounting Rules & Policies

## 1. Accounting Framework

### 1.1 Basis of Accounting
- **Accrual basis** for revenue and expenses
- **Perpetual inventory** system with batch-level tracking
- **Double-entry bookkeeping** for all financial transactions
- **Financial Year**: July 1 - June 30 (Pakistan standard), configurable

### 1.2 Currency
- **Base Currency**: PKR (Pakistani Rupee)
- **Precision**: 2 decimal places for monetary values
- **Rounding**: Banker's rounding (round half to even) for all calculations

---

## 2. Revenue Recognition

### 2.1 Sales Revenue
- Recognized at **invoice posting** (not at payment receipt)
- Revenue account: `SALES_REV`
- **Gross Revenue** = Sum of line totals (quantity × sale rate)
- **Net Revenue** = Gross Revenue - Discounts Allowed - Sales Returns

### 2.2 Discount Treatment
- **Discount Allowed** (to customers): Contra-revenue account `DISCOUNT_GIVEN`
- **Discount Received** (from suppliers): Other income account `DISCOUNT_RECEIVED`
- Trade discounts: Netted at invoice level
- Cash/early payment discounts: Recognized at payment time

### 2.3 Sales Returns
- Reverse original revenue entry
- Debit `SALES_REV`, Credit `RECEIVABLE` (or `CASH`/`BANK` if refunded)
- Restore inventory at original COGS rate

---

## 3. Cost of Goods Sold (COGS)

### 3.1 Costing Method: **Weighted Average Cost (WAC) at Medicine Level**
- **Rationale**: Matches Excel behavior (uses current month purchase rate), simpler than FIFO/LIFO, acceptable for pharma trading
- **Batch-level purchase cost** preserved for traceability and expiry management
- **WAC recalculated** on each purchase receipt

### 3.2 WAC Calculation
```
New WAC = (Existing Qty × Existing WAC + New Qty × New Purchase Cost) / (Existing Qty + New Qty)
```
- Calculated in **base units**
- Updated when purchase invoice is **posted**
- Used for: COGS on sales, inventory valuation, profit calculation

### 3.3 COGS on Sales
- At time of sale posting: `COGS = Quantity Sold (base units) × Current WAC`
- Journal Entry:
  - Debit `COGS` (Expense)
  - Credit `INVENTORY` (Asset)

### 3.4 Purchase Returns Impact on WAC
- If returned to supplier at original cost: No WAC change
- If returned at different rate: Adjust WAC proportionally
- Returned stock goes to **quarantine** by default (not back to saleable)

---

## 4. Inventory Valuation

### 4.1 Valuation Basis
- **Saleable Stock**: Valued at **Weighted Average Cost** (per medicine)
- **Quarantined Stock**: Valued at **Original Purchase Cost** (per batch)
- **Expired Stock**: Valued at **Zero** (or net realizable value if estimated)

### 4.2 Inventory Accounts
- `INVENTORY` (Asset): Saleable stock at WAC
- `QUARANTINE_INVENTORY` (Asset): Quarantined stock at batch cost
- Write-offs hit `EXPENSE` / `COGS` depending on reason

---

## 5. Purchase Accounting

### 5.1 Purchase Invoice Posting
```
Debit: INVENTORY (Asset)          = Line totals (at purchase cost)
Debit: TAX_PAYABLE (if applicable)= Tax amount
Credit: PAYABLE (Supplier)        = Total amount
Credit: DISCOUNT_RECEIVED         = Discount received (if any)
```

### 5.2 Cash Purchases
```
Debit: INVENTORY
Debit: TAX_PAYABLE
Credit: CASH / BANK
```

### 5.3 Purchase Returns
```
Debit: PAYABLE (Supplier)
Credit: INVENTORY (or QUARANTINE_INVENTORY)
Credit: TAX_PAYABLE (reversal)
Debit: DISCOUNT_RECEIVED (reversal)
```

---

## 6. Sales Accounting

### 6.1 Credit Sale Posting
```
Debit: RECEIVABLE (Customer)      = Invoice total
Credit: SALES_REV                 = Gross revenue
Credit: TAX_PAYABLE               = Tax collected
Debit: DISCOUNT_GIVEN             = Discount allowed
Debit: COGS                       = WAC × Qty sold
Credit: INVENTORY                 = WAC × Qty sold
```

### 6.2 Cash Sale Posting
```
Debit: CASH / BANK                = Amount received
Debit: RECEIVABLE (if partial)    = Balance
Credit: SALES_REV
Credit: TAX_PAYABLE
Debit: DISCOUNT_GIVEN
Debit: COGS
Credit: INVENTORY
```

### 6.3 Sales Returns
```
Debit: SALES_REV                  = Return amount
Debit: TAX_PAYABLE                = Tax reversal
Credit: RECEIVABLE / CASH / BANK  = Refund/credit
Credit: DISCOUNT_GIVEN            = Discount reversal
Debit: INVENTORY                  = Original COGS (if restocked saleable)
Credit: COGS                      = Original COGS (if restocked saleable)
-- If quarantined/destroyed:
Debit: EXPENSE / COGS             = Write-off
Credit: INVENTORY                 = Original COGS
```

---

## 7. Payment Accounting

### 7.1 Customer Receipt (Against Credit Sale)
```
Debit: CASH / BANK                = Amount received
Credit: RECEIVABLE (Customer)     = Amount received
```
**NO revenue recognition** - already recognized at invoice.

### 7.2 Supplier Payment (Against Credit Purchase)
```
Debit: PAYABLE (Supplier)         = Amount paid
Credit: CASH / BANK               = Amount paid
```
**NO expense recognition** - already recognized at purchase (inventory asset).

### 7.3 Advance Payments
- Customer advance: Debit `CASH/BANK`, Credit `ADVANCE_FROM_CUSTOMER` (Liability)
- Supplier advance: Debit `ADVANCE_TO_SUPPLIER` (Asset), Credit `CASH/BANK`
- Adjusted against future invoices

---

## 8. Expense Accounting

### 8.1 Operating Expenses
```
Debit: EXPENSE (specific category) = Amount
Credit: CASH / BANK / PAYABLE      = Amount
```

### 8.2 Expense Categories (from Excel + Standard)
| Code | Name | Type |
|------|------|------|
| RENT | Rent | Operating |
| SALARY | Salaries & Wages | Operating |
| ELECTRICITY | Electricity | Operating |
| FUEL | Fuel / Petrol | Operating |
| TRANSPORT | Transportation | Operating |
| TELEPHONE | Telephone & Internet | Operating |
| OFFICE | Office Expenses | Operating |
| SAMPLE | Free Samples | Operating |
| MARKETING | Marketing & Promotion | Operating |
| REPAIRS | Repairs & Maintenance | Operating |
| INSURANCE | Insurance | Operating |
| LEGAL | Legal & Professional | Operating |
| BANK_CHARGES | Bank Charges | Financial |
| OTHER | Other Expenses | Operating |

### 8.3 Excel-Specific: "Petrol" and "Sample" per Product
- Tracked as **direct selling expenses** per product
- Allocated proportionally or directly to product profit calculation
- In ERP: Tag expense lines with medicine_id for product-level P&L

---

## 9. Doctor Investment (ROI) Accounting

### 9.1 Nature of Investment
- **Advance/Loan to Doctor** - Not revenue, not expense
- **Balance Sheet Item**: `ADVANCE_TO_DOCTOR` (Asset)
- Expected recovery through **sales to that doctor**

### 9.2 Initial Investment
```
Debit: ADVANCE_TO_DOCTOR (Asset)  = Investment amount
Credit: CASH / BANK               = Investment amount
```

### 9.3 Sales to Doctor (Recovery)
- Normal sales invoice posted to `RECEIVABLE`
- **Separate tracking**: Allocate collections to investment recovery
- Monthly ROI report: Actual Sales vs Expected Sales (Investment / ROI%)

### 9.4 Investment Recovery Allocation
```
Debit: CASH / BANK                = Collection from doctor
Credit: RECEIVABLE (Doctor)       = Invoice amount
-- Internal memo: Reduce ADVANCE_TO_DOCTOR balance
```

### 9.5 Write-off Unrecoverable Investment
```
Debit: EXPENSE (Investment Write-off) = Unrecovered amount
Credit: ADVANCE_TO_DOCTOR             = Unrecovered amount
```

---

## 10. Profit Calculation (Per Excel Logic)

### 10.1 Gross Profit
```
Gross Profit = Net Sales Revenue - COGS
Net Sales Revenue = Gross Sales - Discounts Allowed - Sales Returns
```

### 10.2 Operating Profit (Net Operating Profit)
```
Operating Profit = Gross Profit - Operating Expenses
Operating Expenses = Rent + Salary + Electricity + Fuel + Transport + Telephone + Office + Samples + Marketing + Other
```

### 10.3 Excel "Pet Profit" / "Net Profit"
```
Pet Profit = Gross Profit - Product-Level Expenses (Petrol, Sample per product)
Net Profit = Pet Profit - General Operating Expenses
```
**ERP Implementation**: 
- Track product-level expenses via `expense.medicine_id` (nullable)
- Report both Gross Profit and Net Profit

### 10.4 Monthly P&L Structure (Matching Sheet1)
```
Total Sales (Net)
Less: Discount Allowed (40% per Excel, configurable)
Less: COGS
= Gross Profit
Less: Operating Expenses
= Net Operating Profit
```

---

## 11. Tax Accounting

### 11.1 Sales Tax / GST (Pakistan)
- **Output Tax**: Collected on sales → `TAX_PAYABLE` (Liability)
- **Input Tax**: Paid on purchases → `TAX_RECEIVABLE` (Asset) or adjust `TAX_PAYABLE`
- **Net Tax Payable** = Output Tax - Input Tax

### 11.2 Withholding Tax
- On payments to suppliers/doctors per Pakistan tax law
- Separate tracking for tax certificates

---

## 12. Financial Statements Mapping

### 12.1 Trial Balance
All `financial_account` balances from `journal_entry_line` posted entries.

### 12.2 Profit & Loss
| Account Type | P&L Section |
|--------------|-------------|
| revenue (SALES_REV, DISCOUNT_RECEIVED) | Revenue |
| cogs (COGS) | Cost of Sales |
| expense (EXPENSE, DISCOUNT_GIVEN) | Operating Expenses |

### 12.3 Balance Sheet
| Account Type | BS Section |
|--------------|------------|
| cash, bank | Current Assets |
| receivable, ADVANCE_TO_DOCTOR, ADVANCE_TO_SUPPLIER | Current Assets |
| inventory, QUARANTINE_INVENTORY | Current Assets |
| payable, TAX_PAYABLE, ADVANCE_FROM_CUSTOMER | Current Liabilities |
| equity | Equity |

---

## 13. Reconciliation Rules

### 13.1 Daily
- Cash count vs `CASH` account balance
- Bank statement vs `BANK` account balance

### 13.2 Monthly
- Customer ledger (sub-ledger) vs `RECEIVABLE` control account
- Supplier ledger vs `PAYABLE` control account
- Inventory valuation (batch sum) vs `INVENTORY` account
- Doctor investment ledger vs `ADVANCE_TO_DOCTOR` account

### 13.3 Discrepancy Handling
- **Auto-detection**: Reconciliation report flags differences > 0.01
- **Resolution**: Adjustment journal entry with reason
- **Audit trail**: All adjustments logged

---

## 14. Opening Balance Entry

### 14.1 One-time Setup (First Run)
```
Debit: INVENTORY              = Sum of (batch_qty × batch_cost)
Debit: RECEIVABLE             = Sum of customer opening balances
Debit: ADVANCE_TO_DOCTOR      = Sum of doctor investments
Debit: CASH                   = Opening cash
Debit: BANK                   = Opening bank
Credit: PAYABLE               = Sum of supplier opening balances
Credit: EQUITY                = Balancing figure (Owner's Capital)
```

### 14.2 Subsequent Financial Years
- Carry forward all balance sheet account balances
- Close P&L accounts to `RETAINED_EARNINGS` (Equity)

---

## 15. Rounding & Precision Rules

| Value Type | Precision | Rounding Method |
|------------|-----------|-----------------|
| Monetary (PKR) | 2 decimals | Banker's rounding |
| Quantities (base units) | 4 decimals | Standard rounding |
| Rates (per unit) | 4 decimals | Standard rounding |
| Percentages | 2 decimals | Standard rounding |
| Tax amounts | 2 decimals | Banker's rounding |

**Line-level rounding**: Each invoice line rounded individually
**Invoice total**: Sum of rounded lines (not re-rounded)

---

## 16. Prohibited Practices (Enforced by Design)

| Practice | Prevention |
|----------|------------|
| Negative saleable stock | CHECK constraint + service validation |
| Selling expired batches | Service validation on sales_invoice_item insert |
| Modifying posted invoices | Status = 'posted' blocks UPDATE; use returns/cancellation |
| Deleting inventory movements | No DELETE trigger on inventory_movement |
| Unbalanced journal entries | CHECK constraint on journal_entry |
| Duplicate invoice numbers | UNIQUE constraint + sequence generator |
| COGS without inventory reduction | Single transaction for sales posting |
| Revenue on cash receipt | Revenue only on invoice posting |

---

## 17. Excel-to-ERP Formula Mapping

| Excel Formula | ERP Implementation |
|---------------|-------------------|
| `Purchase S = Purchase U × Purchase R` | purchase_invoice_item.line_total |
| `Sale Unit = SUM(1st:4th)` | sales_invoice_item.quantity_sold (sum of batches) |
| `Total Sale = Sale Unit × T.P.` | sales_invoice_item.line_total |
| `Balance = Purchase U - Sale Unit - Wastage` | medicine_batch.available_quantity |
| `Purchase Out = Purchase R × Sale Unit` | sales_invoice_item.cogs_amount (using WAC) |
| `Profit = Total Sale - Purchase Out` | sales_invoice_item.gross_profit |
| `Expense = 40% × Revenue` | Configurable % per product/category |
| `Pet Profit = Profit - Expense` | Product-level net profit |
| `Expected Sale = Investment / ROI%` | doctor_investment.expected_sale (computed) |
| `Balance = Total Sales - Expected Sale` | doctor_investment actual vs expected |

---

## 18. Audit Requirements

Every financial mutation must record:
- **Who**: Default owner user ID (single-owner no-login build)
- **When**: Timestamp (UTC)
- **What**: Entity, ID, field changes (old/new)
- **Why**: Reference document (invoice, payment, adjustment)
- **Import batch**: Source file and run ID for imported data

Tables with full audit: All transaction tables (invoices, payments, expenses, journal entries, inventory movements, adjustments, import batches)

---

## 19. Historical Imported Data

Historical monthly workbook figures are stored in separate import tables and are **not** posted to the general ledger.

### 19.1 Treatment

- `imported_sales_history` stores product-month sales, purchase, profit, and closing quantity.
- `imported_month_summary` stores monthly totals used by the Monthly Business Summary and dashboard.
- `imported_customer_performance` stores doctor and OLX monthly performance used by ROI reporting.
- Opening stock is represented by real `medicine_batch` rows (`OPEN-YYYYMM`) so current inventory remains live and saleable.

### 19.2 Reporting Rules

- Reports show live transaction totals and imported historical totals separately, plus a combined "with history" total where relevant.
- Historical sales must never be counted twice: OLX distributor totals are customer performance only and are excluded from product sales history.
- Imported figures are read-only reference data; corrections are made by re-importing the source workbook, which upserts existing rows.

### 19.3 Audit

Every import creates an `import_batch` row with the source file, import type, status, row counts, summary, and errors. Re-running an import updates the existing history and records a new batch.