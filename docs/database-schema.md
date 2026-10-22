# Walmus Pharma ERP - Database Schema Design

## 1. Design Principles

- **Normalized** (3NF) with selective denormalization for performance
- **UUID** primary keys for all entities
- **NUMERIC(18,4)** for monetary values, **NUMERIC(18,2)** for quantities
- **TIMESTAMPTZ** for all timestamps (UTC storage, PKT display)
- **Foreign keys** with `ON DELETE RESTRICT` to protect referential integrity
- **Check constraints** for business rules (non-negative stock, valid dates)
- **Indexes** on all FK columns, date columns, and search fields
- **Audit trail** on all financial/inventory mutations
- **Soft deletes** via `deleted_at` timestamp (except audit tables)

---

## 2. Enum Types

```sql
-- Invoice/Transaction statuses
CREATE TYPE invoice_status AS ENUM ('draft', 'posted', 'cancelled', 'partially_returned', 'fully_returned');
CREATE TYPE payment_status AS ENUM ('unpaid', 'partial', 'paid', 'overdue');
CREATE TYPE payment_method AS ENUM ('cash', 'bank_transfer', 'cheque', 'card', 'upi', 'other');
CREATE TYPE movement_reason AS ENUM (
    'purchase', 'purchase_return', 'sale', 'sale_return',
    'adjustment_in', 'adjustment_out', 'expired_writeoff',
    'damaged_writeoff', 'opening_stock', 'transfer_in', 'transfer_out'
);
CREATE TYPE batch_status AS ENUM ('active', 'quarantined', 'expired', 'depleted');
CREATE TYPE account_type AS ENUM ('cash', 'bank', 'receivable', 'payable', 'expense', 'revenue', 'cogs', 'equity', 'asset');
CREATE TYPE entity_type AS ENUM ('customer', 'doctor', 'supplier', 'distributor');
CREATE TYPE investment_status AS ENUM ('active', 'recovered', 'written_off');
```

---

## 3. Core Tables

### 3.1 Owner Settings (Singleton)

```sql
CREATE TABLE owner_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name VARCHAR(200) NOT NULL,
    business_address TEXT,
    phone VARCHAR(50),
    email VARCHAR(100),
    tax_number VARCHAR(50),           -- NTN/STRN
    currency CHAR(3) DEFAULT 'PKR',
    invoice_prefix VARCHAR(20) DEFAULT 'INV',
    purchase_prefix VARCHAR(20) DEFAULT 'PUR',
    invoice_number_format VARCHAR(50) DEFAULT '{PREFIX}-{YEAR}-{SEQ:06d}',
    purchase_number_format VARCHAR(50) DEFAULT '{PREFIX}-{YEAR}-{SEQ:06d}',
    financial_year_start_month INT DEFAULT 7,  -- July for Pakistan
    default_payment_terms_days INT DEFAULT 30,
    expiry_alert_days INT[] DEFAULT ARRAY[90, 60, 30, 7],
    default_tax_rate NUMERIC(5,2) DEFAULT 0.00,
    opening_cash_balance NUMERIC(18,2) DEFAULT 0,
    opening_bank_balance NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
-- Enforce singleton
CREATE UNIQUE INDEX ON owner_settings ((true)) WHERE id IS NOT NULL;
```

### 3.2 Legacy User / Audit Owner

The application is single-owner and no longer requires authentication. The `app_user` table is retained because many audit columns reference it; a single `owner` row is auto-created and used as the default `created_by`/`posted_by` value. Password and login columns are legacy and unused.

```sql
CREATE TABLE app_user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,  -- Argon2id
    full_name VARCHAR(100),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 Medicine Master

```sql
CREATE TABLE manufacturer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL UNIQUE,
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    tax_number VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE medicine_unit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,        -- 'TAB', 'CAP', 'BOT', 'INJ', 'BOX', 'STRIP', 'SACHET'
    name VARCHAR(50) NOT NULL,
    description VARCHAR(200),
    is_base_unit BOOLEAN DEFAULT false,      -- One base unit per medicine
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE medicine (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code VARCHAR(50) NOT NULL UNIQUE,  -- SKU
    barcode VARCHAR(100) UNIQUE,
    name VARCHAR(200) NOT NULL,
    generic_name VARCHAR(200),
    manufacturer_id UUID REFERENCES manufacturer(id) ON DELETE SET NULL,
    strength VARCHAR(100),                      -- e.g., '400mg', '20mg/5ml'
    dosage_form VARCHAR(50),                    -- 'Tablet', 'Capsule', 'Syrup', 'Injection'
    packing_description VARCHAR(200),           -- e.g., '10x10 Tablets', '100ml Bottle'
    base_unit_id UUID NOT NULL REFERENCES medicine_unit(id),
    units_per_pack INT NOT NULL DEFAULT 1,      -- Base units per purchase pack
    purchase_unit_id UUID REFERENCES medicine_unit(id),  -- Unit used for purchasing
    purchase_conversion_factor NUMERIC(18,4) DEFAULT 1, -- Purchase units to base units
    sale_unit_id UUID REFERENCES medicine_unit(id),      -- Unit used for selling
    sale_conversion_factor NUMERIC(18,4) DEFAULT 1,      -- Sale units to base units
    default_purchase_rate NUMERIC(18,4) DEFAULT 0,
    default_sale_rate NUMERIC(18,4) DEFAULT 0,
    wholesale_rate NUMERIC(18,4),
    retail_rate NUMERIC(18,4),
    tax_rate NUMERIC(5,2) DEFAULT 0,            -- Override owner default
    reorder_level INT DEFAULT 0,
    min_stock_qty INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES app_user(id)
);

CREATE INDEX idx_medicine_name ON medicine(name);
CREATE INDEX idx_medicine_product_code ON medicine(product_code);
CREATE INDEX idx_medicine_barcode ON medicine(barcode);
CREATE INDEX idx_medicine_manufacturer ON medicine(manufacturer_id);
CREATE INDEX idx_medicine_active ON medicine(is_active) WHERE is_active;
```

### 3.4 Supplier / Distributor

```sql
CREATE TABLE supplier (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    tax_number VARCHAR(50),           -- NTN/STRN
    credit_limit NUMERIC(18,2) DEFAULT 0,
    payment_terms_days INT DEFAULT 30,
    opening_balance NUMERIC(18,2) DEFAULT 0,  -- Positive = we owe them
    opening_balance_date DATE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES app_user(id)
);

CREATE INDEX idx_supplier_name ON supplier(name);
CREATE INDEX idx_supplier_active ON supplier(is_active) WHERE is_active;
```

### 3.5 Customer / Doctor

```sql
CREATE TABLE customer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    tax_number VARCHAR(50),
    customer_type VARCHAR(20) DEFAULT 'pharmacy',  -- pharmacy, hospital, clinic, doctor, distributor, other
    specialty VARCHAR(50),           -- For doctors: GP, Physician, Gyne, Peads, etc.
    area VARCHAR(100),
    credit_limit NUMERIC(18,2) DEFAULT 0,
    payment_terms_days INT DEFAULT 30,
    opening_balance NUMERIC(18,2) DEFAULT 0,  -- Positive = they owe us
    opening_balance_date DATE,
    default_sale_rate_type VARCHAR(20) DEFAULT 'retail', -- retail, wholesale, custom
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES app_user(id)
);

-- Doctor Investment / ROI Tracking
CREATE TABLE doctor_investment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    investment_amount NUMERIC(18,2) NOT NULL,
    investment_date DATE NOT NULL,
    roi_percentage NUMERIC(5,2) NOT NULL,  -- e.g., 30.00, 35.00
    expected_sale NUMERIC(18,2) GENERATED ALWAYS AS (investment_amount / (roi_percentage / 100)) STORED,
    status investment_status DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES app_user(id)
);

CREATE INDEX idx_customer_name ON customer(name);
CREATE INDEX idx_customer_type ON customer(customer_type);
CREATE INDEX idx_customer_active ON customer(is_active) WHERE is_active;
CREATE INDEX idx_doctor_investment_customer ON doctor_investment(customer_id);
CREATE INDEX idx_doctor_investment_status ON doctor_investment(status);
```

### 3.6 Medicine Batch (Critical for Expiry Management)

```sql
CREATE TABLE medicine_batch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_id UUID NOT NULL REFERENCES medicine(id) ON DELETE RESTRICT,
    batch_number VARCHAR(100) NOT NULL,
    manufacturing_date DATE,
    expiry_date DATE NOT NULL,
    supplier_id UUID REFERENCES supplier(id) ON DELETE SET NULL,
    purchase_invoice_id UUID,  -- FK added after purchase_invoice table
    received_quantity NUMERIC(18,4) NOT NULL,  -- In base units
    available_quantity NUMERIC(18,4) NOT NULL DEFAULT 0,  -- In base units
    purchase_cost_per_unit NUMERIC(18,4) NOT NULL,  -- In base unit cost
    status batch_status DEFAULT 'active',
    location VARCHAR(100) DEFAULT 'MAIN',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX uq_medicine_batch ON medicine_batch(medicine_id, batch_number, supplier_id);
CREATE INDEX idx_batch_expiry ON medicine_batch(expiry_date) WHERE status = 'active';
CREATE INDEX idx_batch_medicine ON medicine_batch(medicine_id);
CREATE INDEX idx_batch_supplier ON medicine_batch(supplier_id);
CREATE INDEX idx_batch_status ON medicine_batch(status);
CREATE INDEX idx_batch_available ON medicine_batch(available_quantity) WHERE available_quantity > 0 AND status = 'active';
```

### 3.7 Purchase Invoice

```sql
CREATE TABLE purchase_invoice (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_number VARCHAR(50) NOT NULL UNIQUE,
    supplier_invoice_number VARCHAR(100),
    supplier_id UUID NOT NULL REFERENCES supplier(id) ON DELETE RESTRICT,
    invoice_date DATE NOT NULL,
    received_date DATE,
    due_date DATE,
    status invoice_status DEFAULT 'draft',
    subtotal NUMERIC(18,2) DEFAULT 0,
    discount_amount NUMERIC(18,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    total_amount NUMERIC(18,2) DEFAULT 0,
    amount_paid NUMERIC(18,2) DEFAULT 0,
    balance_amount NUMERIC(18,2) DEFAULT 0,
    payment_status payment_status DEFAULT 'unpaid',
    notes TEXT,
    attachment_path VARCHAR(500),
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES app_user(id),
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES app_user(id),
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES app_user(id)
);

CREATE INDEX idx_purchase_invoice_supplier ON purchase_invoice(supplier_id);
CREATE INDEX idx_purchase_invoice_date ON purchase_invoice(invoice_date);
CREATE INDEX idx_purchase_invoice_status ON purchase_invoice(status);
CREATE INDEX idx_purchase_invoice_voucher ON purchase_invoice(voucher_number);

-- Add FK from medicine_batch
ALTER TABLE medicine_batch ADD CONSTRAINT fk_batch_purchase_invoice
    FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoice(id) ON DELETE SET NULL;
```

### 3.8 Purchase Invoice Items

```sql
CREATE TABLE purchase_invoice_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_invoice_id UUID NOT NULL REFERENCES purchase_invoice(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    medicine_id UUID NOT NULL REFERENCES medicine(id) ON DELETE RESTRICT,
    batch_number VARCHAR(100) NOT NULL,
    manufacturing_date DATE,
    expiry_date DATE NOT NULL,
    quantity_received NUMERIC(18,4) NOT NULL,  -- In purchase units
    purchase_unit_id UUID REFERENCES medicine_unit(id),
    conversion_factor NUMERIC(18,4) NOT NULL DEFAULT 1,  -- Purchase units to base units
    quantity_base_units NUMERIC(18,4) GENERATED ALWAYS AS (quantity_received * conversion_factor) STORED,
    purchase_rate NUMERIC(18,4) NOT NULL,  -- Per purchase unit
    discount_percent NUMERIC(5,2) DEFAULT 0,
    discount_amount NUMERIC(18,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    line_total NUMERIC(18,2) NOT NULL,
    batch_id UUID REFERENCES medicine_batch(id) ON DELETE SET NULL,  -- Set after posting
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (purchase_invoice_id, line_number)
);

CREATE INDEX idx_purchase_item_medicine ON purchase_invoice_item(medicine_id);
CREATE INDEX idx_purchase_item_batch ON purchase_invoice_item(batch_id);
```

### 3.9 Sales Invoice

```sql
CREATE TABLE sales_invoice (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE RESTRICT,
    invoice_date DATE NOT NULL,
    due_date DATE,
    status invoice_status DEFAULT 'draft',
    subtotal NUMERIC(18,2) DEFAULT 0,
    discount_amount NUMERIC(18,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    total_amount NUMERIC(18,2) DEFAULT 0,
    amount_received NUMERIC(18,2) DEFAULT 0,
    balance_amount NUMERIC(18,2) DEFAULT 0,
    payment_status payment_status DEFAULT 'unpaid',
    notes TEXT,
    printed_count INT DEFAULT 0,
    last_printed_at TIMESTAMPTZ,
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES app_user(id),
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES app_user(id),
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES app_user(id)
);

CREATE INDEX idx_sales_invoice_customer ON sales_invoice(customer_id);
CREATE INDEX idx_sales_invoice_date ON sales_invoice(invoice_date);
CREATE INDEX idx_sales_invoice_status ON sales_invoice(status);
CREATE INDEX idx_sales_invoice_number ON sales_invoice(invoice_number);
```

### 3.10 Sales Invoice Items (with Batch Allocation)

```sql
CREATE TABLE sales_invoice_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_invoice_id UUID NOT NULL REFERENCES sales_invoice(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    medicine_id UUID NOT NULL REFERENCES medicine(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES medicine_batch(id) ON DELETE RESTRICT,
    quantity_sold NUMERIC(18,4) NOT NULL,  -- In sale units
    sale_unit_id UUID REFERENCES medicine_unit(id),
    conversion_factor NUMERIC(18,4) NOT NULL DEFAULT 1,  -- Sale units to base units
    quantity_base_units NUMERIC(18,4) GENERATED ALWAYS AS (quantity_sold * conversion_factor) STORED,
    sale_rate NUMERIC(18,4) NOT NULL,  -- Per sale unit
    discount_percent NUMERIC(5,2) DEFAULT 0,
    discount_amount NUMERIC(18,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    line_total NUMERIC(18,2) NOT NULL,
    cost_per_base_unit NUMERIC(18,4) NOT NULL,  -- Batch purchase cost at time of sale
    cogs_amount NUMERIC(18,2) GENERATED ALWAYS AS (quantity_base_units * cost_per_base_unit) STORED,
    gross_profit NUMERIC(18,2) GENERATED ALWAYS AS (line_total - (quantity_base_units * cost_per_base_unit)) STORED,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (sales_invoice_id, line_number)
);

CREATE INDEX idx_sales_item_medicine ON sales_invoice_item(medicine_id);
CREATE INDEX idx_sales_item_batch ON sales_invoice_item(batch_id);
```

### 3.11 Purchase Returns

```sql
CREATE TABLE purchase_return (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number VARCHAR(50) NOT NULL UNIQUE,
    original_purchase_invoice_id UUID NOT NULL REFERENCES purchase_invoice(id) ON DELETE RESTRICT,
    supplier_id UUID NOT NULL REFERENCES supplier(id) ON DELETE RESTRICT,
    return_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason VARCHAR(500),
    status invoice_status DEFAULT 'draft',
    total_amount NUMERIC(18,2) DEFAULT 0,
    credit_note_number VARCHAR(50),
    notes TEXT,
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES app_user(id)
);

CREATE TABLE purchase_return_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_return_id UUID NOT NULL REFERENCES purchase_return(id) ON DELETE CASCADE,
    original_purchase_item_id UUID NOT NULL REFERENCES purchase_invoice_item(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES medicine_batch(id) ON DELETE RESTRICT,
    quantity_returned NUMERIC(18,4) NOT NULL,  -- In base units
    return_rate NUMERIC(18,4) NOT NULL,
    line_total NUMERIC(18,2) NOT NULL,
    restock_action VARCHAR(20) DEFAULT 'quarantine',  -- 'restock', 'quarantine', 'destroy'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.12 Sales Returns

```sql
CREATE TABLE sales_return (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number VARCHAR(50) NOT NULL UNIQUE,
    original_sales_invoice_id UUID NOT NULL REFERENCES sales_invoice(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE RESTRICT,
    return_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason VARCHAR(500),
    status invoice_status DEFAULT 'draft',
    total_amount NUMERIC(18,2) DEFAULT 0,
    refund_amount NUMERIC(18,2) DEFAULT 0,
    credit_note_number VARCHAR(50),
    notes TEXT,
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES app_user(id)
);

CREATE TABLE sales_return_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_return_id UUID NOT NULL REFERENCES sales_return(id) ON DELETE CASCADE,
    original_sales_item_id UUID NOT NULL REFERENCES sales_invoice_item(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES medicine_batch(id) ON DELETE RESTRICT,
    quantity_returned NUMERIC(18,4) NOT NULL,  -- In base units
    return_rate NUMERIC(18,4) NOT NULL,
    line_total NUMERIC(18,2) NOT NULL,
    restock_action VARCHAR(20) DEFAULT 'quarantine',  -- 'restock', 'quarantine', 'destroy'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Inventory & Stock Movement

### 4.1 Inventory Movements (Immutable Audit Trail)

```sql
CREATE TABLE inventory_movement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    medicine_id UUID NOT NULL REFERENCES medicine(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES medicine_batch(id) ON DELETE SET NULL,
    reason movement_reason NOT NULL,
    quantity_change NUMERIC(18,4) NOT NULL,  -- Positive = in, Negative = out (in base units)
    quantity_before NUMERIC(18,4) NOT NULL,
    quantity_after NUMERIC(18,4) NOT NULL,
    unit_cost NUMERIC(18,4),  -- Cost per base unit at time of movement
    reference_type VARCHAR(50),  -- 'purchase_invoice', 'sales_invoice', 'purchase_return', 'sales_return', 'adjustment', 'opening_stock'
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES app_user(id),
    -- Prevent modification
    CONSTRAINT chk_movement_immutable CHECK (false) NO INHERIT  -- Trigger will enforce
);

CREATE INDEX idx_invmov_medicine_date ON inventory_movement(medicine_id, movement_date DESC);
CREATE INDEX idx_invmov_batch_date ON inventory_movement(batch_id, movement_date DESC);
CREATE INDEX idx_invmov_reason ON inventory_movement(reason);
CREATE INDEX idx_invmov_reference ON inventory_movement(reference_type, reference_id);
```

### 4.2 Stock Adjustments (Manual Corrections)

```sql
CREATE TABLE stock_adjustment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_number VARCHAR(50) NOT NULL UNIQUE,
    adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason VARCHAR(500) NOT NULL,
    reference_type VARCHAR(50),  -- 'expired_writeoff', 'damaged', 'physical_count', 'other'
    reference_id UUID,
    total_items INT DEFAULT 0,
    total_value_change NUMERIC(18,2) DEFAULT 0,
    status invoice_status DEFAULT 'draft',
    notes TEXT,
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES app_user(id)
);

CREATE TABLE stock_adjustment_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_adjustment_id UUID NOT NULL REFERENCES stock_adjustment(id) ON DELETE CASCADE,
    medicine_id UUID NOT NULL REFERENCES medicine(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES medicine_batch(id) ON DELETE SET NULL,
    quantity_change NUMERIC(18,4) NOT NULL,  -- In base units
    unit_cost NUMERIC(18,4),
    value_change NUMERIC(18,2) GENERATED ALWAYS AS (quantity_change * unit_cost) STORED,
    notes TEXT
);
```

---

## 5. Financial Management

### 5.1 Financial Accounts (Cash, Bank, Receivable, Payable)

```sql
CREATE TABLE financial_account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,  -- 'CASH', 'BANK-HBL', 'RECEIVABLE', 'PAYABLE', etc.
    name VARCHAR(100) NOT NULL,
    account_type account_type NOT NULL,
    currency CHAR(3) DEFAULT 'PKR',
    opening_balance NUMERIC(18,2) DEFAULT 0,
    opening_balance_date DATE,
    current_balance NUMERIC(18,2) GENERATED ALWAYS AS (
        opening_balance + COALESCE((
            SELECT SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END)
            FROM journal_entry_line jel
            JOIN journal_entry je ON je.id = jel.journal_entry_id
            WHERE jel.account_id = financial_account.id AND je.status = 'posted'
        ), 0)
    ) STORED,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed data for standard accounts
INSERT INTO financial_account (code, name, account_type, opening_balance) VALUES
('CASH', 'Cash in Hand', 'cash', 0),
('BANK', 'Bank Account', 'bank', 0),
('RECEIVABLE', 'Accounts Receivable', 'receivable', 0),
('PAYABLE', 'Accounts Payable', 'payable', 0),
('SALES_REV', 'Sales Revenue', 'revenue', 0),
('COGS', 'Cost of Goods Sold', 'cogs', 0),
('EXPENSE', 'Operating Expenses', 'expense', 0),
('DISCOUNT_GIVEN', 'Discount Allowed', 'expense', 0),
('DISCOUNT_RECEIVED', 'Discount Received', 'revenue', 0),
('TAX_PAYABLE', 'Tax Payable', 'payable', 0),
('INVENTORY', 'Inventory Asset', 'asset', 0);
```

### 5.2 Journal Entries (Double-Entry Accounting)

```sql
CREATE TABLE journal_entry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number VARCHAR(50) NOT NULL UNIQUE,
    entry_date DATE NOT NULL,
    reference_type VARCHAR(50),  -- 'purchase_invoice', 'sales_invoice', 'payment', 'expense', 'adjustment'
    reference_id UUID,
    description TEXT,
    total_debit NUMERIC(18,2) DEFAULT 0,
    total_credit NUMERIC(18,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'posted',  -- 'draft', 'posted', 'reversed'
    reversed_entry_id UUID REFERENCES journal_entry(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES app_user(id),
    CONSTRAINT chk_balanced CHECK (total_debit = total_credit)
);

CREATE TABLE journal_entry_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entry(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES financial_account(id) ON DELETE RESTRICT,
    line_number INT NOT NULL,
    entry_type VARCHAR(6) NOT NULL CHECK (entry_type IN ('debit', 'credit')),
    amount NUMERIC(18,2) NOT NULL,
    description TEXT,
    party_type VARCHAR(20),  -- 'customer', 'supplier', 'employee', 'other'
    party_id UUID,
    UNIQUE (journal_entry_id, line_number)
);

CREATE INDEX idx_je_date ON journal_entry(entry_date);
CREATE INDEX idx_je_reference ON journal_entry(reference_type, reference_id);
CREATE INDEX idx_jel_account ON journal_entry_line(account_id);
CREATE INDEX idx_jel_party ON journal_entry_line(party_type, party_id);
```

### 5.3 Payments (Customer Receipts & Supplier Payments)

```sql
CREATE TABLE payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number VARCHAR(50) NOT NULL UNIQUE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    account_id UUID NOT NULL REFERENCES financial_account(id) ON DELETE RESTRICT,  -- Cash/Bank account
    party_type VARCHAR(20) NOT NULL CHECK (party_type IN ('customer', 'supplier')),
    party_id UUID NOT NULL,
    payment_method payment_method NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    reference_number VARCHAR(100),  -- Cheque #, transaction ID
    status VARCHAR(20) DEFAULT 'posted',  -- 'posted', 'cancelled', 'bounced'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES app_user(id)
);

CREATE TABLE payment_allocation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
    invoice_type VARCHAR(20) NOT NULL CHECK (invoice_type IN ('sales', 'purchase')),
    invoice_id UUID NOT NULL,  -- sales_invoice.id or purchase_invoice.id
    allocated_amount NUMERIC(18,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payment_party ON payment(party_type, party_id);
CREATE INDEX idx_payment_date ON payment(payment_date);
CREATE INDEX idx_payment_account ON payment(account_id);
```

### 5.4 Expenses

```sql
CREATE TABLE expense_category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,  -- 'RENT', 'SALARY', 'ELECTRICITY', 'FUEL', 'TRANSPORT', 'TELEPHONE', 'OFFICE', 'OTHER'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE expense (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_number VARCHAR(50) NOT NULL UNIQUE,
    expense_date DATE NOT NULL,
    category_id UUID NOT NULL REFERENCES expense_category(id) ON DELETE RESTRICT,
    account_id UUID NOT NULL REFERENCES financial_account(id) ON DELETE RESTRICT,  -- Paid from Cash/Bank
    amount NUMERIC(18,2) NOT NULL,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    description TEXT,
    reference_number VARCHAR(100),
    attachment_path VARCHAR(500),
    status VARCHAR(20) DEFAULT 'posted',
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES app_user(id)
);

CREATE INDEX idx_expense_date ON expense(expense_date);
CREATE INDEX idx_expense_category ON expense(category_id);
CREATE INDEX idx_expense_account ON expense(account_id);
```

---

## 6. Opening Balances

```sql
CREATE TABLE opening_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    balance_date DATE NOT NULL UNIQUE,  -- One set per financial year start
    description VARCHAR(200),
    status VARCHAR(20) DEFAULT 'draft',  -- 'draft', 'posted'
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE opening_balance_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opening_balance_id UUID NOT NULL REFERENCES opening_balance(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('medicine_batch', 'supplier', 'customer', 'cash', 'bank', 'expense_category')),
    reference_id UUID NOT NULL,  -- batch_id, supplier_id, customer_id, account_id
    quantity NUMERIC(18,4),  -- For medicine_batch
    unit_cost NUMERIC(18,4),  -- For medicine_batch
    amount NUMERIC(18,2),  -- For supplier/customer/account balances
    notes TEXT
);
```

---

## 7. Audit & System

### 7.1 Audit Log

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID REFERENCES app_user(id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    action VARCHAR(50) NOT NULL,  -- 'create', 'update', 'delete', 'post', 'cancel', 'print', 'login', 'logout'
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(100)
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user_time ON audit_log(user_id, event_time DESC);
CREATE INDEX idx_audit_time ON audit_log(event_time DESC);
```

### 7.2 Application Settings

```sql
CREATE TABLE application_setting (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES app_user(id)
);
```

### 7.3 Number Sequences

```sql
CREATE TABLE number_sequence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefix VARCHAR(20) NOT NULL UNIQUE,  -- 'INV', 'PUR', 'CRN', 'DBN', 'PAY', 'EXP', 'ADJ', 'OB'
    current_sequence INT NOT NULL DEFAULT 0,
    financial_year INT NOT NULL,  -- e.g., 2025 for FY 2025-26
    format_template VARCHAR(100) NOT NULL DEFAULT '{PREFIX}-{YEAR}-{SEQ:06d}',
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 7.4 Import Tracking and Historical Performance

Historical workbook data is stored separately from live transactions so it can be reported without creating fake invoices.

```sql
CREATE TABLE import_batch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_file VARCHAR(255) NOT NULL,
    source_sheet VARCHAR(100),
    import_type VARCHAR(50) NOT NULL,      -- medicines | customers | suppliers | sales-history | workbook
    status VARCHAR(30) NOT NULL,           -- completed | completed_with_errors | failed
    rows_total INT DEFAULT 0,
    rows_imported INT DEFAULT 0,
    rows_skipped INT DEFAULT 0,
    rows_failed INT DEFAULT 0,
    summary JSONB,
    notes TEXT,
    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE imported_sales_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL REFERENCES import_batch(id) ON DELETE CASCADE,
    period_year INT NOT NULL,
    period_month INT NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    product_code VARCHAR(50),
    quantity_sold NUMERIC(18,4) DEFAULT 0,
    sale_amount NUMERIC(18,2) DEFAULT 0,
    purchase_quantity NUMERIC(18,4) DEFAULT 0,
    purchase_amount NUMERIC(18,2) DEFAULT 0,
    profit_amount NUMERIC(18,2) DEFAULT 0,
    balance_quantity NUMERIC(18,4) DEFAULT 0,
    source_row INT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (period_year, period_month, product_name)
);

CREATE TABLE imported_month_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL REFERENCES import_batch(id) ON DELETE CASCADE,
    period_year INT NOT NULL,
    period_month INT NOT NULL,
    total_sales NUMERIC(18,2) DEFAULT 0,
    total_purchase NUMERIC(18,2) DEFAULT 0,
    total_purchase_out NUMERIC(18,2) DEFAULT 0,
    total_profit NUMERIC(18,2) DEFAULT 0,
    total_discount NUMERIC(18,2) DEFAULT 0,
    total_expense NUMERIC(18,2) DEFAULT 0,
    closing_balance_units NUMERIC(18,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (period_year, period_month)
);

CREATE TABLE imported_customer_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL REFERENCES import_batch(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customer(id) ON DELETE SET NULL,
    customer_name VARCHAR(200) NOT NULL,
    period_year INT NOT NULL,
    period_month INT NOT NULL,
    actual_sales NUMERIC(18,2) DEFAULT 0,
    source VARCHAR(30) NOT NULL DEFAULT 'roi', -- roi | olx
    source_row INT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (customer_name, period_year, period_month, source)
);
```

---

## 8. Views for Reporting

### 8.1 Current Stock View (Saleable)

```sql
CREATE VIEW v_current_stock AS
SELECT
    m.id AS medicine_id,
    m.product_code,
    m.name AS medicine_name,
    m.generic_name,
    m.strength,
    m.dosage_form,
    man.name AS manufacturer,
    mb.id AS batch_id,
    mb.batch_number,
    mb.manufacturing_date,
    mb.expiry_date,
    mb.available_quantity,
    mb.purchase_cost_per_unit,
    (mb.available_quantity * mb.purchase_cost_per_unit) AS stock_value,
    s.name AS supplier_name,
    CASE
        WHEN mb.expiry_date < CURRENT_DATE THEN 'expired'
        WHEN mb.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'critical'
        WHEN mb.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_30'
        WHEN mb.expiry_date <= CURRENT_DATE + INTERVAL '60 days' THEN 'expiring_60'
        WHEN mb.expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_90'
        ELSE 'ok'
    END AS expiry_status,
    mb.location,
    mb.status
FROM medicine_batch mb
JOIN medicine m ON m.id = mb.medicine_id
LEFT JOIN manufacturer man ON man.id = m.manufacturer_id
LEFT JOIN supplier s ON s.id = mb.supplier_id
WHERE mb.status = 'active' AND mb.available_quantity > 0
ORDER BY mb.expiry_date ASC, m.name;
```

### 8.2 Customer Outstanding View

```sql
CREATE VIEW v_customer_outstanding AS
SELECT
    c.id AS customer_id,
    c.name,
    c.customer_type,
    c.specialty,
    c.area,
    c.credit_limit,
    COALESCE(SUM(
        CASE
            WHEN si.status = 'posted' THEN si.balance_amount
            ELSE 0
        END
    ), 0) AS total_outstanding,
    COALESCE(SUM(
        CASE
            WHEN si.status = 'posted' AND si.due_date < CURRENT_DATE AND si.balance_amount > 0 THEN si.balance_amount
            ELSE 0
        END
    ), 0) AS overdue_amount,
    MAX(si.invoice_date) AS last_invoice_date,
    COUNT(CASE WHEN si.status = 'posted' AND si.balance_amount > 0 THEN 1 END) AS pending_invoices
FROM customer c
LEFT JOIN sales_invoice si ON si.customer_id = c.id
WHERE c.is_active
GROUP BY c.id, c.name, c.customer_type, c.specialty, c.area, c.credit_limit;
```

### 8.3 Supplier Outstanding View

```sql
CREATE VIEW v_supplier_outstanding AS
SELECT
    s.id AS supplier_id,
    s.name,
    COALESCE(SUM(
        CASE
            WHEN pi.status = 'posted' THEN pi.balance_amount
            ELSE 0
        END
    ), 0) AS total_payable,
    COALESCE(SUM(
        CASE
            WHEN pi.status = 'posted' AND pi.due_date < CURRENT_DATE AND pi.balance_amount > 0 THEN pi.balance_amount
            ELSE 0
        END
    ), 0) AS overdue_amount,
    MAX(pi.invoice_date) AS last_invoice_date,
    COUNT(CASE WHEN pi.status = 'posted' AND pi.balance_amount > 0 THEN 1 END) AS pending_invoices
FROM supplier s
LEFT JOIN purchase_invoice pi ON pi.supplier_id = s.id
WHERE s.is_active
GROUP BY s.id, s.name;
```

### 8.4 Gross Profit View

```sql
CREATE VIEW v_gross_profit AS
SELECT
    DATE_TRUNC('month', si.invoice_date)::DATE AS month_start,
    m.id AS medicine_id,
    m.name AS medicine_name,
    SUM(sii.quantity_base_units) AS units_sold,
    SUM(sii.line_total) AS revenue,
    SUM(sii.cogs_amount) AS cogs,
    SUM(sii.gross_profit) AS gross_profit,
    CASE WHEN SUM(sii.line_total) > 0
         THEN ROUND((SUM(sii.gross_profit) / SUM(sii.line_total)) * 100, 2)
         ELSE 0 END AS gross_margin_pct
FROM sales_invoice si
JOIN sales_invoice_item sii ON sii.sales_invoice_id = si.id
JOIN medicine m ON m.id = sii.medicine_id
WHERE si.status = 'posted'
GROUP BY DATE_TRUNC('month', si.invoice_date), m.id, m.name
ORDER BY month_start DESC, gross_profit DESC;
```

---

## 9. Key Triggers & Functions

### 9.1 Batch Availability Update (on Sales/Purchase Post)

```sql
CREATE OR REPLACE FUNCTION update_batch_availability()
RETURNS TRIGGER AS $$
BEGIN
    -- This is called from application service layer, not DB trigger
    -- to maintain transaction control
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 9.2 Auto-generate Voucher Numbers

```sql
CREATE OR REPLACE FUNCTION get_next_voucher_number(p_prefix VARCHAR, p_fy INT)
RETURNS VARCHAR AS $$
DECLARE
    v_seq INT;
    v_result VARCHAR;
BEGIN
    UPDATE number_sequence
    SET current_sequence = current_sequence + 1,
        updated_at = now()
    WHERE prefix = p_prefix AND financial_year = p_fy
    RETURNING current_sequence INTO v_seq;
    
    IF NOT FOUND THEN
        INSERT INTO number_sequence (prefix, current_sequence, financial_year)
        VALUES (p_prefix, 1, p_fy)
        RETURNING current_sequence INTO v_seq;
    END IF;
    
    v_result := REPLACE(REPLACE(
        (SELECT format_template FROM number_sequence WHERE prefix = p_prefix AND financial_year = p_fy),
        '{PREFIX}', p_prefix),
        '{YEAR}', p_fy::VARCHAR);
    v_result := REPLACE(v_result, '{SEQ:06d}', LPAD(v_seq::VARCHAR, 6, '0'));
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

### 9.3 Recalculate Account Balances

```sql
CREATE OR REPLACE FUNCTION recalculate_account_balance(p_account_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_balance NUMERIC(18,2);
BEGIN
    SELECT opening_balance + COALESCE(SUM(
        CASE WHEN jel.entry_type = 'credit' THEN jel.amount ELSE -jel.amount END
    ), 0)
    INTO v_balance
    FROM financial_account fa
    LEFT JOIN journal_entry_line jel ON jel.account_id = fa.id
    LEFT JOIN journal_entry je ON je.id = jel.journal_entry_id AND je.status = 'posted'
    WHERE fa.id = p_account_id;
    
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;
```

---

## 10. Migration Strategy (Alembic)

### Migration Order (actual Alembic revisions)
1. `001_init_enums_and_core.py` - Enum types, owner_settings, app_user
2. `002_master_data.py` - Manufacturer, medicine_unit, medicine, supplier, customer, doctor_investment
3. `003_inventory.py` - Medicine batches, purchase/sales invoices and items, returns, movements, adjustments
4. `004_financial.py` - Financial accounts, journal entries, payments, expenses, opening balances
5. `005_audit_settings.py` - Audit log, application settings, number sequences
6. `006_seed_data.py` - Default units, expense categories, accounts, sequences
7. `007_views.py` - Reporting views (stock, outstanding, profit)
8. `008_functions_triggers.py` - Voucher numbering, batch updates, FEFO, immutability
9. `009_investment_and_targets.py` - Investment transaction ledger and sales targets
10. `010_import_tracking.py` - Import batches, historical sales, month summaries, customer performance
11. `011_audit_timestamp_alignment.py` - Adds missing `created_at`/`updated_at` columns to early tables

---

## 11. Critical Constraints Summary

| Rule | Implementation |
|------|----------------|
| No negative saleable stock | CHECK (available_quantity >= 0) on medicine_batch + application validation |
| Expired batches not saleable | Application logic + CHECK (expiry_date >= CURRENT_DATE) on sales_invoice_item insert |
| Invoice number uniqueness | UNIQUE constraint on voucher_number / invoice_number |
| Balanced journal entries | CHECK (total_debit = total_credit) on journal_entry |
| FEFO enforcement | Application service sorts batches by expiry_date ASC |
| Draft invoices don't affect stock | status = 'draft' excluded from stock/financial calculations |
| Immutable inventory movements | No UPDATE/DELETE on inventory_movement (enforced by trigger) |
| Doctor investment tracking | Separate table with expected_sale computed column |