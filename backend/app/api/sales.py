"""Sales API endpoints."""
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime, UTC
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import (
    SalesInvoice, SalesInvoiceItem, Customer, Medicine, MedicineBatch, MedicineUnit,
    FinancialAccount, JournalEntry, JournalEntryLine, InventoryMovement, NumberSequence,
    Payment, PaymentAllocation
)
from app.models.enums import InvoiceStatus, PaymentStatus, AccountType, MovementReason, BatchStatus
from app.schemas.sales import (
    SalesInvoiceCreate,
    SalesInvoiceUpdate,
    SalesInvoiceResponse,
    SalesInvoiceListResponse,
    SalesInvoiceDetailResponse,
    SalesInvoicePostRequest,
    BatchAvailabilityResponse,
)
from app.core.exceptions import NotFoundError, ConflictError, ValidationError as AppValidationError, InvoicePostingError, InsufficientStockError, ExpiredBatchError

router = APIRouter()


async def load_sales_invoice_response(db: AsyncSession, invoice_id: UUID) -> SalesInvoiceResponse:
    """Reload an invoice with its customer before building the API response.

    Newly created or updated ORM objects do not have their relationships loaded.
    Response validation must not trigger lazy IO in an async request.
    """
    result = await db.execute(
        select(SalesInvoice)
        .options(selectinload(SalesInvoice.customer))
        .where(SalesInvoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundError("Sales Invoice", str(invoice_id))
    return SalesInvoiceResponse.model_validate(invoice)


def get_financial_year(invoice_date: date, fy_start_month: int = 7) -> int:
    """Calculate financial year from date."""
    if invoice_date.month >= fy_start_month:
        return invoice_date.year
    return invoice_date.year - 1


async def get_next_voucher_number(db: AsyncSession, prefix: str, fy: int) -> str:
    """Get next voucher number from sequence."""
    from app.models import NumberSequence
    
    result = await db.execute(
        select(NumberSequence)
        .where(
            and_(
                NumberSequence.prefix == prefix,
                NumberSequence.financial_year == fy,
            )
        )
    )
    seq = result.scalar_one_or_none()
    
    if seq:
        seq.current_sequence += 1
    else:
        seq = NumberSequence(prefix=prefix, current_sequence=1, financial_year=fy)
        db.add(seq)

    await db.flush()
    
    template = seq.format_template or "{PREFIX}-{YEAR}-{SEQ:06d}"
    voucher = template.replace("{PREFIX}", prefix).replace("{YEAR}", str(fy)).replace("{SEQ:06d}", str(seq.current_sequence).zfill(6))
    return voucher


async def get_default_account(db: AsyncSession, code: str) -> UUID:
    """Get financial account by code."""
    result = await db.execute(select(FinancialAccount).where(FinancialAccount.code == code))
    account = result.scalar_one_or_none()
    if not account:
        raise AppValidationError(f"Financial account '{code}' not found")
    return account.id


@router.get("/batches/available", response_model=List[BatchAvailabilityResponse])
async def get_available_batches(
    medicine_id: UUID,
    qty_needed: Decimal = Query(..., gt=0),
    sale_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get available batches for a medicine (FEFO order)."""
    if sale_date is None:
        sale_date = date.today()
    
    # Verify medicine exists
    med_result = await db.execute(select(Medicine).where(Medicine.id == medicine_id))
    medicine = med_result.scalar_one_or_none()
    if not medicine:
        raise NotFoundError("Medicine", str(medicine_id))
    
    # Query active batches with available quantity, not expired
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
        .order_by(MedicineBatch.expiry_date.asc(), MedicineBatch.manufacturing_date.asc().nullsfirst(), MedicineBatch.id.asc())
    )
    batches = result.scalars().all()
    
    # Allocate using FEFO
    remaining = float(qty_needed)
    allocations = []
    
    for batch in batches:
        if remaining <= 0:
            break
        
        available = float(batch.available_quantity)
        allocate = min(remaining, available)
        remaining -= allocate
        
        allocations.append(BatchAvailabilityResponse(
            batch_id=batch.id,
            batch_number=batch.batch_number,
            manufacturing_date=batch.manufacturing_date,
            expiry_date=batch.expiry_date,
            available_quantity=available,
            purchase_cost_per_unit=float(batch.purchase_cost_per_unit),
            allocated_quantity=allocate,
            days_to_expiry=(batch.expiry_date - sale_date).days,
        ))
    
    if remaining > 0:
        # Still return what we have, but front-end should warn
        pass
    
    return allocations


@router.post("", response_model=SalesInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_sales_invoice(
    data: SalesInvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Create a draft sales invoice."""
    # Validate customer
    result = await db.execute(select(Customer).where(Customer.id == data.customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise NotFoundError("Customer", str(data.customer_id))
    
    # Check credit limit
    if customer.credit_limit > 0:
        outstanding_result = await db.execute(
            select(func.coalesce(func.sum(SalesInvoice.balance_amount), 0))
            .where(
                and_(
                    SalesInvoice.customer_id == customer.id,
                    SalesInvoice.status == InvoiceStatus.POSTED.value,
                    SalesInvoice.balance_amount > 0,
                )
            )
        )
        outstanding = outstanding_result.scalar() or 0
        new_total = outstanding + sum(item.line_total for item in data.items)
        if new_total > float(customer.credit_limit):
            raise AppValidationError(f"Credit limit exceeded. Outstanding: {outstanding}, Limit: {customer.credit_limit}")
    
    # Validate items
    for item in data.items:
        med_result = await db.execute(select(Medicine).where(Medicine.id == item.medicine_id))
        medicine = med_result.scalar_one_or_none()
        if not medicine:
            raise NotFoundError("Medicine", str(item.medicine_id))
        
        if item.sale_unit_id:
            unit_result = await db.execute(select(MedicineUnit).where(MedicineUnit.id == item.sale_unit_id))
            if not unit_result.scalar_one_or_none():
                raise NotFoundError("Sale Unit", str(item.sale_unit_id))
        
        # Validate batch
        batch_result = await db.execute(select(MedicineBatch).where(MedicineBatch.id == item.batch_id))
        batch = batch_result.scalar_one_or_none()
        if not batch:
            raise NotFoundError("Batch", str(item.batch_id))
        
        if batch.medicine_id != item.medicine_id:
            raise AppValidationError(f"Batch {batch.batch_number} does not belong to medicine {medicine.name}")
        
        if batch.status != BatchStatus.ACTIVE.value:
            raise AppValidationError(f"Batch {batch.batch_number} is not active (status: {batch.status})")
        
        if batch.expiry_date < data.invoice_date:
            raise ExpiredBatchError(medicine.name, batch.batch_number, str(batch.expiry_date))
        
        if float(batch.available_quantity) < float(item.quantity_sold) * float(item.conversion_factor):
            raise InsufficientStockError(medicine.name, batch.batch_number, 
                float(item.quantity_sold) * float(item.conversion_factor), float(batch.available_quantity))
    
    # Calculate totals
    subtotal = sum(item.line_total for item in data.items)
    discount_amount = sum(item.discount_amount for item in data.items)
    tax_amount = sum(item.tax_amount for item in data.items)
    total_amount = subtotal - discount_amount + tax_amount
    
    # Generate invoice number
    fy = get_financial_year(data.invoice_date)
    from app.core.config import settings
    from app.models import OwnerSettings
    owner_result = await db.execute(select(OwnerSettings))
    owner_settings = owner_result.scalar_one_or_none()
    invoice_number = await get_next_voucher_number(
        db, owner_settings.invoice_prefix if owner_settings else "INV", fy
    )
    
    # Create invoice
    invoice = SalesInvoice(
        invoice_number=invoice_number,
        customer_id=data.customer_id,
        invoice_date=data.invoice_date,
        due_date=data.due_date,
        status=InvoiceStatus.DRAFT.value,
        subtotal=subtotal,
        discount_amount=discount_amount,
        tax_amount=tax_amount,
        total_amount=total_amount,
        balance_amount=total_amount,
        payment_status=PaymentStatus.UNPAID.value,
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(invoice)
    await db.flush()
    
    # Create items
    for idx, item in enumerate(data.items, 1):
        batch_result = await db.execute(select(MedicineBatch).where(MedicineBatch.id == item.batch_id))
        batch = batch_result.scalar_one()
        
        qty_base = float(item.quantity_sold) * float(item.conversion_factor)
        
        invoice_item = SalesInvoiceItem(
            sales_invoice_id=invoice.id,
            line_number=idx,
            medicine_id=item.medicine_id,
            batch_id=item.batch_id,
            quantity_sold=item.quantity_sold,
            sale_unit_id=item.sale_unit_id,
            conversion_factor=item.conversion_factor,
            sale_rate=item.sale_rate,
            discount_percent=item.discount_percent,
            discount_amount=item.discount_amount,
            tax_rate=item.tax_rate,
            tax_amount=item.tax_amount,
            line_total=item.line_total,
            cost_per_base_unit=batch.purchase_cost_per_unit,
            notes=item.notes,
            quantity_base_units=qty_base,
            cogs_amount=qty_base * float(batch.purchase_cost_per_unit),
            gross_profit=float(item.line_total) - (qty_base * float(batch.purchase_cost_per_unit)),
        )
        db.add(invoice_item)
    
    await db.commit()
    await db.refresh(invoice)
    return await load_sales_invoice_response(db, invoice.id)


@router.get("", response_model=SalesInvoiceListResponse)
async def list_sales_invoices(
    customer_id: Optional[UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("invoice_date"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List sales invoices with filters."""
    query = select(SalesInvoice).options(selectinload(SalesInvoice.customer))
    
    if customer_id:
        query = query.where(SalesInvoice.customer_id == customer_id)
    if status_filter:
        query = query.where(SalesInvoice.status == status_filter)
    if date_from:
        query = query.where(SalesInvoice.invoice_date >= date_from)
    if date_to:
        query = query.where(SalesInvoice.invoice_date <= date_to)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Sorting
    sort_column = getattr(SalesInvoice, sort_by, SalesInvoice.invoice_date)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    invoices = result.scalars().all()
    
    return SalesInvoiceListResponse(
        items=[SalesInvoiceResponse.model_validate(inv) for inv in invoices],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{invoice_id}", response_model=SalesInvoiceDetailResponse)
async def get_sales_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get sales invoice by ID with items."""
    result = await db.execute(
        select(SalesInvoice)
        .options(
            selectinload(SalesInvoice.customer),
            selectinload(SalesInvoice.items).selectinload(SalesInvoiceItem.medicine),
            selectinload(SalesInvoice.items).selectinload(SalesInvoiceItem.batch),
            selectinload(SalesInvoice.items).selectinload(SalesInvoiceItem.sale_unit),
        )
        .where(SalesInvoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundError("Sales Invoice", str(invoice_id))
    return SalesInvoiceDetailResponse.model_validate(invoice)


@router.get("/{invoice_id}/print-data")
async def get_sales_invoice_print_data(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get sales invoice data formatted for printing."""
    result = await db.execute(
        select(SalesInvoice)
        .options(
            selectinload(SalesInvoice.customer),
            selectinload(SalesInvoice.items).selectinload(SalesInvoiceItem.medicine),
            selectinload(SalesInvoice.items).selectinload(SalesInvoiceItem.batch),
            selectinload(SalesInvoice.items).selectinload(SalesInvoiceItem.sale_unit),
        )
        .where(SalesInvoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundError("Sales Invoice", str(invoice_id))
    
    # Get owner settings for business info
    from app.models import OwnerSettings
    settings_result = await db.execute(select(OwnerSettings))
    owner_settings = settings_result.scalar_one_or_none()
    
    return {
        "invoice": {
            "id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "invoice_date": invoice.invoice_date,
            "due_date": invoice.due_date,
            "status": invoice.status,
            "subtotal": float(invoice.subtotal),
            "discount_amount": float(invoice.discount_amount),
            "tax_amount": float(invoice.tax_amount),
            "total_amount": float(invoice.total_amount),
            "amount_received": float(invoice.amount_received),
            "balance_amount": float(invoice.balance_amount),
            "payment_status": invoice.payment_status,
            "notes": invoice.notes,
        },
        "customer": {
            "name": invoice.customer.name,
            "contact_person": invoice.customer.contact_person,
            "phone": invoice.customer.phone,
            "address": invoice.customer.address,
            "tax_number": invoice.customer.tax_number,
        },
        "business": {
            "name": owner_settings.business_name if owner_settings else "Walmus Pharma",
            "address": owner_settings.business_address if owner_settings else "",
            "phone": owner_settings.phone if owner_settings else "",
            "email": owner_settings.email if owner_settings else "",
            "tax_number": owner_settings.tax_number if owner_settings else "",
        },
        "items": [
            {
                "line_number": item.line_number,
                "medicine_name": item.medicine.name,
                "strength": item.medicine.strength,
                "packing": item.medicine.packing_description,
                "batch_number": item.batch.batch_number,
                "expiry_date": item.batch.expiry_date,
                "quantity_sold": float(item.quantity_sold),
                "sale_unit": item.sale_unit.code if item.sale_unit else "",
                "sale_rate": float(item.sale_rate),
                "discount_percent": float(item.discount_percent),
                "discount_amount": float(item.discount_amount),
                "tax_rate": float(item.tax_rate),
                "tax_amount": float(item.tax_amount),
                "line_total": float(item.line_total),
            }
            for item in invoice.items
        ],
    }


@router.patch("/{invoice_id}", response_model=SalesInvoiceResponse)
async def update_sales_invoice(
    invoice_id: UUID,
    data: SalesInvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Update draft sales invoice."""
    result = await db.execute(
        select(SalesInvoice)
        .options(selectinload(SalesInvoice.items))
        .where(SalesInvoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundError("Sales Invoice", str(invoice_id))
    
    if invoice.status != InvoiceStatus.DRAFT.value:
        raise AppValidationError("Only draft invoices can be updated")
    
    # Update header fields
    update_data = data.model_dump(exclude_unset=True, exclude={"items"})
    for field, value in update_data.items():
        setattr(invoice, field, value)
    
    # If items provided, replace all items
    if data.items is not None:
        # Validate new items
        for item in data.items:
            med_result = await db.execute(select(Medicine).where(Medicine.id == item.medicine_id))
            if not med_result.scalar_one_or_none():
                raise NotFoundError("Medicine", str(item.medicine_id))
            
            batch_result = await db.execute(select(MedicineBatch).where(MedicineBatch.id == item.batch_id))
            batch = batch_result.scalar_one_or_none()
            if not batch:
                raise NotFoundError("Batch", str(item.batch_id))
            
            if batch.medicine_id != item.medicine_id:
                raise AppValidationError(f"Batch {batch.batch_number} does not belong to this medicine")
            
            if batch.status != BatchStatus.ACTIVE.value:
                raise AppValidationError(f"Batch {batch.batch_number} is not active")
            
            if batch.expiry_date < invoice.invoice_date:
                raise ExpiredBatchError(med_result.scalar_one().name, batch.batch_number, str(batch.expiry_date))
            
            qty_base = float(item.quantity_sold) * float(item.conversion_factor)
            if float(batch.available_quantity) < qty_base:
                raise InsufficientStockError(med_result.scalar_one().name, batch.batch_number, qty_base, float(batch.available_quantity))
        
        # Delete existing items
        for item in invoice.items:
            await db.delete(item)
        
        # Create new items
        for idx, item in enumerate(data.items, 1):
            batch_result = await db.execute(select(MedicineBatch).where(MedicineBatch.id == item.batch_id))
            batch = batch_result.scalar_one()
            qty_base = float(item.quantity_sold) * float(item.conversion_factor)
            
            invoice_item = SalesInvoiceItem(
                sales_invoice_id=invoice.id,
                line_number=idx,
                medicine_id=item.medicine_id,
                batch_id=item.batch_id,
                quantity_sold=item.quantity_sold,
                sale_unit_id=item.sale_unit_id,
                conversion_factor=item.conversion_factor,
                sale_rate=item.sale_rate,
                discount_percent=item.discount_percent,
                discount_amount=item.discount_amount,
                tax_rate=item.tax_rate,
                tax_amount=item.tax_amount,
                line_total=item.line_total,
                cost_per_base_unit=batch.purchase_cost_per_unit,
                notes=item.notes,
                quantity_base_units=qty_base,
                cogs_amount=qty_base * float(batch.purchase_cost_per_unit),
                gross_profit=float(item.line_total) - (qty_base * float(batch.purchase_cost_per_unit)),
            )
            db.add(invoice_item)
        
        # Recalculate totals
        invoice.subtotal = sum(item.line_total for item in data.items)
        invoice.discount_amount = sum(item.discount_amount for item in data.items)
        invoice.tax_amount = sum(item.tax_amount for item in data.items)
        invoice.total_amount = invoice.subtotal - invoice.discount_amount + invoice.tax_amount
        invoice.balance_amount = invoice.total_amount - invoice.amount_received
    
    await db.commit()
    await db.refresh(invoice)
    return await load_sales_invoice_response(db, invoice.id)


@router.post("/{invoice_id}/post", response_model=SalesInvoiceResponse)
async def post_sales_invoice(
    invoice_id: UUID,
    data: SalesInvoicePostRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Post a draft sales invoice - deduct stock, create journal entries."""
    result = await db.execute(
        select(SalesInvoice)
        .options(
            selectinload(SalesInvoice.customer),
            selectinload(SalesInvoice.items).selectinload(SalesInvoiceItem.batch),
        )
        .where(SalesInvoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundError("Sales Invoice", str(invoice_id))
    
    if invoice.status != InvoiceStatus.DRAFT.value:
        raise AppValidationError(f"Cannot post invoice with status '{invoice.status}'")
    
    if not invoice.items:
        raise AppValidationError("Invoice has no items")
    
    # Re-validate all batches at posting time (prevent race conditions)
    for item in invoice.items:
        # Lock the batch row
        batch_result = await db.execute(
            select(MedicineBatch)
            .where(MedicineBatch.id == item.batch_id)
            .with_for_update()
        )
        batch = batch_result.scalar_one_or_none()
        
        if not batch:
            raise NotFoundError("Batch", str(item.batch_id))
        
        if batch.status != BatchStatus.ACTIVE.value:
            raise AppValidationError(f"Batch {batch.batch_number} is no longer active")
        
        if batch.expiry_date < invoice.invoice_date:
            med_result = await db.execute(select(Medicine).where(Medicine.id == item.medicine_id))
            medicine = med_result.scalar_one()
            raise ExpiredBatchError(medicine.name, batch.batch_number, str(batch.expiry_date))
        
        qty_base = float(item.quantity_base_units)
        if float(batch.available_quantity) < qty_base:
            med_result = await db.execute(select(Medicine).where(Medicine.id == item.medicine_id))
            medicine = med_result.scalar_one()
            raise InsufficientStockError(medicine.name, batch.batch_number, qty_base, float(batch.available_quantity))
    
    # All validations passed - now deduct stock and create movements
    for item in invoice.items:
        batch_result = await db.execute(
            select(MedicineBatch)
            .where(MedicineBatch.id == item.batch_id)
            .with_for_update()
        )
        batch = batch_result.scalar_one()
        
        qty_base = float(item.quantity_base_units)
        old_available = float(batch.available_quantity)
        batch.available_quantity = old_available - qty_base
        batch.updated_at = datetime.now(UTC)
        
        # Update batch status if depleted
        if batch.available_quantity == 0:
            batch.status = BatchStatus.DEPLETED.value
        
        # Record inventory movement
        movement = InventoryMovement(
            medicine_id=item.medicine_id,
            batch_id=batch.id,
            reason=MovementReason.SALE.value,
            quantity_change=-qty_base,
            quantity_before=old_available,
            quantity_after=float(batch.available_quantity),
            unit_cost=batch.purchase_cost_per_unit,
            reference_type="sales_invoice",
            reference_id=invoice.id,
            created_by=current_user.id,
        )
        db.add(movement)
    
    # Create journal entries
    from app.core.config import settings
    fy_start_month = settings.financial_year_start_month
    
    je = JournalEntry(
        entry_number=await get_next_voucher_number(db, "JE", get_financial_year(invoice.invoice_date, fy_start_month)),
        entry_date=invoice.invoice_date,
        reference_type="sales_invoice",
        reference_id=invoice.id,
        description=f"Sales Invoice {invoice.invoice_number}",
        total_debit=0,
        total_credit=0,
        status="posted",
        created_by=current_user.id,
    )
    db.add(je)
    await db.flush()
    
    line_num = 1
    total_debit = 0
    total_credit = 0
    
    # Receivable or Cash debit
    if invoice.amount_received > 0:
        # Partially paid - split between cash and receivable
        if invoice.amount_received >= invoice.total_amount:
            # Fully paid - cash
            cash_account = await get_default_account(db, "CASH")
            je_line = JournalEntryLine(
                journal_entry_id=je.id,
                account_id=cash_account,
                line_number=line_num,
                entry_type="debit",
                amount=invoice.total_amount,
                description=f"Cash sale - {invoice.invoice_number}",
            )
            db.add(je_line)
            total_debit += float(invoice.total_amount)
            line_num += 1
        else:
            # Partial - cash for received, receivable for balance
            cash_account = await get_default_account(db, "CASH")
            je_line = JournalEntryLine(
                journal_entry_id=je.id,
                account_id=cash_account,
                line_number=line_num,
                entry_type="debit",
                amount=invoice.amount_received,
                description=f"Cash received - {invoice.invoice_number}",
            )
            db.add(je_line)
            total_debit += float(invoice.amount_received)
            line_num += 1
            
            receivable_account = await get_default_account(db, "RECEIVABLE")
            je_line = JournalEntryLine(
                journal_entry_id=je.id,
                account_id=receivable_account,
                line_number=line_num,
                entry_type="debit",
                amount=invoice.balance_amount,
                description=f"Receivable from {invoice.customer.name} - {invoice.invoice_number}",
                party_type="customer",
                party_id=invoice.customer_id,
            )
            db.add(je_line)
            total_debit += float(invoice.balance_amount)
            line_num += 1
    else:
        # Credit sale - full receivable
        receivable_account = await get_default_account(db, "RECEIVABLE")
        je_line = JournalEntryLine(
            journal_entry_id=je.id,
            account_id=receivable_account,
            line_number=line_num,
            entry_type="debit",
            amount=invoice.total_amount,
            description=f"Receivable from {invoice.customer.name} - {invoice.invoice_number}",
            party_type="customer",
            party_id=invoice.customer_id,
        )
        db.add(je_line)
        total_debit += float(invoice.total_amount)
        line_num += 1
    
    # Revenue credit
    revenue_account = await get_default_account(db, "SALES_REV")
    je_line = JournalEntryLine(
        journal_entry_id=je.id,
        account_id=revenue_account,
        line_number=line_num,
        entry_type="credit",
        amount=invoice.subtotal,
        description=f"Sales revenue - {invoice.invoice_number}",
    )
    db.add(je_line)
    total_credit += float(invoice.subtotal)
    line_num += 1
    
    # Tax payable credit
    if invoice.tax_amount > 0:
        tax_account = await get_default_account(db, "TAX_PAYABLE")
        je_line = JournalEntryLine(
            journal_entry_id=je.id,
            account_id=tax_account,
            line_number=line_num,
            entry_type="credit",
            amount=invoice.tax_amount,
            description=f"Output tax - {invoice.invoice_number}",
        )
        db.add(je_line)
        total_credit += float(invoice.tax_amount)
        line_num += 1
    
    # Discount given debit (contra-revenue)
    if invoice.discount_amount > 0:
        disc_account = await get_default_account(db, "DISCOUNT_GIVEN")
        je_line = JournalEntryLine(
            journal_entry_id=je.id,
            account_id=disc_account,
            line_number=line_num,
            entry_type="debit",
            amount=invoice.discount_amount,
            description=f"Discount allowed - {invoice.invoice_number}",
        )
        db.add(je_line)
        total_debit += float(invoice.discount_amount)
        line_num += 1
    
    # COGS and Inventory
    total_cogs = sum(float(item.cogs_amount) for item in invoice.items)
    if total_cogs > 0:
        cogs_account = await get_default_account(db, "COGS")
        je_line = JournalEntryLine(
            journal_entry_id=je.id,
            account_id=cogs_account,
            line_number=line_num,
            entry_type="debit",
            amount=total_cogs,
            description=f"COGS - {invoice.invoice_number}",
        )
        db.add(je_line)
        total_debit += total_cogs
        line_num += 1
        
        inventory_account = await get_default_account(db, "INVENTORY")
        je_line = JournalEntryLine(
            journal_entry_id=je.id,
            account_id=inventory_account,
            line_number=line_num,
            entry_type="credit",
            amount=total_cogs,
            description=f"Inventory reduction - {invoice.invoice_number}",
        )
        db.add(je_line)
        total_credit += total_cogs
        line_num += 1
    
    je.total_debit = total_debit
    je.total_credit = total_credit
    
    # Update invoice status
    invoice.status = InvoiceStatus.POSTED.value
    invoice.posted_at = datetime.now(UTC)
    invoice.posted_by = current_user.id
    invoice.payment_status = PaymentStatus.PAID.value if invoice.balance_amount == 0 else PaymentStatus.PARTIAL.value if invoice.amount_received > 0 else PaymentStatus.UNPAID.value
    
    # Update customer investment tracking if applicable
    # (This would be handled by a separate service in production)
    
    await db.commit()
    await db.refresh(invoice)
    return await load_sales_invoice_response(db, invoice.id)


@router.post("/{invoice_id}/cancel", response_model=SalesInvoiceResponse)
async def cancel_sales_invoice(
    invoice_id: UUID,
    reason: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Cancel a posted sales invoice."""
    result = await db.execute(
        select(SalesInvoice)
        .where(SalesInvoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundError("Sales Invoice", str(invoice_id))
    
    if invoice.status != InvoiceStatus.POSTED.value:
        raise AppValidationError("Only posted invoices can be cancelled")
    
    # In a real implementation, this would create reversal journal entries
    # and restore inventory. For now, just mark as cancelled.
    
    invoice.status = InvoiceStatus.CANCELLED.value
    invoice.cancelled_at = datetime.now(UTC)
    invoice.cancelled_by = current_user.id
    invoice.cancellation_reason = reason
    
    await db.commit()
    await db.refresh(invoice)
    return await load_sales_invoice_response(db, invoice.id)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sales_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Delete a draft sales invoice."""
    result = await db.execute(select(SalesInvoice).where(SalesInvoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundError("Sales Invoice", str(invoice_id))
    
    if invoice.status != InvoiceStatus.DRAFT.value:
        raise AppValidationError("Only draft invoices can be deleted")
    
    await db.delete(invoice)
    await db.commit()
