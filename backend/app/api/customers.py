"""Customers API endpoints."""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Customer, SalesInvoice, Payment, DoctorInvestment
from app.models.enums import InvoiceStatus, InvestmentStatus
from app.schemas.customers import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    CustomerListResponse,
    CustomerDetailResponse,
    DoctorInvestmentCreate,
    DoctorInvestmentUpdate,
    DoctorInvestmentResponse,
)
from app.core.exceptions import NotFoundError, ConflictError

router = APIRouter()


# ===========================================
# Customer Endpoints
# ===========================================

@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Create a new customer."""
    customer = Customer(**data.model_dump(), created_by=current_user.id)
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.get("", response_model=CustomerListResponse)
async def list_customers(
    search: Optional[str] = Query(None),
    customer_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("name"),
    sort_order: str = Query("asc"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List customers with search and filter."""
    query = select(Customer)
    
    if search:
        query = query.where(
            or_(
                Customer.name.ilike(f"%{search}%"),
                Customer.contact_person.ilike(f"%{search}%"),
                Customer.phone.ilike(f"%{search}%"),
            )
        )
    if customer_type:
        query = query.where(Customer.customer_type == customer_type)
    if is_active is not None:
        query = query.where(Customer.is_active == is_active)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Sorting
    sort_column = getattr(Customer, sort_by, Customer.name)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    customers = result.scalars().all()
    
    return CustomerListResponse(
        items=[CustomerResponse.model_validate(c) for c in customers],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{customer_id}", response_model=CustomerDetailResponse)
async def get_customer(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get customer by ID with details."""
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise NotFoundError("Customer", str(customer_id))
    
    # Get outstanding balance
    outstanding_result = await db.execute(
        select(func.coalesce(func.sum(SalesInvoice.balance_amount), 0))
        .where(
            and_(
                SalesInvoice.customer_id == customer_id,
                SalesInvoice.status == InvoiceStatus.POSTED.value,
                SalesInvoice.balance_amount > 0,
            )
        )
    )
    outstanding = outstanding_result.scalar() or 0
    
    # Get overdue amount
    from datetime import date
    today = date.today()
    overdue_result = await db.execute(
        select(func.coalesce(func.sum(SalesInvoice.balance_amount), 0))
        .where(
            and_(
                SalesInvoice.customer_id == customer_id,
                SalesInvoice.status == InvoiceStatus.POSTED.value,
                SalesInvoice.balance_amount > 0,
                SalesInvoice.due_date < today,
            )
        )
    )
    overdue = overdue_result.scalar() or 0
    
    # Recent sales invoices
    recent_sales = await db.execute(
        select(SalesInvoice)
        .where(
            and_(
                SalesInvoice.customer_id == customer_id,
                SalesInvoice.status == InvoiceStatus.POSTED.value,
            )
        )
        .order_by(SalesInvoice.invoice_date.desc())
        .limit(10)
    )
    
    # Doctor investments
    investments_result = await db.execute(
        select(DoctorInvestment)
        .where(DoctorInvestment.customer_id == customer_id)
    )
    investments = investments_result.scalars().all()
    
    return CustomerDetailResponse(
        **CustomerResponse.model_validate(customer).model_dump(),
        outstanding_balance=outstanding,
        overdue_amount=overdue,
        recent_sales=[
            {
                "id": str(s.id),
                "invoice_number": s.invoice_number,
                "invoice_date": s.invoice_date,
                "total_amount": float(s.total_amount),
                "balance_amount": float(s.balance_amount),
                "payment_status": s.payment_status,
            }
            for s in recent_sales.scalars().all()
        ],
        investments=[
            DoctorInvestmentResponse.model_validate(inv).model_dump()
            for inv in investments
        ],
    )


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: UUID,
    data: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Update customer."""
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise NotFoundError("Customer", str(customer_id))
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    
    await db.commit()
    await db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Delete customer (soft delete)."""
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise NotFoundError("Customer", str(customer_id))
    
    # Check if used in transactions
    used = await db.execute(select(func.count(SalesInvoice.id)).where(SalesInvoice.customer_id == customer_id))
    if used.scalar() > 0:
        customer.is_active = False
        await db.commit()
        return
    
    await db.delete(customer)
    await db.commit()


@router.get("/{customer_id}/sales")
async def get_customer_sales(
    customer_id: UUID,
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get sales invoices for a customer."""
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise NotFoundError("Customer", str(customer_id))
    
    query = select(SalesInvoice).where(SalesInvoice.customer_id == customer_id)
    
    if status_filter:
        query = query.where(SalesInvoice.status == status_filter)
    if date_from:
        query = query.where(SalesInvoice.invoice_date >= date_from)
    if date_to:
        query = query.where(SalesInvoice.invoice_date <= date_to)
    
    query = query.order_by(SalesInvoice.invoice_date.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    sales = result.scalars().all()
    
    return [
        {
            "id": str(s.id),
            "invoice_number": s.invoice_number,
            "invoice_date": s.invoice_date,
            "due_date": s.due_date,
            "status": s.status,
            "total_amount": float(s.total_amount),
            "amount_received": float(s.amount_received),
            "balance_amount": float(s.balance_amount),
            "payment_status": s.payment_status,
        }
        for s in sales
    ]


@router.get("/{customer_id}/receipts")
async def get_customer_receipts(
    customer_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get payments received from a customer."""
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise NotFoundError("Customer", str(customer_id))
    
    payments_result = await db.execute(
        select(Payment)
        .where(
            and_(
                Payment.party_type == "customer",
                Payment.party_id == customer_id,
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


# ===========================================
# Doctor Investment Endpoints
# ===========================================

@router.post("/{customer_id}/investments", response_model=DoctorInvestmentResponse, status_code=status.HTTP_201_CREATED)
async def create_doctor_investment(
    customer_id: UUID,
    data: DoctorInvestmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Create a doctor investment record."""
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise NotFoundError("Customer", str(customer_id))
    
    expected_sale = float(data.investment_amount) / (float(data.roi_percentage) / 100)
    
    investment = DoctorInvestment(
        customer_id=customer_id,
        investment_amount=data.investment_amount,
        investment_date=data.investment_date,
        roi_percentage=data.roi_percentage,
        expected_sale=expected_sale,
        status=data.status or InvestmentStatus.ACTIVE.value,
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(investment)
    await db.commit()
    await db.refresh(investment)
    return DoctorInvestmentResponse.model_validate(investment)


@router.get("/{customer_id}/investments", response_model=list[DoctorInvestmentResponse])
async def list_doctor_investments(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List doctor investments for a customer."""
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise NotFoundError("Customer", str(customer_id))
    
    result = await db.execute(
        select(DoctorInvestment)
        .where(DoctorInvestment.customer_id == customer_id)
        .order_by(DoctorInvestment.investment_date.desc())
    )
    return [DoctorInvestmentResponse.model_validate(inv) for inv in result.scalars().all()]


@router.patch("/{customer_id}/investments/{investment_id}", response_model=DoctorInvestmentResponse)
async def update_doctor_investment(
    customer_id: UUID,
    investment_id: UUID,
    data: DoctorInvestmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Update doctor investment."""
    result = await db.execute(
        select(DoctorInvestment)
        .where(
            and_(
                DoctorInvestment.id == investment_id,
                DoctorInvestment.customer_id == customer_id,
            )
        )
    )
    investment = result.scalar_one_or_none()
    if not investment:
        raise NotFoundError("Doctor Investment", str(investment_id))
    
    # Recalculate expected_sale if investment_amount or roi_percentage changed
    update_data = data.model_dump(exclude_unset=True)
    if "investment_amount" in update_data or "roi_percentage" in update_data:
        inv_amount = update_data.get("investment_amount", investment.investment_amount)
        roi_pct = update_data.get("roi_percentage", investment.roi_percentage)
        update_data["expected_sale"] = float(inv_amount) / (float(roi_pct) / 100)
    
    for field, value in update_data.items():
        setattr(investment, field, value)
    
    await db.commit()
    await db.refresh(investment)
    return DoctorInvestmentResponse.model_validate(investment)


@router.delete("/{customer_id}/investments/{investment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doctor_investment(
    customer_id: UUID,
    investment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Delete doctor investment."""
    result = await db.execute(
        select(DoctorInvestment)
        .where(
            and_(
                DoctorInvestment.id == investment_id,
                DoctorInvestment.customer_id == customer_id,
            )
        )
    )
    investment = result.scalar_one_or_none()
    if not investment:
        raise NotFoundError("Doctor Investment", str(investment_id))
    
    await db.delete(investment)
    await db.commit()