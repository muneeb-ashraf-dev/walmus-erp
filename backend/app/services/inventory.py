"""Inventory service functions."""
from datetime import date
from decimal import Decimal
from typing import List
from uuid import UUID
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MedicineBatch
from app.models.enums import BatchStatus
from app.core.exceptions import InsufficientStockError, ExpiredBatchError


async def get_fefo_allocations(
    db: AsyncSession,
    medicine_id: UUID,
    qty_needed: Decimal,
    sale_date: date,
) -> List[dict]:
    """
    Get FEFO (First Expiry First Out) batch allocations for a sale.
    
    Returns list of allocations with batch_id, available_qty, allocate_qty.
    """
    result = await db.execute(
        select(MedicineBatch)
        .where(
            and_(
                MedicineBatch.medicine_id == medicine_id,
                MedicineBatch.status == BatchStatus.ACTIVE.value,
                MedicineBatch.available_quantity > 0,
                MedicineBatch.expiry_date >= sale_date,
            )
        )
        .order_by(
            MedicineBatch.expiry_date.asc(),
            MedicineBatch.manufacturing_date.asc().nullsfirst(),
            MedicineBatch.id.asc(),
        )
        .with_for_update()
    )
    batches = result.scalars().all()
    
    if not batches:
        raise InsufficientStockError(
            medicine="",  # Will be filled by caller
            batch="",
            requested=float(qty_needed),
            available=0,
        )
    
    allocations = []
    remaining = qty_needed
    
    for batch in batches:
        if remaining <= 0:
            break
        
        available = batch.available_quantity
        allocate = min(remaining, available)
        remaining -= allocate
        
        allocations.append({
            "batch_id": batch.id,
            "batch_number": batch.batch_number,
            "expiry_date": batch.expiry_date,
            "available_qty": float(available),
            "cost_per_unit": float(batch.purchase_cost_per_unit),
            "allocate_qty": float(allocate),
        })
    
    if remaining > 0:
        # Get medicine name for error
        from app.models import Medicine
        med_result = await db.execute(select(Medicine).where(Medicine.id == medicine_id))
        medicine = med_result.scalar_one_or_none()
        med_name = medicine.name if medicine else "Unknown"
        
        raise InsufficientStockError(
            medicine=med_name,
            batch="",
            requested=float(qty_needed),
            available=float(qty_needed - remaining),
        )
    
    return allocations


async def validate_batch_for_sale(
    db: AsyncSession,
    batch_id: UUID,
    qty_needed: Decimal,
    sale_date: date,
) -> None:
    """
    Validate that a batch can be sold.
    
    Raises:
        ExpiredBatchError: If batch is expired
        InsufficientStockError: If insufficient quantity
    """
    result = await db.execute(
        select(MedicineBatch)
        .where(MedicineBatch.id == batch_id)
        .with_for_update()
    )
    batch = result.scalar_one_or_none()
    
    if not batch:
        raise InsufficientStockError(
            medicine="Unknown",
            batch="Unknown",
            requested=float(qty_needed),
            available=0,
        )
    
    # Check status
    if batch.status != BatchStatus.ACTIVE.value:
        if batch.status == BatchStatus.EXPIRED.value:
            raise ExpiredBatchError(
                medicine="",  # Filled by caller
                batch=batch.batch_number,
                expiry_date=str(batch.expiry_date),
            )
        raise InsufficientStockError(
            medicine="",
            batch=batch.batch_number,
            requested=float(qty_needed),
            available=0,
        )
    
    # Check expiry
    if batch.expiry_date < sale_date:
        raise ExpiredBatchError(
            medicine="",
            batch=batch.batch_number,
            expiry_date=str(batch.expiry_date),
        )
    
    # Check availability
    if batch.available_quantity < qty_needed:
        raise InsufficientStockError(
            medicine="",
            batch=batch.batch_number,
            requested=float(qty_needed),
            available=float(batch.available_quantity),
        )