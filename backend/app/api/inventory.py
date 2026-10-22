"""Inventory API endpoints."""
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime, timedelta, UTC
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import (
    Medicine, MedicineBatch, InventoryMovement, StockAdjustment, StockAdjustmentItem,
    Supplier, PurchaseInvoice, PurchaseInvoiceItem, SalesInvoice, SalesInvoiceItem,
)
from app.models.enums import BatchStatus, MovementReason, InvoiceStatus
from app.schemas.inventory import (
    InventorySummaryResponse,
    BatchListResponse,
    BatchDetailResponse,
    StockMovementResponse,
    StockAdjustmentCreate,
    StockAdjustmentResponse,
    ExpiringBatchResponse,
    ExpiredBatchResponse,
)
from app.core.exceptions import NotFoundError, ValidationError as AppValidationError

router = APIRouter()


def _batch_payload(batch: MedicineBatch) -> dict:
    """Serialize a batch using already eager-loaded relationships.

    The ORM relationships are lazy by default; validating the ORM object directly
    would trigger IO outside the async greenlet context. Building the payload by
    hand keeps the endpoint safe regardless of which relationships are loaded.
    """
    medicine = None
    if batch.medicine is not None:
        medicine = {
            "id": str(batch.medicine.id),
            "name": batch.medicine.name,
            "product_code": batch.medicine.product_code,
            "generic_name": batch.medicine.generic_name,
            "strength": batch.medicine.strength,
            "dosage_form": batch.medicine.dosage_form,
            "packing_description": batch.medicine.packing_description,
            "manufacturer": (
                {"id": str(batch.medicine.manufacturer.id), "name": batch.medicine.manufacturer.name}
                if batch.medicine.manufacturer is not None
                else None
            ),
        }

    supplier = None
    if batch.supplier is not None:
        supplier = {
            "id": str(batch.supplier.id),
            "name": batch.supplier.name,
            "phone": batch.supplier.phone,
        }

    purchase_invoice = None
    if batch.purchase_invoice is not None:
        purchase_invoice = {
            "id": str(batch.purchase_invoice.id),
            "voucher_number": batch.purchase_invoice.voucher_number,
            "invoice_date": batch.purchase_invoice.invoice_date,
        }

    return {
        "id": batch.id,
        "medicine_id": batch.medicine_id,
        "batch_number": batch.batch_number,
        "manufacturing_date": batch.manufacturing_date,
        "expiry_date": batch.expiry_date,
        "supplier_id": batch.supplier_id,
        "purchase_invoice_id": batch.purchase_invoice_id,
        "received_quantity": batch.received_quantity,
        "available_quantity": batch.available_quantity,
        "purchase_cost_per_unit": batch.purchase_cost_per_unit,
        "status": batch.status,
        "location": batch.location,
        "notes": batch.notes,
        "created_at": batch.created_at,
        "updated_at": batch.updated_at,
        "medicine": medicine,
        "supplier": supplier,
        "purchase_invoice": purchase_invoice,
        "movements": [],
        "purchase_items": [],
        "sales_items": [],
    }


@router.get("/summary", response_model=InventorySummaryResponse)
async def get_inventory_summary(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get inventory dashboard summary."""
    today = date.today()
    
    # Total products
    total_products = await db.execute(
        select(func.count(Medicine.id)).where(Medicine.is_active == True)
    )
    
    # Total batches
    total_batches = await db.execute(
        select(func.count(MedicineBatch.id)).where(MedicineBatch.status == BatchStatus.ACTIVE.value)
    )
    
    # Saleable stock (total quantity)
    saleable_qty = await db.execute(
        select(func.coalesce(func.sum(MedicineBatch.available_quantity), 0))
        .where(
            and_(
                MedicineBatch.status == BatchStatus.ACTIVE.value,
                MedicineBatch.available_quantity > 0,
            )
        )
    )
    
    # Saleable stock value
    saleable_value = await db.execute(
        select(func.coalesce(func.sum(MedicineBatch.available_quantity * MedicineBatch.purchase_cost_per_unit), 0))
        .where(
            and_(
                MedicineBatch.status == BatchStatus.ACTIVE.value,
                MedicineBatch.available_quantity > 0,
            )
        )
    )
    
    # Quarantined stock
    quarantined_qty = await db.execute(
        select(func.coalesce(func.sum(MedicineBatch.available_quantity), 0))
        .where(MedicineBatch.status == BatchStatus.QUARANTINED.value)
    )
    quarantined_value = await db.execute(
        select(func.coalesce(func.sum(MedicineBatch.available_quantity * MedicineBatch.purchase_cost_per_unit), 0))
        .where(MedicineBatch.status == BatchStatus.QUARANTINED.value)
    )
    
    # Expired stock
    expired_qty = await db.execute(
        select(func.coalesce(func.sum(MedicineBatch.available_quantity), 0))
        .where(MedicineBatch.status == BatchStatus.EXPIRED.value)
    )
    expired_value = await db.execute(
        select(func.coalesce(func.sum(MedicineBatch.available_quantity * MedicineBatch.purchase_cost_per_unit), 0))
        .where(MedicineBatch.status == BatchStatus.EXPIRED.value)
    )
    
    # Near expiry (≤30 days)
    near_expiry_qty = await db.execute(
        select(func.coalesce(func.sum(MedicineBatch.available_quantity), 0))
        .where(
            and_(
                MedicineBatch.status == BatchStatus.ACTIVE.value,
                MedicineBatch.available_quantity > 0,
                MedicineBatch.expiry_date <= today + timedelta(days=30),
                MedicineBatch.expiry_date >= today,
            )
        )
    )
    near_expiry_value = await db.execute(
        select(func.coalesce(func.sum(MedicineBatch.available_quantity * MedicineBatch.purchase_cost_per_unit), 0))
        .where(
            and_(
                MedicineBatch.status == BatchStatus.ACTIVE.value,
                MedicineBatch.available_quantity > 0,
                MedicineBatch.expiry_date <= today + timedelta(days=30),
                MedicineBatch.expiry_date >= today,
            )
        )
    )
    
    # Low stock medicines
    low_stock = await db.execute(
        select(func.count(func.distinct(MedicineBatch.medicine_id)))
        .join(Medicine, Medicine.id == MedicineBatch.medicine_id)
        .where(
            and_(
                Medicine.is_active == True,
                MedicineBatch.status == BatchStatus.ACTIVE.value,
                MedicineBatch.available_quantity > 0,
                MedicineBatch.available_quantity <= Medicine.reorder_level,
            )
        )
    )
    
    # Total stock movements today
    today_movements = await db.execute(
        select(func.count(InventoryMovement.id))
        .where(
            and_(
                func.date(InventoryMovement.movement_date) == today,
            )
        )
    )
    
    return InventorySummaryResponse(
        total_products=total_products.scalar() or 0,
        total_batches=total_batches.scalar() or 0,
        saleable_quantity=float(saleable_qty.scalar() or 0),
        saleable_value=float(saleable_value.scalar() or 0),
        quarantined_quantity=float(quarantined_qty.scalar() or 0),
        quarantined_value=float(quarantined_value.scalar() or 0),
        expired_quantity=float(expired_qty.scalar() or 0),
        expired_value=float(expired_value.scalar() or 0),
        near_expiry_quantity=float(near_expiry_qty.scalar() or 0),
        near_expiry_value=float(near_expiry_value.scalar() or 0),
        low_stock_count=low_stock.scalar() or 0,
        today_movements=today_movements.scalar() or 0,
    )


@router.get("/batches", response_model=BatchListResponse)
async def list_batches(
    medicine_id: Optional[UUID] = Query(None),
    supplier_id: Optional[UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    expiry_from: Optional[date] = Query(None),
    expiry_to: Optional[date] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List medicine batches with filters."""
    filters = []
    if medicine_id:
        filters.append(MedicineBatch.medicine_id == medicine_id)
    if supplier_id:
        filters.append(MedicineBatch.supplier_id == supplier_id)
    if status_filter:
        filters.append(MedicineBatch.status == status_filter)
    if expiry_from:
        filters.append(MedicineBatch.expiry_date >= expiry_from)
    if expiry_to:
        filters.append(MedicineBatch.expiry_date <= expiry_to)

    # Count total
    count_query = select(func.count(MedicineBatch.id))
    if filters:
        count_query = count_query.where(and_(*filters))
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        select(MedicineBatch)
        .options(
            selectinload(MedicineBatch.medicine).selectinload(Medicine.manufacturer),
            selectinload(MedicineBatch.supplier),
            selectinload(MedicineBatch.purchase_invoice),
        )
    )
    if filters:
        query = query.where(and_(*filters))
    query = query.order_by(MedicineBatch.expiry_date.asc()).limit(limit).offset(offset)
    result = await db.execute(query)
    batches = result.scalars().all()

    return BatchListResponse(
        items=[BatchDetailResponse(**_batch_payload(batch)) for batch in batches],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/batches/{batch_id}", response_model=BatchDetailResponse)
async def get_batch(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get batch details with movement history."""
    result = await db.execute(
        select(MedicineBatch)
        .options(
            selectinload(MedicineBatch.medicine).selectinload(Medicine.manufacturer),
            selectinload(MedicineBatch.supplier),
            selectinload(MedicineBatch.purchase_invoice),
        )
        .where(MedicineBatch.id == batch_id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise NotFoundError("Batch", str(batch_id))
    
    # Get movement history
    movements_result = await db.execute(
        select(InventoryMovement)
        .where(InventoryMovement.batch_id == batch_id)
        .order_by(InventoryMovement.movement_date.desc())
        .limit(50)
    )
    movements = movements_result.scalars().all()
    
    # Get purchase invoice items for this batch
    purchase_items = await db.execute(
        select(PurchaseInvoiceItem)
        .where(PurchaseInvoiceItem.batch_id == batch_id)
    )
    
    # Get sales invoice items for this batch
    sales_items = await db.execute(
        select(SalesInvoiceItem)
        .where(SalesInvoiceItem.batch_id == batch_id)
    )
    
    payload = _batch_payload(batch)
    payload["movements"] = [
        {
            "id": str(m.id),
            "movement_date": m.movement_date,
            "reason": m.reason,
            "quantity_change": float(m.quantity_change),
            "quantity_before": float(m.quantity_before),
            "quantity_after": float(m.quantity_after),
            "reference_type": m.reference_type,
            "reference_id": str(m.reference_id) if m.reference_id else None,
        }
        for m in movements
    ]
    payload["purchase_items"] = [
        {
            "id": str(item.id),
            "purchase_invoice_id": str(item.purchase_invoice_id),
            "quantity_received": float(item.quantity_received),
            "purchase_rate": float(item.purchase_rate),
        }
        for item in purchase_items.scalars().all()
    ]
    payload["sales_items"] = [
        {
            "id": str(item.id),
            "sales_invoice_id": str(item.sales_invoice_id),
            "quantity_sold": float(item.quantity_sold),
            "sale_rate": float(item.sale_rate),
        }
        for item in sales_items.scalars().all()
    ]
    return BatchDetailResponse(**payload)


@router.get("/movements", response_model=list[StockMovementResponse])
async def list_stock_movements(
    medicine_id: Optional[UUID] = Query(None),
    batch_id: Optional[UUID] = Query(None),
    reason: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List inventory movements with filters."""
    query = select(InventoryMovement).options(
        selectinload(InventoryMovement.medicine),
        selectinload(InventoryMovement.batch),
    )
    
    if medicine_id:
        query = query.where(InventoryMovement.medicine_id == medicine_id)
    if batch_id:
        query = query.where(InventoryMovement.batch_id == batch_id)
    if reason:
        query = query.where(InventoryMovement.reason == reason)
    if date_from:
        query = query.where(func.date(InventoryMovement.movement_date) >= date_from)
    if date_to:
        query = query.where(func.date(InventoryMovement.movement_date) <= date_to)
    
    query = query.order_by(InventoryMovement.movement_date.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    movements = result.scalars().all()
    
    return [
        StockMovementResponse.model_validate(m)
        for m in movements
    ]


@router.get("/adjustments", response_model=List[StockAdjustmentResponse])
async def list_stock_adjustments(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List stock adjustments."""
    query = select(StockAdjustment)
    if status_filter:
        query = query.where(StockAdjustment.status == status_filter)
    query = query.order_by(StockAdjustment.adjustment_date.desc(), StockAdjustment.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    adjustments = result.scalars().all()
    return [StockAdjustmentResponse.model_validate(a) for a in adjustments]


@router.post("/adjustments", response_model=StockAdjustmentResponse, status_code=201)
async def create_stock_adjustment(
    data: StockAdjustmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Create a stock adjustment."""
    # Validate items
    total_items = len(data.items)
    total_value_change = 0
    
    for item in data.items:
        med_result = await db.execute(select(Medicine).where(Medicine.id == item.medicine_id))
        if not med_result.scalar_one_or_none():
            raise NotFoundError("Medicine", str(item.medicine_id))
        
        if item.batch_id:
            batch_result = await db.execute(select(MedicineBatch).where(MedicineBatch.id == item.batch_id))
            batch = batch_result.scalar_one_or_none()
            if not batch:
                raise NotFoundError("Batch", str(item.batch_id))
            if batch.medicine_id != item.medicine_id:
                raise AppValidationError("Batch does not belong to this medicine")
        
        if item.unit_cost:
            total_value_change += float(item.quantity_change) * float(item.unit_cost)
    
    # Generate adjustment number
    from app.core.config import settings
    fy = date.today().year if date.today().month >= settings.financial_year_start_month else date.today().year - 1
    from app.models import NumberSequence
    seq_result = await db.execute(
        select(NumberSequence).where(
            and_(NumberSequence.prefix == "ADJ", NumberSequence.financial_year == fy)
        )
    )
    seq = seq_result.scalar_one_or_none()
    if seq:
        seq.current_sequence += 1
    else:
        seq = NumberSequence(prefix="ADJ", current_sequence=1, financial_year=fy)
        db.add(seq)
    await db.flush()
    
    adj_number = seq.format_template.replace("{PREFIX}", "ADJ").replace("{YEAR}", str(fy)).replace("{SEQ:06d}", str(seq.current_sequence).zfill(6))
    
    # Create adjustment
    adjustment = StockAdjustment(
        adjustment_number=adj_number,
        adjustment_date=data.adjustment_date or date.today(),
        reason=data.reason,
        reference_type=data.reference_type,
        reference_id=data.reference_id,
        total_items=total_items,
        total_value_change=total_value_change,
        status=InvoiceStatus.DRAFT.value,
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(adjustment)
    await db.flush()
    
    # Create items
    for idx, item in enumerate(data.items):
        adj_item = StockAdjustmentItem(
            stock_adjustment_id=adjustment.id,
            medicine_id=item.medicine_id,
            batch_id=item.batch_id,
            quantity_change=item.quantity_change,
            unit_cost=item.unit_cost,
            notes=item.notes,
            value_change=float(item.quantity_change) * float(item.unit_cost) if item.unit_cost else 0,
        )
        db.add(adj_item)
    
    await db.commit()
    await db.refresh(adjustment)
    return StockAdjustmentResponse.model_validate(adjustment)


@router.post("/adjustments/{adjustment_id}/post", response_model=StockAdjustmentResponse)
async def post_stock_adjustment(
    adjustment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Post a stock adjustment - apply changes to batches."""
    result = await db.execute(
        select(StockAdjustment)
        .options(selectinload(StockAdjustment.items))
        .where(StockAdjustment.id == adjustment_id)
    )
    adjustment = result.scalar_one_or_none()
    if not adjustment:
        raise NotFoundError("Stock Adjustment", str(adjustment_id))
    
    if adjustment.status != InvoiceStatus.DRAFT.value:
        raise AppValidationError("Only draft adjustments can be posted")
    
    # Apply each item
    for item in adjustment.items:
        if item.batch_id:
            # Adjust specific batch
            batch_result = await db.execute(
                select(MedicineBatch)
                .where(MedicineBatch.id == item.batch_id)
                .with_for_update()
            )
            batch = batch_result.scalar_one()
            
            old_qty = float(batch.available_quantity)
            new_qty = old_qty + float(item.quantity_change)
            
            if new_qty < 0:
                raise AppValidationError(f"Adjustment would result in negative stock for batch {batch.batch_number}")
            
            batch.available_quantity = new_qty
            batch.updated_at = datetime.now(UTC)
            
            if new_qty == 0 and batch.status == BatchStatus.ACTIVE.value:
                batch.status = BatchStatus.DEPLETED.value
            
            # Record movement
            movement = InventoryMovement(
                medicine_id=item.medicine_id,
                batch_id=item.batch_id,
                reason=MovementReason.ADJUSTMENT_IN.value if float(item.quantity_change) > 0 else MovementReason.ADJUSTMENT_OUT.value,
                quantity_change=float(item.quantity_change),
                quantity_before=old_qty,
                quantity_after=new_qty,
                unit_cost=float(item.unit_cost) if item.unit_cost else batch.purchase_cost_per_unit,
                reference_type="stock_adjustment",
                reference_id=adjustment.id,
                created_by=current_user.id,
            )
            db.add(movement)
        else:
            # Adjust across batches (FIFO) - simplified for now
            raise AppValidationError("Batch-level adjustments only supported for now")
    
    adjustment.status = InvoiceStatus.POSTED.value
    adjustment.posted_at = datetime.now(UTC)
    adjustment.posted_by = current_user.id
    
    await db.commit()
    await db.refresh(adjustment)
    return StockAdjustmentResponse.model_validate(adjustment)


@router.get("/expiring", response_model=List[ExpiringBatchResponse])
async def get_expiring_batches(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get batches expiring within specified days."""
    today = date.today()
    
    result = await db.execute(
        select(MedicineBatch)
        .options(
            selectinload(MedicineBatch.medicine),
            selectinload(MedicineBatch.supplier),
        )
        .where(
            and_(
                MedicineBatch.status == BatchStatus.ACTIVE.value,
                MedicineBatch.available_quantity > 0,
                MedicineBatch.expiry_date <= today + timedelta(days=days),
                MedicineBatch.expiry_date >= today,
            )
        )
        .order_by(MedicineBatch.expiry_date.asc())
    )
    batches = result.scalars().all()
    
    return [
        ExpiringBatchResponse(
            batch_id=batch.id,
            medicine_id=batch.medicine_id,
            medicine_name=batch.medicine.name,
            product_code=batch.medicine.product_code,
            batch_number=batch.batch_number,
            manufacturing_date=batch.manufacturing_date,
            expiry_date=batch.expiry_date,
            days_to_expiry=(batch.expiry_date - today).days,
            available_quantity=float(batch.available_quantity),
            purchase_cost_per_unit=float(batch.purchase_cost_per_unit),
            stock_value=float(batch.available_quantity) * float(batch.purchase_cost_per_unit),
            supplier_name=batch.supplier.name if batch.supplier else None,
        )
        for batch in batches
    ]


@router.get("/expired", response_model=List[ExpiredBatchResponse])
async def get_expired_batches(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get expired batches."""
    today = date.today()
    
    result = await db.execute(
        select(MedicineBatch)
        .options(
            selectinload(MedicineBatch.medicine),
            selectinload(MedicineBatch.supplier),
        )
        .where(
            and_(
                MedicineBatch.status == BatchStatus.EXPIRED.value,
                MedicineBatch.available_quantity > 0,
            )
        )
        .order_by(MedicineBatch.expiry_date.asc())
    )
    batches = result.scalars().all()
    
    return [
        ExpiredBatchResponse(
            batch_id=batch.id,
            medicine_id=batch.medicine_id,
            medicine_name=batch.medicine.name,
            product_code=batch.medicine.product_code,
            batch_number=batch.batch_number,
            manufacturing_date=batch.manufacturing_date,
            expiry_date=batch.expiry_date,
            days_expired=(today - batch.expiry_date).days,
            available_quantity=float(batch.available_quantity),
            purchase_cost_per_unit=float(batch.purchase_cost_per_unit),
            stock_value=float(batch.available_quantity) * float(batch.purchase_cost_per_unit),
            supplier_name=batch.supplier.name if batch.supplier else None,
        )
        for batch in batches
    ]