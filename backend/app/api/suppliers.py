"""Suppliers API endpoints."""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Supplier, PurchaseInvoice, Payment, PaymentAllocation
from app.models.enums import InvoiceStatus, PaymentStatus
from app.schemas.suppliers import (
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    SupplierListResponse,
    SupplierDetailResponse,
)
from app.core.exceptions import NotFoundError, ConflictError

router = APIRouter()


@router.post("", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    data: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Create a new supplier."""
    supplier = Supplier(**data.model_dump(), created_by=current_user.id)
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return SupplierResponse.model_validate(supplier)


@router.get("", response_model=SupplierListResponse)
async def list_suppliers(
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("name"),
    sort_order: str = Query("asc"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List suppliers with search and filter."""
    query = select(Supplier)
    
    if search:
        query = query.where(
            or_(
                Supplier.name.ilike(f"%{search}%"),
                Supplier.contact_person.ilike(f"%{search}%"),
                Supplier.phone.ilike(f"%{search}%"),
            )
        )
    if is_active is not None:
        query = query.where(Supplier.is_active == is_active)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Sorting
    sort_column = getattr(Supplier, sort_by, Supplier.name)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    suppliers = result.scalars().all()
    
    return SupplierListResponse(
        items=[SupplierResponse.model_validate(s) for s in suppliers],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{supplier_id}", response_model=SupplierDetailResponse)
async def get_supplier(
    supplier_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get supplier by ID with details."""
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise NotFoundError("Supplier", str(supplier_id))
    
    # Get outstanding balance
    outstanding_result = await db.execute(
        select(func.coalesce(func.sum(PurchaseInvoice.balance_amount), 0))
        .where(
            and_(
                PurchaseInvoice.supplier_id == supplier_id,
                PurchaseInvoice.status == InvoiceStatus.POSTED.value,
                PurchaseInvoice.balance_amount > 0,
            )
        )
    )
    outstanding = outstanding_result.scalar() or 0
    
    # Get overdue amount
    from datetime import date
    today = date.today()
    overdue_result = await db.execute(
        select(func.coalesce(func.sum(PurchaseInvoice.balance_amount), 0))
        .where(
            and_(
                PurchaseInvoice.supplier_id == supplier_id,
                PurchaseInvoice.status == InvoiceStatus.POSTED.value,
                PurchaseInvoice.balance_amount > 0,
                PurchaseInvoice.due_date < today,
            )
        )
    )
    overdue = overdue_result.scalar() or 0
    
    # Recent purchase invoices
    recent_purchases = await db.execute(
        select(PurchaseInvoice)
        .where(
            and_(
                PurchaseInvoice.supplier_id == supplier_id,
                PurchaseInvoice.status == InvoiceStatus.POSTED.value,
            )
        )
        .order_by(PurchaseInvoice.invoice_date.desc())
        .limit(10)
    )
    
    return SupplierDetailResponse(
        **SupplierResponse.model_validate(supplier).model_dump(),
        outstanding_balance=outstanding,
        overdue_amount=overdue,
        recent_purchases=[
            {
                "id": str(p.id),
                "voucher_number": p.voucher_number,
                "invoice_date": p.invoice_date,
                "total_amount": float(p.total_amount),
                "balance_amount": float(p.balance_amount),
                "payment_status": p.payment_status,
            }
            for p in recent_purchases.scalars().all()
        ],
    )


@router.patch("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: UUID,
    data: SupplierUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Update supplier."""
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise NotFoundError("Supplier", str(supplier_id))
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(supplier, field, value)
    
    await db.commit()
    await db.refresh(supplier)
    return SupplierResponse.model_validate(supplier)


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier(
    supplier_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Delete supplier (soft delete)."""
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise NotFoundError("Supplier", str(supplier_id))
    
    # Check if used in transactions
    used = await db.execute(select(func.count(PurchaseInvoice.id)).where(PurchaseInvoice.supplier_id == supplier_id))
    if used.scalar() > 0:
        supplier.is_active = False
        await db.commit()
        return
    
    await db.delete(supplier)
    await db.commit()


@router.get("/{supplier_id}/purchases")
async def get_supplier_purchases(
    supplier_id: UUID,
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get purchase invoices for a supplier."""
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise NotFoundError("Supplier", str(supplier_id))
    
    query = select(PurchaseInvoice).where(PurchaseInvoice.supplier_id == supplier_id)
    
    if status_filter:
        query = query.where(PurchaseInvoice.status == status_filter)
    if date_from:
        query = query.where(PurchaseInvoice.invoice_date >= date_from)
    if date_to:
        query = query.where(PurchaseInvoice.invoice_date <= date_to)
    
    query = query.order_by(PurchaseInvoice.invoice_date.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    purchases = result.scalars().all()
    
    return [
        {
            "id": str(p.id),
            "voucher_number": p.voucher_number,
            "supplier_invoice_number": p.supplier_invoice_number,
            "invoice_date": p.invoice_date,
            "received_date": p.received_date,
            "due_date": p.due_date,
            "status": p.status,
            "total_amount": float(p.total_amount),
            "amount_paid": float(p.amount_paid),
            "balance_amount": float(p.balance_amount),
            "payment_status": p.payment_status,
        }
        for p in purchases
    ]


@router.get("/{supplier_id}/payments")
async def get_supplier_payments(
    supplier_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get payments made to a supplier."""
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise NotFoundError("Supplier", str(supplier_id))
    
    # Get payments where party_type=supplier and party_id=supplier_id
    payments_result = await db.execute(
        select(Payment)
        .where(
            and_(
                Payment.party_type == "supplier",
                Payment.party_id == supplier_id,
            )
        )
        .order_by(Payment.payment_date.desc())
        .limit(limit).offset(offset)
    )
    payments = payments_result.scalars().all()
    
    return [
        {
            "id": str(p.id),
            "payment_number": p.payment_number,
            "payment_date": p.payment_date,
            "account_id": str(p.account_id),
            "payment_method": p.payment_method,
            "amount": float(p.amount),
            "reference_number": p.reference_number,
            "status": p.status,
        }
        for p in payments
    ]


from sqlalchemy import and_