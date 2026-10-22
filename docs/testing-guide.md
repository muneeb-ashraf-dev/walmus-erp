# Testing Guide

## Overview

This guide covers the testing strategy, test organization, and how to run tests for the Walmus Pharma ERP.

## Test Pyramid

```
         /\
        /  \     E2E Tests (Playwright) - Few, critical paths
       /____\
      /      \   Integration Tests - API, database, services
     /________\
    /          \ Unit Tests - Business logic, utilities, schemas
   /____________\
```

## Test Structure

```
backend/
├── tests/
│   ├── conftest.py              # Pytest fixtures
│   ├── unit/
│   │   ├── test_access.py       # Default owner / no-login behavior
│   │   ├── test_inventory.py    # Inventory calculations
│   │   ├── test_accounting.py   # Accounting rules
│   │   ├── test_expiry.py       # Expiry management
│   │   └── test_schemas.py      # Pydantic validation
│   ├── integration/
│   │   ├── test_purchase_flow.py    # Purchase invoice lifecycle
│   │   ├── test_sales_flow.py       # Sales invoice lifecycle
│   │   ├── test_payment_flow.py     # Payment allocation
│   │   └── test_return_flow.py      # Return workflows
│   ├── e2e/
│   │   └── test_full_workflow.py    # Complete purchase-to-sale
│   └── fixtures/
│       └── sample_data.py           # Test data factories
```

## Running Tests

### All Tests

```bash
cd backend
uv run pytest -v
```

### Specific Categories

```bash
# Unit tests only
uv run pytest tests/unit -v

# Integration tests
uv run pytest tests/integration -v

# E2E tests
uv run pytest tests/e2e -v

# Specific test file
uv run pytest tests/unit/test_inventory.py -v

# Specific test
uv run pytest tests/unit/test_inventory.py::test_fefo_allocation -v
```

### With Coverage

```bash
uv run pytest --cov=app --cov-report=html --cov-report=term
```

### Parallel Execution

```bash
uv run pytest -n auto
```

## Test Configuration

### conftest.py

```python
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app
from app.models import *

# Test database URL (separate from development)
TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/pharma_erp_test"

@pytest_asyncio.fixture(scope="session")
async def engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest_asyncio.fixture
async def db_session(engine):
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session
        await session.rollback()

@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()

@pytest.fixture
def sample_medicine():
    return {
        "product_code": "TEST001",
        "name": "Test Medicine",
        "generic_name": "Test Generic",
        "base_unit_id": "TAB",
        "default_purchase_rate": 100.0,
        "default_sale_rate": 150.0,
    }
```

## Key Test Scenarios

### Access and Import Tests

The no-login build resolves a default local owner automatically. There are no login or token tests.

```python
# tests/unit/test_access.py
async def test_owner_settings_without_token(client):
    response = await client.get("/api/settings/owner")
    assert response.status_code == 200
    assert response.json()["business_name"]

async def test_dashboard_without_token(client):
    response = await client.get("/api/dashboard/stats")
    assert response.status_code == 200

# tests/unit/test_imports.py
async def test_medicine_import_preview(client):
    files = {"file": ("medicines.csv", b"Product Code,Name\nTEST-1,Test Medicine\n", "text/csv")}
    response = await client.post("/api/import-export/preview?entity=medicines", files=files)
    assert response.status_code == 200
    assert response.json()["valid_rows"] == 1

async def test_workbook_preview(client):
    content = open("Sale Sheet MA-Na.xlsx", "rb").read()
    files = {"file": ("Sale Sheet MA-Na.xlsx", content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    response = await client.post("/api/import-export/workbook/preview", files=files)
    assert response.status_code == 200
    assert response.json()["totals"]["products"] > 0
```

### Inventory Tests

```python
# tests/unit/test_inventory.py
async def test_batch_creation(db_session):
    medicine = MedicineFactory()
    batch = MedicineBatchFactory(medicine_id=medicine.id)
    
    assert batch.available_quantity == batch.received_quantity
    assert batch.status == "active"

async def test_fefo_allocation(db_session):
    medicine = MedicineFactory()
    # Create 3 batches with different expiry dates
    batch1 = MedicineBatchFactory(medicine_id=medicine.id, expiry_date=date.today() + timedelta(days=30))
    batch2 = MedicineBatchFactory(medicine_id=medicine.id, expiry_date=date.today() + timedelta(days=60))
    batch3 = MedicineBatchFactory(medicine_id=medicine.id, expiry_date=date.today() + timedelta(days=90))
    
    # Allocate 150 units, need 2 batches
    allocations = get_fefo_allocations(medicine.id, 150, date.today())
    
    assert len(allocations) == 2
    assert allocations[0].batch_id == batch1.id
    assert allocations[1].batch_id == batch2.id

async def test_expired_batch_blocked(db_session):
    medicine = MedicineFactory()
    batch = MedicineBatchFactory(medicine_id=medicine.id, expiry_date=date.today() - timedelta(days=1))
    
    with pytest.raises(ExpiredBatchError):
        create_sale_invoice(medicine_id=medicine.id, batch_id=batch.id, quantity=10)

async def test_insufficient_stock_blocked(db_session):
    medicine = MedicineFactory()
    batch = MedicineBatchFactory(medicine_id=medicine.id, available_quantity=5)
    
    with pytest.raises(InsufficientStockError):
        create_sale_invoice(medicine_id=medicine.id, batch_id=batch.id, quantity=10)
```

### Accounting Tests

```python
# tests/unit/test_accounting.py
async def test_purchase_invoice_journal_entries(db_session):
    invoice = PurchaseInvoiceFactory()
    items = [PurchaseInvoiceItemFactory(invoice_id=invoice.id) for _ in range(3)]
    
    await post_purchase_invoice(invoice.id)
    
    # Verify journal entry created
    je = await get_journal_entry_for_purchase(invoice.id)
    assert je is not None
    assert je.total_debit == je.total_credit
    
    # Verify lines: Inventory debit, Payable credit, Tax credit, Discount credit
    lines = {line.account.code: line for line in je.lines}
    assert "INVENTORY" in lines
    assert "PAYABLE" in lines

async def test_sales_invoice_cogs(db_session):
    invoice = SalesInvoiceFactory()
    item = SalesInvoiceItemFactory(invoice_id=invoice.id, quantity_base_units=100, cost_per_base_unit=50)
    
    await post_sales_invoice(invoice.id)
    
    # Verify COGS = 100 * 50 = 5000
    je = await get_journal_entry_for_sales(invoice.id)
    cogs_line = next(l for l in je.lines if l.account.code == "COGS")
    assert cogs_line.amount == 5000

async def test_payment_no_double_counting(db_session):
    invoice = SalesInvoiceFactory(total_amount=10000, balance_amount=10000)
    await post_sales_invoice(invoice.id)
    
    # Record payment
    await record_payment(party_type="customer", party_id=invoice.customer_id, amount=5000, invoice_id=invoice.id)
    
    # Revenue should NOT be recorded again
    revenue_entries = await get_revenue_entries_after_payment(invoice.id)
    assert len(revenue_entries) == 0  # Only original invoice revenue
```

### Purchase Flow Tests

```python
# tests/integration/test_purchase_flow.py
async def test_full_purchase_flow(client, db_session):
    # 1. Create supplier
    supplier_resp = await client.post("/api/suppliers", json={
        "name": "Test Distributor",
        "phone": "1234567890",
        "credit_limit": 100000
    })
    supplier_id = supplier_resp.json()["id"]
    
    # 2. Create medicine
    medicine_resp = await client.post("/api/medicines", json={
        "product_code": "TEST001",
        "name": "Test Medicine",
        "base_unit_id": "TAB",
        "default_purchase_rate": 100,
        "default_sale_rate": 150
    })
    medicine_id = medicine_resp.json()["id"]
    
    # 3. Create purchase invoice (draft)
    purchase_resp = await client.post("/api/purchases", json={
        "supplier_id": supplier_id,
        "invoice_date": "2024-01-15",
        "items": [{
            "medicine_id": medicine_id,
            "batch_number": "BATCH001",
            "expiry_date": "2025-12-31",
            "quantity_received": 100,
            "purchase_rate": 100,
            "line_total": 10000
        }]
    })
    purchase_id = purchase_resp.json()["id"]
    assert purchase_resp.json()["status"] == "draft"
    
    # 4. Post purchase invoice
    post_resp = await client.post(f"/api/purchases/{purchase_id}/post", json={"amount_paid": 0})
    assert post_resp.json()["status"] == "posted"
    assert post_resp.json()["balance_amount"] == 10000
    
    # 5. Verify stock increased
    batch_resp = await client.get(f"/api/medicines/{medicine_id}/batches")
    batch = batch_resp.json()[0]
    assert batch["available_quantity"] == 100
    
    # 6. Verify supplier balance
    supplier_resp = await client.get(f"/api/suppliers/{supplier_id}")
    assert supplier_resp.json()["outstanding_balance"] == 10000
```

### Sales Flow Tests

```python
# tests/integration/test_sales_flow.py
async def test_full_sales_flow(client, db_session):
    # Setup: Customer, medicine with stock
    customer = await create_customer(client)
    medicine, batch = await create_medicine_with_stock(client, qty=100)
    
    # 1. Create sales invoice (draft)
    sales_resp = await client.post("/api/sales", json={
        "customer_id": customer["id"],
        "invoice_date": "2024-01-15",
        "items": [{
            "medicine_id": medicine["id"],
            "batch_id": batch["id"],
            "quantity_sold": 10,
            "sale_rate": 150,
            "line_total": 1500
        }]
    })
    sales_id = sales_resp.json()["id"]
    
    # 2. Post sales invoice
    post_resp = await client.post(f"/api/sales/{sales_id}/post", json={"amount_received": 0})
    assert post_resp.json()["status"] == "posted"
    
    # 3. Verify stock decreased
    batch_resp = await client.get(f"/api/medicines/{medicine['id']}/batches")
    assert batch_resp.json()[0]["available_quantity"] == 90
    
    # 4. Verify COGS recorded
    sales_detail = await client.get(f"/api/sales/{sales_id}")
    assert sales_detail.json()["items"][0]["cogs_amount"] == 1000  # 10 * 100
    
    # 5. Verify customer balance
    customer_resp = await client.get(f"/api/customers/{customer['id']}")
    assert customer_resp.json()["outstanding_balance"] == 1500
```

### Expiry Tests

```python
# tests/unit/test_expiry.py
async def test_expiry_alert_tiers(db_session):
    today = date.today()
    medicine = MedicineFactory()
    
    # Create batches in each tier
    batches = [
        MedicineBatchFactory(medicine_id=medicine.id, expiry_date=today - timedelta(days=1)),  # expired
        MedicineBatchFactory(medicine_id=medicine.id, expiry_date=today + timedelta(days=5)),   # critical
        MedicineBatchFactory(medicine_id=medicine.id, expiry_date=today + timedelta(days=15)),  # warning
        MedicineBatchFactory(medicine_id=medicine.id, expiry_date=today + timedelta(days=45)),  # caution
        MedicineBatchFactory(medicine_id=medicine.id, expiry_date=today + timedelta(days=120)), # ok
    ]
    
    alerts = await get_expiry_alerts()
    
    assert alerts["expired"]["batch_count"] == 1
    assert alerts["critical"]["batch_count"] == 1
    assert alerts["expiring_30"]["batch_count"] == 1
    assert alerts["expiring_60"]["batch_count"] == 1
    assert alerts["expiring_90"]["batch_count"] == 0  # 120 days is ok

async def test_fe_allocation_respects_expiry(db_session):
    today = date.today()
    medicine = MedicineFactory()
    
    # Batch expiring tomorrow
    batch1 = MedicineBatchFactory(medicine_id=medicine.id, expiry_date=today + timedelta(days=1), available_quantity=50)
    # Batch expiring in 60 days
    batch2 = MedicineBatchFactory(medicine_id=medicine.id, expiry_date=today + timedelta(days=60), available_quantity=50)
    
    # Need 70 units
    allocations = get_fefo_allocations(medicine.id, 70, today)
    
    # Should use batch1 first (50), then batch2 (20)
    assert allocations[0].allocate_qty == 50
    assert allocations[1].allocate_qty == 20
```

### Concurrency Tests

```python
# tests/integration/test_concurrency.py
import asyncio

async def test_concurrent_sales_same_batch(client, db_session):
    """Two concurrent sales should not oversell same batch"""
    medicine, batch = await create_medicine_with_stock(client, qty=10)
    
    async def make_sale(qty):
        sales = await client.post("/api/sales", json={
            "customer_id": customer_id,
            "items": [{
                "medicine_id": medicine["id"],
                "batch_id": batch["id"],
                "quantity_sold": qty,
                "sale_rate": 150,
                "line_total": qty * 150
            }]
        })
        return await client.post(f"/api/sales/{sales.json()['id']}/post", json={"amount_received": qty * 150})
    
    # Try to sell 10 + 10 = 20, but only 10 available
    results = await asyncio.gather(
        make_sale(10),
        make_sale(10),
        return_exceptions=True
    )
    
    # One should succeed, one should fail with InsufficientStockError
    successes = [r for r in results if not isinstance(r, Exception)]
    failures = [r for r in results if isinstance(r, Exception)]
    
    assert len(successes) == 1
    assert len(failures) == 1
    assert "Insufficient stock" in str(failures[0])

async def test_double_submit_prevention(client):
    """Double-clicking post should not create duplicate"""
    invoice = await create_draft_invoice(client)
    
    # Submit twice rapidly
    results = await asyncio.gather(
        client.post(f"/api/purchases/{invoice['id']}/post"),
        client.post(f"/api/purchases/{invoice['id']}/post"),
        return_exceptions=True
    )
    
    # Only one should succeed
    posted_count = sum(1 for r in results if hasattr(r, 'json') and r.json()["status"] == "posted")
    assert posted_count == 1
```

## Frontend Tests (Playwright)

### Setup

```bash
cd frontend
npm install -D @playwright/test
npx playwright install
```

### Test Example

```typescript
// tests/e2e/purchase-to-sale.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Purchase to Sale Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
  });

  test('complete purchase to sale cycle', async ({ page }) => {
    // Create supplier
    await page.goto('/suppliers');
    await page.click('text=New Supplier');
    await page.fill('input[name="name"]', 'Test Distributor');
    await page.click('button[type="submit"]');
    
    // Create medicine
    await page.goto('/medicines');
    await page.click('text=New Medicine');
    await page.fill('input[name="product_code"]', 'TEST001');
    await page.fill('input[name="name"]', 'Test Medicine');
    // ... fill other fields
    await page.click('button[type="submit"]');
    
    // Create purchase
    await page.goto('/purchases/new');
    // ... fill form
    await page.click('text=Post');
    
    // Create sale
    await page.goto('/sales/new');
    // ... fill form with batch selection
    await page.click('text=Post');
    
    // Verify dashboard updated
    await page.goto('/dashboard');
    await expect(page.locator('text=Today\'s Sales')).toContainText('1,500');
  });
});
```

### Run Frontend Tests

```bash
cd frontend
npx playwright test
npx playwright test --ui  # Interactive mode
```

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: pharma_erp_test
        ports: [5432:5432]
        options: --health-cmd="pg_isready" --health-interval=10s --health-timeout=5s --health-retries=5
    
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - name: Install dependencies
        run: cd backend && uv sync --dev
      - name: Run migrations
        run: cd backend && uv run alembic upgrade head
      - name: Run tests
        run: cd backend && uv run pytest -v --cov=app
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: cd frontend && npm ci
      - name: Build
        run: cd frontend && npm run build
      - name: Install Playwright
        run: cd frontend && npx playwright install --with-deps
      - name: Run E2E tests
        run: cd frontend && npx playwright test
```

## Test Data Management

### Factories

```python
# tests/fixtures/factories.py
import factory
from factory.alchemy import SQLAlchemyModelFactory
from app.models import *

class MedicineFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Medicine
        sqlalchemy_session_persistence = "commit"
    
    product_code = factory.Sequence(lambda n: f"MED{n:04d}")
    name = factory.Sequence(lambda n: f"Medicine {n}")
    base_unit_id = "TAB"
    default_purchase_rate = 100.0
    default_sale_rate = 150.0
    is_active = True

class SupplierFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Supplier
        sqlalchemy_session_persistence = "commit"
    
    name = factory.Sequence(lambda n: f"Supplier {n}")
    is_active = True

# ... more factories
```

## Debugging Tests

### Common Issues

| Issue | Solution |
|-------|----------|
| Database locked | Use separate test database, ensure cleanup |
| Flaky async tests | Add proper await, use async fixtures |
| Foreign key violations | Check factory dependencies, creation order |
| Port conflicts | Use dynamic ports or test containers |

### Debug Commands

```bash
# Run with verbose output and stop on first failure
uv run pytest -xvs tests/unit/test_inventory.py

# Run with pdb on failure
uv run pytest --pdb tests/unit/test_inventory.py

# Show slowest tests
uv run pytest --durations=10

# Run specific marker
uv run pytest -m "not slow"
```

## Test Markers

```python
# conftest.py
def pytest_configure(config):
    config.addinivalue_line("markers", "slow: marks tests as slow")
    config.addinivalue_line("markers", "integration: marks tests as integration")
    config.addinivalue_line("markers", "e2e: marks tests as end-to-end")
    config.addinivalue_line("markers", "skip_ci: marks tests to skip in CI")

# Usage
@pytest.mark.slow
async def test_large_dataset_performance():
    ...

@pytest.mark.integration
async def test_full_workflow():
    ...
```

## Acceptance Criteria Checklist

All tests must pass for:

- [ ] Direct no-login workspace access
- [ ] CSV/XLSX import preview, validation, commit, and idempotency
- [ ] Workbook seed preview and reconciliation totals
- [ ] XLSX/CSV export downloads
- [ ] Medicine CRUD with validation
- [ ] Duplicate product code rejection
- [ ] Purchase invoice calculations
- [ ] Stock increase after purchase posting
- [ ] Batch expiry tracking
- [ ] Expired stock exclusion from sales
- [ ] FEFO batch selection
- [ ] Sales rejection for expired batches
- [ ] Sales rejection for insufficient stock
- [ ] Stock deduction after sales posting
- [ ] Partial customer payments
- [ ] Partial supplier payments
- [ ] Purchase returns
- [ ] Sales returns
- [ ] Financial balance calculations
- [ ] Gross profit calculations
- [ ] Expense tracking
- [ ] Invoice number uniqueness
- [ ] Double submission protection
- [ ] Transaction rollback on failure
- [ ] Interim local backup and restore procedures
- [ ] Supabase backup/restore documentation reviewed (implementation deferred)
- [ ] Expiry date boundary conditions

## Performance Benchmarks

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Dashboard load | < 500ms | API response time |
| Invoice creation | < 200ms | POST /api/purchases |
| Invoice posting | < 1000ms | POST /api/purchases/{id}/post |
| Batch search | < 100ms | GET /api/sales/batches/available |
| Report generation | < 5s | GET /api/reports/* |
| 1000 line invoice | < 3s | Stress test |

Run benchmarks:
```bash
uv run pytest tests/performance/ -v
```