# Walmus Pharma ERP — Business Logic Guide

This guide explains the business concepts represented in the application and how the current code processes them. It is intended for an owner learning the workflow, not as accounting or tax advice.

## How to read this guide

- **Implemented** describes behavior found in the application code.
- **Documented policy** describes behavior described in `docs/accounting-rules.md`, `docs/expiry-management.md`, or the PRD. A policy statement is not proof that every screen or API currently enforces it.
- **Known gap** calls out where the code and written policy do not line up, or where a workflow is incomplete.

The application is a single-owner, local ERP. The frontend collects data; the FastAPI backend validates and applies business rules; PostgreSQL stores the records. A draft is a proposal. Posting is the point that is intended to apply stock and accounting effects.

## 1. The business in one picture

```text
Medicine catalogue + units
             |
Supplier -> Purchase draft -> Post -> Batch stock + inventory movement + payable/journal
                                             |
Customer <- Sales draft <- Select batch <- Saleable stock (FEFO suggestion)
    |                Post -> Stock decreases + revenue/receivable + COGS/journal
    |                         |
    +---- Receipts/payments --+---- Expenses, adjustments, and returns
                                  |
                         Reports and reconciliation
```

The key distinction is between **master data** (who and what the business deals with) and **transactions** (what happened on a date). A medicine record describes a product; a batch represents a particular received lot of that product. A supplier record describes a vendor; a purchase invoice records one specific purchase.

## 2. Core business terms

| Term | Plain-language meaning in this application |
|---|---|
| Master data | Reusable records such as medicines, units, manufacturers, suppliers, customers, expense categories, and accounts. |
| Transaction | A dated business event such as an invoice, payment, return, adjustment, or expense. |
| Draft | A saved but unposted invoice. It can be edited and is not intended to change stock or the ledger. |
| Posted | A confirmed transaction. It should have operational and financial effects and should not be silently edited. |
| Batch / lot | A quantity of one medicine from a particular lot, tracked with its batch number, expiry, supplier, and cost. |
| Base unit | The smallest stock-counting unit for a medicine, such as one tablet or one millilitre. All stock quantities should reconcile to this unit. |
| Conversion factor | How many base units are represented by one purchase or sale unit. Example: 1 strip = 10 tablets, so the strip factor is 10. |
| FEFO | “First Expiry, First Out”: use eligible stock with the soonest expiry first. |
| Receivable / debtor | Money customers owe the business for credit sales. It is an asset. |
| Payable / creditor | Money the business owes a supplier for credit purchases. It is a liability. |
| Inventory | The cost value of goods held for sale; it is an asset until the goods are sold or written off. |
| Revenue | The value earned by selling goods. Under the written policy it is recognized when the sale is posted, not when the customer pays. |
| COGS | Cost of Goods Sold: the recorded cost of the units sold. It is an expense matched against sales revenue. |
| Gross profit | Net sales revenue less COGS. It is before general operating expenses. |
| Journal entry | Accounting record that debits and credits accounts for one business event. Total debits should equal total credits. |
| Sub-ledger | Transaction detail for one customer or supplier. Its total should agree with the matching receivable/payable control account. |
| Opening balance | A balance that existed before routine transactions were entered into the ERP. It establishes a starting point; it is not a new sale or purchase. |
| Import history | Read-only imported historical performance figures. They are not posted invoices and should not change current stock or the general ledger. |

## 3. Recommended setup and data-entry order

1. **Business settings:** business identity, currency, financial-year start, invoice prefixes, and payment terms.
2. **Units:** define base, purchase, and sale units and the conversion factors used for each medicine.
3. **Manufacturers:** optional catalogue entries used to group products.
4. **Medicines:** product code, name, generic, strength/form, units, conversions, default prices, tax, and stock thresholds.
5. **Suppliers:** vendors/distributors, contact information, terms, and any verified opening payable balance.
6. **Customers:** pharmacies, clinics, or other buyers, terms, credit limit, and any verified opening receivable balance.
7. **Financial accounts and categories:** cash/bank accounts, expense categories, and other chart-of-account setup.
8. **Opening stock/balances:** enter only after counting/reconciling the real position. Avoid entering the same opening position both as opening data and as a purchase/payment.
9. **Routine transactions:** purchases and receipts, sales and collections, supplier payments, expenses, adjustments, and returns.
10. **Review:** inventory, expiry, customer/supplier balances, cash/bank, reports, and reconciliation.

The UI may allow a different order, but references must exist first. For example, a medicine needs a base unit; a purchase needs a supplier and medicine; a sales line needs a customer, medicine, and eligible batch.

## 4. Medicine catalogue, units, and prices

### Medicine master

A medicine is the shared product definition: unique product code, optional barcode, name, generic name, manufacturer, strength, dosage form, packing description, units, default rates, tax rate, and reorder thresholds. A product code is unique. Creating a second medicine with the same code is rejected; find and edit the existing medicine or choose a different code.

Changing a default rate is intended to affect future invoice entry only. Invoice lines store their own quantities, rates, discounts, taxes, and cost snapshots so the history can retain the values used on the transaction.

### Units and conversions

Stock is represented in **base units**. A purchase or sale may be entered in a larger unit and converted:

```text
Base quantity = entered quantity × conversion factor
Base-unit rate = entered-unit rate ÷ conversion factor
```

Example: a box contains 10 strips and each strip contains 10 tablets. If the base unit is tablet, one box is 100 base units; one strip is 10. Set the purchase/sale conversion to the number of base units in that unit. Incorrect factors make stock and cost-per-unit calculations incorrect, so verify them before posting the first invoice.

`units_per_pack` is also stored on the medicine. Do not assume the application derives every conversion from that one field; the purchase and sale conversion factors are explicit fields and are used by transaction lines.

### Manufacturers and units

Medicine units and manufacturers are reference data. Default units are inserted by a migration; they are not medicines or stock. A medicine can have no manufacturer, but its base unit is required.

## 5. Suppliers, customers, and balances

### Suppliers

A supplier is a vendor/distributor. Its record includes contact details, credit limit, payment terms, active status, and opening balance fields. Purchases belong to a supplier; batches also retain the supplier association when known.

Supplier payable is conceptually:

```text
Opening payable + posted credit purchases - posted purchase returns - payments/credits applied
```

An **opening balance** is a starting amount owed on the stated date. It should not also be entered as a historical invoice unless you intend both records to exist.

### Customers

A customer can represent a pharmacy or another configured buyer. Contact, customer type, area/specialty, credit terms, credit limit, default sale-rate type, and opening balance are stored. Sales are linked to customers, so invoices and receipts contribute to their ledger.

Customer receivable is conceptually:

```text
Opening receivable + posted credit sales - returns/credits - receipts applied
```

A credit limit is a business control/threshold field; do not assume every workflow blocks a sale at that limit without verifying the route behavior.

## 6. Purchase workflow: buying and receiving medicines

### Enter a purchase draft

Create a purchase invoice with supplier, invoice/receipt/due dates, supplier invoice reference, and one or more lines. Each line identifies the medicine, supplier batch number, expiry (and optional manufacturing date), received quantity, purchase unit/conversion, purchase rate, discount, and tax.

The supplier invoice number is the supplier's reference. The ERP voucher number is the system's own unique reference. They serve different purposes.

Line quantities are converted to base units for stock. The invoice total is formed from line amounts, discounts, and tax. The exact values stored on the line are the transaction snapshot; the medicine's current default purchase rate is not a substitute for the historical invoice rate.

### Draft versus post

- **Save draft:** stores the invoice and lines; it is not intended to increase stock or create a payable.
- **Post:** creates or updates batch stock, records inventory movements, and creates accounting records. Posting should happen only after checking supplier, batch, expiry, quantity, unit, and rate.

If the same medicine/batch/supplier arrives again, the application can add to the matching batch record; otherwise it creates a new batch. A batch is uniquely associated by medicine, batch number, and supplier in the data model.

### Purchase accounting concept

For a credit purchase, the basic accounting idea is:

```text
Debit Inventory (asset)      purchase value
Credit Payable (liability)   amount owed to supplier
```

Tax and discounts may introduce additional accounts depending on the applicable accounting treatment. If paid at purchase, cash/bank and payable should reflect the settlement. The actual posting code should be reviewed against the written accounting policy before relying on every tax/discount case.

### Supplier payments

A supplier payment is a cash/bank outflow that settles some or all of what is owed. It is not a second purchase expense: the purchase event recorded the inventory/cost; payment reduces cash/bank and the supplier payable. A partial payment leaves a remaining balance. Allocate payments to the correct purchase invoices so invoice-level outstanding and aging are meaningful.

### Purchase returns

A purchase return sends goods back or records a supplier credit. It should reference the original posted purchase and identify lines/quantities. Returned quantity must not exceed the eligible stock. The return may reduce saleable stock, quarantine or destroy goods, and reduce the supplier balance through a credit note.

**Known gap:** cancellation/return reversal behavior is identified as incomplete in the project summary. Treat cancellation and return screens as requiring careful reconciliation; do not assume every accounting reversal is complete merely because a return record can be created.

## 7. Batches, stock, and expiry

### Stock by batch

Each batch stores medicine, batch number, dates, supplier, received and available quantity, purchase cost per base unit, status, and location. The medicine master is not itself an inventory balance. The sum of eligible batch quantities is the operational stock position.

An **inventory movement** is the audit trail for a quantity change: purchase receipt, sale, return, adjustment, or other reason. A movement should explain why the batch quantity changed and link to its source transaction where possible.

### Batch statuses

- `active`: can be considered for sale if it is in date and has enough quantity.
- `quarantined`: held back from sale pending a decision (for example, damage or return review).
- `expired`: expiry passed; not saleable.
- `depleted`: no available quantity.

The actual enum/data values are code-level strings; use the UI labels for entry and check `docs/expiry-management.md` for the intended lifecycle.

### FEFO and sale eligibility

FEFO means selecting the active, non-empty batch with the earliest valid expiry date first. The inventory service orders eligible batches by expiry, then manufacturing date, then ID. The sales interface may allow a manual batch choice, but posting must revalidate status, expiry, and availability. A batch that expires before the invoice date, is quarantined, or lacks enough stock must not be sold. Expiry on the invoice date is treated as eligible by the comparison in the service (`expiry_date >= sale_date`); follow local policy for the last saleable day.

### Alerts and adjustments

Expiry screens group stock by remaining time and show items needing review. Low-stock alerts compare stock to medicine reorder thresholds. An adjustment records a correction such as count variance, damage, or write-off; include a clear reason and verify the resulting batch balance. Adjustments should not be used to hide unexplained differences.

## 8. Sales workflow: selling and invoicing

### Enter a sales draft

Choose a customer, invoice and due dates, and medicine lines. Search the medicine catalogue, select batch(es), enter quantity and sale unit, rate, discounts, and taxes. The sale line records the selected batch, base quantity, rate, cost snapshot, and computed COGS/gross profit fields.

The sales invoice number is the ERP reference. The customer name and invoice details appear on the printed invoice. A draft can be edited; verify customer, batch, quantity, price, and expiry before posting.

### Post a sale

Posting rechecks the stock batch (including a row lock to reduce concurrent overselling), deducts the base quantity, and records inventory movement and journal entries. A sales invoice should not be posted twice. After posting, corrections should use a return/credit or cancellation workflow, not silent edits.

### Sales accounting concept

On a credit sale, the core idea is:

```text
Debit Receivable (asset)     customer owes invoice total
Credit Sales Revenue         net sale value
Debit COGS (expense)         cost of units sold
Credit Inventory (asset)     remove cost of units sold
```

Cash received at posting reduces the amount still due; later receipts reduce receivable but do not create revenue a second time. Sales tax and discount accounts depend on the applicable treatment and implementation.

### Customer receipts

A receipt records money received from a customer. Applying it to one or more invoices decreases their outstanding balances. The receipt date, payment method, cash/bank account, reference, and allocations are important for cash reconciliation and aging. Unallocated receipts may not correctly settle a specific invoice.

### Sales returns

A sales return references an original posted sale and reverses some quantity/value. The inventory outcome depends on condition: restock saleable goods only when approved; quarantine goods needing inspection; write off goods that cannot be sold. A return should reverse the related revenue/tax/receivable and restore or write off the original cost consistently.

## 9. Financial accounting and terms

### Debits and credits

Debits and credits are the two sides of accounting entries, not synonyms for “good” and “bad.” Every journal entry should balance: total debits = total credits. Typical account behavior:

| Account class | Common balance direction | Examples |
|---|---|---|
| Asset | Debit | Cash, bank, receivables, inventory |
| Liability | Credit | Supplier payables, tax payable |
| Equity | Credit | Owner capital, retained earnings |
| Revenue | Credit | Sales revenue |
| Expense | Debit | COGS, rent, salaries |

The chart of accounts gives each account a code/name/type. `JournalEntry` is the header; `JournalEntryLine` carries the account, debit/credit direction, amount, and description. Reports based on the ledger are only as reliable as the source entries.

### Cash and bank

Cash/bank are asset accounts. Reconcile physical cash and bank statements to their account balances regularly. A payment method label alone is not enough: the transaction should point to the correct financial account.

### Expenses

An expense is a business cost consumed in operating the business (rent, electricity, transport, etc.), distinct from buying stock that remains an asset until sold. Enter date, category, amount, payment account, description/reference, and optional medicine link. A medicine-linked expense can support product-level reporting; a general overhead should normally remain unlinked.

Basic paid expense:

```text
Debit Expense                 expense amount
Credit Cash or Bank           expense amount
```

Expense categories group the costs. Choose the closest category consistently; category changes affect reporting.

### Aging

Receivables/payables aging groups open invoice balances by how long they have been outstanding relative to due date or invoice date. It helps prioritize collection and supplier payment. A stale invoice with a missing or incorrect due date can fall in the wrong bucket.

### Reconciliation

Reconciliation compares independent views that should agree, for example customer invoice balances versus receivable control account, supplier balances versus payable control, or batch stock value versus inventory. A difference is a signal to trace entries, not a reason to insert a balancing adjustment without evidence.

## 10. Costs, discounts, taxes, and profit

### Cost of goods sold and gross profit

Conceptually:

```text
Net sales = gross sales - sales discounts - sales returns
COGS = cost assigned to units sold
Gross profit = net sales - COGS
Net profit = gross profit - operating expenses (subject to other income/costs)
```

**Important implementation difference:** `docs/accounting-rules.md` describes medicine-level WAC (weighted average cost), but the current sales posting path stores/uses the selected batch's `purchase_cost_per_unit` for sale-line cost. Purchase posting contains a comment that medicine-level WAC is not fully calculated. Therefore, do not assume dashboard/report gross profit exactly follows the documented WAC policy until that implementation is completed and verified.

### Discount

A discount reduces the amount charged or paid. Customer discount and supplier discount may have different accounting treatment. Invoice line fields store percentage and amount; verify which value the form calculates and whether the backend consistently uses both. Do not enter the same discount twice as both a line amount and a separate manual adjustment.

### Tax

The application has tax-rate and tax-amount fields and tax accounts. The correct tax rate, whether a price is tax-inclusive, input-tax recoverability, withholding rules, and filing treatment depend on current law and business circumstances. Confirm these with a qualified accountant; the software fields alone do not determine legal tax treatment.

### Rounding

Database monetary fields generally store two decimal places and rates/quantities can store four. The accounting document specifies line-level rounding and banker’s rounding, but verify actual behavior on the specific invoice path before relying on edge-case penny/paisa calculations.

## 11. Doctor investment and ROI tracking

The system has customer-linked doctor investment records with investment amount/date, ROI percentage, and expected sales. The model formula is:

```text
Expected sales = investment amount ÷ (ROI percentage / 100)
```

Example: an investment of PKR 20,000 with ROI set to 10% gives expected sales of PKR 200,000 by this formula. This is a target/ratio calculation, not proof that the principal was repaid or that profit was earned.

Imported monthly customer performance can show actual historical sales alongside targets. Sales attributed to a customer are not automatically the same thing as cash recovered against an advance. Keep these concepts separate:

- **Sales performance:** value of invoices/sales associated with the customer.
- **Collection:** money actually received for invoices.
- **Investment recovery:** repayment/reduction of a recoverable advance.

**Known gaps:** investment transaction data is modeled, but the project summary notes that dedicated investment transaction API endpoints are not exposed. Do not assume disbursements, recoveries, write-offs, and related journal entries are fully implemented just because the investment and ROI screens exist. The legal and ethical basis for any arrangement must be independently reviewed; ROI is only a software metric.

## 12. Opening balances and imported history

### Opening position

Opening stock is the physical quantity already owned on the cutover date, by medicine and batch, with a defensible cost and expiry. Opening receivables/payables are amounts already owed by/to counterparties on that date. Cash/bank opening balances should match the cash count and bank statement.

Opening balances are not ordinary sales, purchases, or payments. Record them once and set a clear date. Reconcile the sum to the balancing owner-equity figure in the books. The PRD and accounting rules describe an opening-balance workflow; check the relevant application page/API before assuming it posts a complete balanced opening journal.

### Workbook seed and historical sales

Import preview is for validating source rows before commit. A committed workbook seed can create/update master records, opening stock, and historical performance records. Historical sales/month summaries are separate from live posted invoices; they should not reduce current stock or post revenue to the ledger. Re-import behavior is designed to upsert some imported rows and create an import-batch record, so review the preview and import history before committing.

Never import the same opening stock as both a workbook opening batch and purchase invoice unless both represent genuinely separate stock.

## 13. Reports and dashboard

- **Dashboard:** summary cards, sales/purchase/profit charts, expiry alerts, low-stock items, and quick actions. Treat it as a summary view; drill into source invoices/movements when a number is unexpected.
- **Sales/purchase reports:** aggregate posted transaction data by date, product, customer, or supplier. Drafts should not be treated as completed trade.
- **Inventory valuation:** values stock from the inventory/batch data and cost fields. Compare to stock count and ledger valuation.
- **Expiry reports:** identify batches near or past expiry for action.
- **Profit reports:** combine revenue, discount, COGS, and expenses. Be mindful of the WAC-versus-batch-cost implementation gap described above.
- **ROI/monthly summary:** may combine imported historical performance and live transactions; check labels to distinguish the two and avoid double counting.
- **CSV/XLSX export:** a copy of the selected report/data for analysis; it does not update the ERP when edited externally.

## 14. Statuses and when to correct records

Invoices generally use draft, posted, or cancelled states. Payment records may be unpaid, partial, or paid. Batch stock uses active/quarantined/expired/depleted states. A status communicates workflow position; it does not replace checking quantity and balances.

Use a draft edit before posting. After posting, preserve the audit trail: use a return, credit, cancellation, or adjustment feature supported by the relevant workflow. If a post request errors, check whether any prior version of the code committed part of the transaction before retrying. In particular, reconcile the related batch quantities and inventory movements first.

## 15. Practical checklist for entering a transaction

Before posting a purchase:

- Supplier and supplier invoice reference are correct.
- Each medicine and product code are correct.
- Batch number, expiry date, and received quantity match packaging/documents.
- Unit conversion and purchase rate use the intended unit.
- Discounts, tax, total, amount paid, and due date are checked.

Before posting a sale:

- Customer and invoice date are correct.
- Medicine, batch, unit conversion, quantity, price, discount, and tax are checked.
- Batch is active, not expired on invoice date, and has enough available units.
- FEFO suggestion is followed or there is a clear reason for the override.
- Payment received and remaining balance are correct.

After posting either:

- Check invoice status and final total.
- Check batch quantity and movement history.
- Check supplier/customer balance and payment allocation.
- Check the relevant journal entry/account balance where appropriate.
- Keep source invoice, delivery note, receipt, or other evidence.

## 16. Current limitations to keep in mind

The guide reflects both source code and project documentation, and the implementation can evolve. At the time of review:

1. Medicine-level WAC is described in accounting documentation but sale cost is currently tied to batch cost in the posting path.
2. Cancellation/return reversals are described as incomplete in the project summary.
3. Doctor investment transaction endpoints are noted as not exposed; do not treat ROI tracking as a full repayment ledger.
4. Documented accounting treatment for tax and discounts needs to be checked against the actual posting paths and local professional advice.
5. Historical imported summaries are separate from live accounting transactions; understand the report label before combining them.

For the underlying technical details see [accounting rules](accounting-rules.md), [expiry management](expiry-management.md), [database schema](database-schema.md), and [user manual](user-manual.md).
