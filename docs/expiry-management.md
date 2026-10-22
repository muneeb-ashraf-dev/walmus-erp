# Walmus Pharma ERP - Expiry Management Design

## 1. Overview

Expiry management is **critical** for pharmaceutical trading. The system must:
- Track every batch with manufacturing/expiry dates
- Prevent sale of expired/near-expiry stock
- Provide actionable alerts at multiple time horizons
- Support quarantine, return, and write-off workflows
- Maintain complete audit trail

---

## 2. Batch Lifecycle

```
RECEIVED (Purchase Invoice Posted)
    │
    ▼
ACTIVE (Available for sale, FEFO eligible)
    │
    ├───► DEPLETED (Available qty = 0)
    │
    ├───► QUARANTINED (Damaged, recalled, return pending)
    │         │
    │         ├──► RESTOCKED (If approved, back to ACTIVE)
    │         │
    │         ├──► RETURNED_TO_SUPPLIER (Purchase Return)
    │         │
    │         └──► WRITTEN_OFF (Expired/Damaged destruction)
    │
    └───► EXPIRED (Expiry date passed)
              │
              ├──► QUARANTINED (Awaiting disposal decision)
              │
              └──► WRITTEN_OFF
```

### 2.1 Batch Status Values
| Status | Saleable? | Description |
|--------|-----------|-------------|
| `active` | ✅ Yes | Normal stock, available for sale |
| `quarantined` | ❌ No | Held for review (damage, recall, return pending) |
| `expired` | ❌ No | Past expiry date, auto-transitioned |
| `depleted` | ❌ No | Zero available quantity |

---

## 3. Expiry Alert Tiers (Configurable)

Default tiers (from requirements + Excel analysis):

| Tier | Days Before Expiry | Label | Color | Action |
|------|-------------------|-------|-------|--------|
| 1 | 90 | Expiring in 90 days | 🔵 Blue | Review, promote sales |
| 2 | 60 | Expiring in 60 days | 🔵 Blue | Accelerate sales |
| 3 | 30 | Expiring in 30 days | 🟡 Amber | Priority sales, consider return |
| 4 | 7 | Expiring in 7 days | 🟠 Orange | Urgent action, stop new sales |
| 5 | 0 (Today) | Expires Today | 🔴 Red | Final sale day |
| 6 | < 0 | **EXPIRED** | 🔴 Red | **Block sale**, quarantine |

### 3.1 Alert Display Rules
- A batch appears in **only the most urgent applicable tier**
- Example: Batch expiring in 5 days → Shows in "7 days" tier only, not in "30/60/90"
- Expired batches → Show in "EXPIRED" category only

---

## 4. Sales Restrictions (Hard Enforcement)

### 4.1 Validation Rules (at Sale Posting Time)
1. **Expiry Check**: `batch.expiry_date >= sale_date` (sale date = invoice date)
2. **Availability Check**: `batch.available_quantity >= quantity_requested`
3. **Status Check**: `batch.status = 'active'`
4. **FEFO Compliance**: System suggests earliest expiry first; manual override allowed with warning

### 4.2 Revalidation at Posting
- All checks performed **at transaction commit**, not at page load
- Prevents race conditions (concurrent sales depleting same batch)
- Uses `SELECT ... FOR UPDATE` on batch rows during sale posting

### 4.3 Warning vs Blocking
| Condition | Warning | Block |
|-----------|---------|-------|
| Expiry ≤ 30 days | ✅ | ❌ |
| Expiry ≤ 7 days | ✅ | ❌ (configurable) |
| Expiry = Today | ✅ | ❌ (configurable) |
| Expiry < Today | ❌ | ✅ |
| Insufficient qty | ❌ | ✅ |
| Batch quarantined | ❌ | ✅ |

---

## 5. FEFO (First Expiry, First Out) Implementation

### 5.1 Algorithm
```
For each sales invoice line (medicine_id, qty_needed):
    1. SELECT * FROM medicine_batch
       WHERE medicine_id = ? 
         AND status = 'active'
         AND available_quantity > 0
         AND expiry_date >= sale_date
       ORDER BY expiry_date ASC, manufacturing_date ASC, id ASC
       FOR UPDATE
    
    2. Iterate batches, allocate qty_needed
    
    3. If insufficient total → REJECT entire sale
    
    4. Create sales_invoice_item rows per batch allocation
    
    5. Decrement batch.available_quantity
    
    6. Create inventory_movement records
```

### 5.2 Manual Override
- Owner can select specific batches
- System validates: active, not expired, sufficient qty
- Warning shown if not following FEFO

---

## 6. Expiry Dashboard

### 6.1 Summary Cards
| Metric | Query |
|--------|-------|
| Total Active Batches | COUNT(*) FROM medicine_batch WHERE status='active' |
| Batches Expiring ≤ 90 days | COUNT(*) WHERE expiry_date BETWEEN today AND today+90 |
| Qty Expiring ≤ 90 days | SUM(available_quantity) WHERE expiry_date BETWEEN today AND today+90 |
| Value Expiring ≤ 90 days | SUM(available_quantity × purchase_cost) WHERE ... |
| Expired Batches Count | COUNT(*) WHERE status='expired' |
| Expired Stock Value | SUM(available_quantity × purchase_cost) WHERE status='expired' |
| Low Stock Medicines | COUNT(DISTINCT medicine_id) FROM v_current_stock WHERE available_quantity ≤ reorder_level |

### 6.2 Detailed Lists
1. **Expiring Soon** (configurable days): Batch-level with medicine, supplier, qty, value, days left
2. **Expired Stock**: Batch-level with days past expiry, suggested action
3. **By Supplier**: Group expiring/expired by supplier for return discussions
4. **By Medicine**: Products with multiple expiring batches

### 6.3 Visual Indicators
- 🔴 Red: Expired / ≤ 7 days
- 🟠 Orange: 8-30 days
- 🟡 Amber: 31-60 days
- 🔵 Blue: 61-90 days
- 🟢 Green: > 90 days

---

## 7. Quarantine & Write-off Workflow

### 7.1 Quarantine Triggers
- Manual: Owner moves batch to quarantined
- Automatic: Expiry date passed (nightly job)
- Purchase Return: Returned stock defaults to quarantined
- Sales Return: Returned stock defaults to quarantined
- Damage Report: Stock adjustment with reason='damaged'

### 7.2 Quarantine Actions
| Action | Accounting Effect | Inventory Effect |
|--------|-------------------|------------------|
| **Restock** (approve) | None | Batch status → active |
| **Return to Supplier** | Purchase Return → Credit Note | Batch qty reduced, status → depleted |
| **Destroy/Write-off** | Expense (Write-off) / COGS | Batch status → depleted, qty → 0 |
| **Sell as Expired** (if regulated) | Special invoice, disclosure | Batch status → depleted |

### 7.3 Write-off Journal Entries

#### Expired Stock Write-off
```
Debit: EXPENSE (Expired Stock Write-off)  = Qty × Batch Cost
Credit: INVENTORY / QUARANTINE_INVENTORY  = Qty × Batch Cost
```

#### Damaged Stock Write-off
```
Debit: EXPENSE (Damaged Stock Write-off)  = Qty × Batch Cost
Credit: INVENTORY / QUARANTINE_INVENTORY  = Qty × Batch Cost
```

---

## 8. Automated Processes

### 8.1 Nightly Expiry Status Update (Cron/Scheduled Task)
```
FOR each batch WHERE status='active' AND expiry_date < CURRENT_DATE:
    UPDATE medicine_batch SET status='expired', updated_at=now()
    INSERT inventory_movement (reason='expired_writeoff', ...)
    CREATE audit_log entry
```

### 8.2 Alert Generation (Real-time + Daily Digest)
- **Real-time**: Dashboard queries current state
- **Daily Email/Notification** (optional): Summary of expiring/expired

### 8.3 Low Stock Alert
- Trigger: `available_quantity <= reorder_level` (per medicine)
- Separate from expiry alerts

---

## 9. Reports

### 9.1 Expiring Stock Report
| Columns |
|---------|
| Medicine, Batch #, Mfg Date, Expiry Date, Days Left, Qty Available, Unit Cost, Total Value, Supplier, Alert Tier |

### 9.2 Expired Stock Report
| Columns |
|---------|
| Medicine, Batch #, Expiry Date, Days Expired, Qty on Hand, Unit Cost, Total Value, Status (Quarantined/Write-off Pending), Suggested Action |

### 9.3 Expiry Value at Risk
- Sum of (qty × cost) for batches expiring in 30/60/90 days
- By supplier (for return negotiations)
- By medicine (for sales focus)

---

## 10. Database Implementation Details

### 10.1 Batch Table Constraints
```sql
-- Expiry date required
CHECK (expiry_date IS NOT NULL)

-- Manufacturing date <= Expiry date
CHECK (manufacturing_date IS NULL OR manufacturing_date <= expiry_date)

-- Available qty never exceeds received qty
CHECK (available_quantity <= received_quantity)

-- Available qty non-negative
CHECK (available_quantity >= 0)
```

### 10.2 Indexes for Expiry Queries
```sql
-- Primary expiry dashboard query
CREATE INDEX idx_batch_expiry_active 
ON medicine_batch (expiry_date, status) 
WHERE status = 'active' AND available_quantity > 0;

-- Expired batches
CREATE INDEX idx_batch_expired 
ON medicine_batch (expiry_date) 
WHERE status = 'expired';

-- Medicine + expiry for FEFO
CREATE INDEX idx_batch_medicine_expiry 
ON medicine_batch (medicine_id, expiry_date, status) 
WHERE status = 'active' AND available_quantity > 0;
```

### 10.3 Function: Get FEFO Batches
```sql
CREATE OR REPLACE FUNCTION get_fefo_batches(p_medicine_id UUID, p_qty_needed NUMERIC, p_sale_date DATE)
RETURNS TABLE (
    batch_id UUID,
    batch_number VARCHAR,
    expiry_date DATE,
    available_qty NUMERIC,
    cost_per_unit NUMERIC,
    allocate_qty NUMERIC
) AS $$
DECLARE
    v_remaining NUMERIC := p_qty_needed;
    v_batch RECORD;
BEGIN
    FOR v_batch IN
        SELECT id, batch_number, expiry_date, available_quantity, purchase_cost_per_unit
        FROM medicine_batch
        WHERE medicine_id = p_medicine_id
          AND status = 'active'
          AND available_quantity > 0
          AND expiry_date >= p_sale_date
        ORDER BY expiry_date ASC, manufacturing_date ASC NULLS FIRST, id ASC
        FOR UPDATE
    LOOP
        IF v_remaining <= 0 THEN EXIT; END IF;
        
        allocate_qty := LEAST(v_remaining, v_batch.available_quantity);
        v_remaining := v_remaining - allocate_qty;
        
        RETURN NEXT;
    END LOOP;
    
    IF v_remaining > 0 THEN
        RAISE EXCEPTION 'Insufficient stock: % units short', v_remaining;
    END IF;
END;
$$ LANGUAGE plpgsql;
```

---

## 11. UI/UX Considerations

### 11.1 Sales Invoice Form
- Medicine search shows: Name, Strength, **Total Saleable Qty**, **Earliest Expiry**
- Expand to see batch breakdown: Batch#, Expiry, Qty, Cost
- Default: Auto-allocate FEFO
- Override: Checkbox per batch, manual qty entry
- Visual: Red badge on expired, Orange on ≤7 days, Yellow on ≤30 days

### 11.2 Dashboard Expiry Widget
- Clickable summary cards → Drill down to detailed list
- Filter: By medicine, supplier, tier, location
- Export: CSV/Excel for supplier return discussions

### 11.3 Batch Detail Page
- Full history: Purchase invoice, all sales allocations, returns, adjustments
- Timeline view of quantity changes
- Quick actions: Quarantine, Initiate Return, Write-off

---

## 12. Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| `expiry_alert_tiers` | [90, 60, 30, 7] | Days before expiry for alerts |
| `block_sale_before_expiry_days` | 0 | Block sales N days before expiry (0 = only block on/after expiry) |
| `warn_sale_before_expiry_days` | 30 | Show warning N days before expiry |
| `auto_expire_batches` | true | Nightly job to mark expired |
| `default_return_action` | 'quarantine' | 'restock'/'quarantine'/'destroy' |
| `expired_stock_writeoff_account` | EXPENSE | Account for expired write-offs |

---

## 13. Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Batch expires same day as sale | Allowed (expiry date = last valid sale date) |
| Multiple batches same expiry | FIFO by manufacturing date, then batch ID |
| Partial batch sale | Available qty decremented, remains active |
| Sale return of near-expiry batch | Goes to quarantined; owner decides restock/destroy |
| Supplier returns expired batch | Purchase return → credit note → write-off |
| Backdated sale invoice | Validated against batch expiry at invoice date |
| Concurrent sales same batch | Row-level locking (FOR UPDATE) prevents oversell |

---

## 14. Testing Scenarios

1. **Purchase → Immediate Sale** (same batch, FEFO)
2. **Purchase → Partial Sale → Rest Sale** (batch depletion)
3. **Sale Exceeds Batch Qty** → Multi-batch allocation
4. **Sale Near Expiry** → Warning shown, allowed
5. **Sale Expired Batch** → Blocked
6. **Concurrent Sales Same Batch** → Serialized, no oversell
7. **Batch Auto-Expiry** → Nightly job marks expired
8. **Expired Batch Write-off** → Journal entry created
9. **Return Expired Batch to Supplier** → Purchase return + credit
10. **Backdated Invoice** → Validated at invoice date