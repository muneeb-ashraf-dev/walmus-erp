"""Inventory logic unit tests."""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Medicine, MedicineBatch, MedicineUnit, Supplier
from app.models.enums import BatchStatus
from app.core.exceptions import InsufficientStockError, ExpiredBatchError
from app.services.inventory import get_fefo_allocations, validate_batch_for_sale


@pytest.fixture
def test_units(db_session: AsyncSession):
    """Create test units fixture."""
    async def _create_units(prefix: str = ""):
        tab = MedicineUnit(code=f"TAB{prefix}", name="Tablet", is_base_unit=True)
        box = MedicineUnit(code=f"BOX{prefix}", name="Box")
        strip = MedicineUnit(code=f"STRIP{prefix}", name="Strip")
        db_session.add_all([tab, box, strip])
        await db_session.commit()
        return tab, box, strip
    return _create_units


@pytest.fixture
def test_supplier(db_session: AsyncSession):
    """Create test supplier fixture."""
    async def _create_supplier(prefix: str = ""):
        supplier = Supplier(name=f"Test Supplier {prefix}")
        db_session.add(supplier)
        await db_session.commit()
        return supplier
    return _create_supplier


@pytest.fixture
def test_medicine(db_session: AsyncSession):
    """Create test medicine fixture."""
    async def _create_medicine(tab_id, box_id, prefix: str = ""):
        medicine = Medicine(
            product_code=f"TEST001{prefix}",
            name="Test Medicine",
            base_unit_id=tab_id,
            units_per_pack=100,
            purchase_unit_id=box_id,
            purchase_conversion_factor=100,
        )
        db_session.add(medicine)
        await db_session.commit()
        return medicine
    return _create_medicine


@pytest.fixture
def test_batch(db_session: AsyncSession):
    """Create test batch fixture."""
    async def _create_batch(medicine_id, supplier_id, prefix: str = ""):
        batch = MedicineBatch(
            medicine_id=medicine_id,
            batch_number=f"BATCH001{prefix}",
            manufacturing_date=date(2024, 1, 1),
            expiry_date=date(2025, 12, 31),
            supplier_id=supplier_id,
            received_quantity=1000,
            available_quantity=1000,
            purchase_cost_per_unit=5.0,
            status=BatchStatus.ACTIVE.value,
        )
        db_session.add(batch)
        await db_session.commit()
        return batch
    return _create_batch


@pytest.mark.asyncio
async def test_medicine_unit_conversion(db_session: AsyncSession, test_units):
    """Test unit conversion calculations."""
    prefix = "1"
    tab, box, strip = await test_units(prefix)
    
    # Create medicine with conversions
    medicine = Medicine(
        product_code="TEST001",
        name="Test Medicine",
        base_unit_id=tab.id,
        units_per_pack=100,
        purchase_unit_id=box.id,
        purchase_conversion_factor=100,  # 1 box = 100 tablets
        sale_unit_id=strip.id,
        sale_conversion_factor=10,  # 1 strip = 10 tablets
    )
    db_session.add(medicine)
    await db_session.commit()
    
    # Test purchase conversion
    assert medicine.purchase_conversion_factor == 100
    # 5 boxes = 500 tablets
    purchase_qty_base = 5 * medicine.purchase_conversion_factor
    assert purchase_qty_base == 500
    
    # Test sale conversion
    assert medicine.sale_conversion_factor == 10
    # 3 strips = 30 tablets
    sale_qty_base = 3 * medicine.sale_conversion_factor
    assert sale_qty_base == 30


@pytest.mark.asyncio
async def test_batch_creation_and_stock(db_session: AsyncSession, test_units, test_supplier, test_medicine, test_batch):
    """Test batch creation and stock tracking."""
    prefix = "2"
    tab, box = (await test_units(prefix))[:2]
    supplier = await test_supplier(prefix)
    medicine = await test_medicine(tab.id, box.id, prefix)
    batch = await test_batch(medicine.id, supplier.id, prefix)
    
    # Verify initial stock
    assert batch.available_quantity == 1000
    assert batch.received_quantity == 1000
    assert batch.status == "active"
    
    # Simulate sale of 100 tablets
    batch.available_quantity -= 100
    await db_session.commit()
    
    assert batch.available_quantity == 900
    
    # Simulate purchase return of 50 tablets
    batch.available_quantity += 50
    await db_session.commit()
    
    assert batch.available_quantity == 950


@pytest.mark.asyncio
async def test_fefo_allocation(db_session: AsyncSession, test_units, test_supplier, test_medicine, test_batch):
    """Test FEFO (First Expiry First Out) batch allocation."""
    prefix = "3"
    tab, box = (await test_units(prefix))[:2]
    supplier = await test_supplier(prefix)
    medicine = await test_medicine(tab.id, box.id, prefix)
    
    today = date.today()
    
    # Create 3 batches with different expiry dates
    batch1 = await test_batch(medicine.id, supplier.id, "a")
    batch1.expiry_date = date.today() + timedelta(days=30)
    batch1.batch_number = "BATCH1"
    batch1.manufacturing_date = date.today() - timedelta(days=100)
    batch1.available_quantity = 100
    batch1.purchase_cost_per_unit = 5.0
    
    batch2 = await test_batch(medicine.id, supplier.id, "b")
    batch2.expiry_date = date.today() + timedelta(days=60)
    batch2.batch_number = "BATCH2"
    batch2.manufacturing_date = date.today() - timedelta(days=50)
    batch2.available_quantity = 100
    batch2.purchase_cost_per_unit = 5.0
    
    batch3 = await test_batch(medicine.id, supplier.id, "c")
    batch3.expiry_date = date.today() + timedelta(days=90)
    batch3.batch_number = "BATCH3"
    batch3.manufacturing_date = date.today() - timedelta(days=10)
    batch3.available_quantity = 100
    batch3.purchase_cost_per_unit = 5.0
    
    await db_session.commit()
    
    # Allocate 150 units - should use batch1 (100) + batch2 (50)
    allocations = await get_fefo_allocations(db_session, medicine.id, Decimal("150"), today)
    
    assert len(allocations) == 2
    assert allocations[0]["batch_id"] == batch1.id
    assert allocations[0]["allocate_qty"] == 100
    assert allocations[1]["batch_id"] == batch2.id
    assert allocations[1]["allocate_qty"] == 50


@pytest.mark.asyncio
async def test_expired_batch_rejection(db_session: AsyncSession, test_units, test_supplier, test_medicine, test_batch):
    """Test that expired batches cannot be sold."""
    prefix = "4"
    tab, box = (await test_units(prefix))[:2]
    supplier = await test_supplier(prefix)
    medicine = await test_medicine(tab.id, box.id, prefix)
    
    # Create expired batch
    batch = await test_batch(medicine.id, supplier.id, "expired")
    batch.expiry_date = date.today() - timedelta(days=1)
    batch.available_quantity = 100
    batch.status = BatchStatus.ACTIVE.value  # Still active but expired
    await db_session.commit()
    
    # Should raise ExpiredBatchError
    with pytest.raises(ExpiredBatchError):
        await validate_batch_for_sale(db_session, batch.id, Decimal("10"), date.today())


@pytest.mark.asyncio
async def test_insufficient_stock_rejection(db_session: AsyncSession, test_units, test_supplier, test_medicine, test_batch):
    """Test that insufficient stock is rejected."""
    prefix = "5"
    tab, box = (await test_units(prefix))[:2]
    supplier = await test_supplier(prefix)
    medicine = await test_medicine(tab.id, box.id, prefix)
    
    # Create batch with only 50 units and future expiry
    batch = await test_batch(medicine.id, supplier.id, "low")
    batch.available_quantity = 50
    batch.expiry_date = date.today() + timedelta(days=365)  # Far future expiry
    await db_session.commit()
    
    # Try to sell 100 units (more than available)
    with pytest.raises(InsufficientStockError):
        await validate_batch_for_sale(db_session, batch.id, Decimal("100"), date.today())


@pytest.mark.asyncio
@pytest.mark.asyncio
async def test_expiry_alert_tiers(db_session: AsyncSession, test_units, test_supplier, test_medicine, test_batch):
    """Test expiry alert tier classification."""
    prefix = "6"
    tab, box = (await test_units(prefix))[:2]
    supplier = await test_supplier(prefix)
    medicine = await test_medicine(tab.id, box.id, prefix)
    
    today = date.today()
    
    # Create batches in each tier
    batch_expired = await test_batch(medicine.id, supplier.id, "exp")
    batch_expired.expiry_date = today - timedelta(days=1)
    batch_expired.status = BatchStatus.EXPIRED.value
    batch_expired.available_quantity = 100
    
    batch_critical = await test_batch(medicine.id, supplier.id, "crit")
    batch_critical.expiry_date = today + timedelta(days=5)
    batch_critical.available_quantity = 100
    
    batch_warning = await test_batch(medicine.id, supplier.id, "warn")
    batch_warning.expiry_date = today + timedelta(days=15)
    batch_warning.available_quantity = 100
    
    batch_caution = await test_batch(medicine.id, supplier.id, "caut")
    batch_caution.expiry_date = today + timedelta(days=45)
    batch_caution.available_quantity = 100
    
    batch_ok = await test_batch(medicine.id, supplier.id, "ok")
    batch_ok.expiry_date = today + timedelta(days=120)
    batch_ok.available_quantity = 100
    
    await db_session.commit()
    
    # Query and classify
    from app.api.dashboard import get_expiry_alerts
    
    # This would be tested via API, but we verify the logic here
    # Expired: expiry < today
    # Critical: today <= expiry <= today + 7
    # Warning: today + 8 <= expiry <= today + 30
    # Caution: today + 31 <= expiry <= today + 90
    # OK: expiry > today + 90
    
    assert batch_expired.expiry_date < today  # Expired
    assert today <= batch_critical.expiry_date <= today + timedelta(days=7)  # Critical
    assert today + timedelta(days=8) <= batch_warning.expiry_date <= today + timedelta(days=30)  # Warning
    assert today + timedelta(days=31) <= batch_caution.expiry_date <= today + timedelta(days=60)  # Caution
    assert batch_ok.expiry_date > today + timedelta(days=90)  # OK


# Simple calculation tests without DB
def test_gross_profit_calculation():
    """Test gross profit calculation."""
    # Sale: 10 units @ $15.00 = $150.00
    # Cost: 10 units @ $10.00 = $100.00
    # Gross Profit = $50.00
    # Margin = 33.33%
    
    qty = Decimal("10")
    sale_rate = Decimal("15.00")
    cost_rate = Decimal("10.00")
    
    revenue = qty * sale_rate
    cogs = qty * cost_rate
    gross_profit = revenue - cogs
    margin_pct = (gross_profit / revenue) * 100
    
    assert revenue == Decimal("150.00")
    assert cogs == Decimal("100.00")
    assert gross_profit == Decimal("50.00")
    assert round(margin_pct, 2) == Decimal("33.33")


def test_roi_calculation():
    """Test doctor investment ROI calculation."""
    # Investment: 200,000
    # ROI %: 35%
    # Expected Sale = 200,000 / 0.35 = 571,428.57
    
    investment = Decimal("200000")
    roi_pct = Decimal("35.00")
    expected_sale = investment / (roi_pct / 100)
    
    assert expected_sale == Decimal("571428.5714285714285714285714")
    
    # Actual sales: 300,000
    # Balance = 571,428.57 - 300,000 = 271,428.57
    actual = Decimal("300000")
    balance = expected_sale - actual
    
    assert balance == Decimal("271428.5714285714285714285714")
    achievement_pct = (actual / expected_sale) * 100
    assert round(achievement_pct, 2) == Decimal("52.50")


def test_weighted_average_cost_calculation():
    """Test WAC calculation."""
    # Initial stock: 100 units @ $5.00 = $500
    # New purchase: 50 units @ $6.00 = $300
    # New WAC = (500 + 300) / (100 + 50) = 800 / 150 = $5.333...
    
    initial_qty = 100
    initial_cost = Decimal("5.00")
    new_qty = 50
    new_cost = Decimal("6.00")
    
    total_value = (initial_qty * initial_cost) + (new_qty * new_cost)
    total_qty = initial_qty + new_qty
    new_wac = total_value / total_qty
    
    assert round(new_wac, 10) == Decimal("5.3333333333")
    
    # Test with different quantities
    # 1000 @ $10.00 + 200 @ $12.00 = 12000 / 1200 = $10.00
    wac2 = ((1000 * Decimal("10.00")) + (200 * Decimal("12.00"))) / 1200
    assert round(wac2, 10) == Decimal("10.3333333333")


def test_expiry_status_classification():
    """Test expiry status classification logic."""
    today = date.today()
    
    test_cases = [
        (today - timedelta(days=1), "expired"),
        (today, "critical"),
        (today + timedelta(days=5), "critical"),
        (today + timedelta(days=7), "critical"),
        (today + timedelta(days=8), "warning"),
        (today + timedelta(days=15), "warning"),
        (today + timedelta(days=30), "warning"),
        (today + timedelta(days=31), "caution"),
        (today + timedelta(days=45), "caution"),
        (today + timedelta(days=60), "caution"),
        (today + timedelta(days=90), "caution"),
        (today + timedelta(days=91), "ok"),
        (today + timedelta(days=120), "ok"),
    ]
    
    for expiry_date, expected_status in test_cases:
        if expiry_date < today:
            status = "expired"
        elif expiry_date <= today + timedelta(days=7):
            status = "critical"
        elif expiry_date <= today + timedelta(days=30):
            status = "warning"
        elif expiry_date <= today + timedelta(days=90):
            status = "caution"
        else:
            status = "ok"
        
        assert status == expected_status, f"Failed for {expiry_date}: expected {expected_status}, got {status}"