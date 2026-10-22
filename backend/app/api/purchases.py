"""Purchases API endpoints."""
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime, UTC
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db, get_db_context
from app.core.security import get_current_user
from app.models import (
    PurchaseInvoice, PurchaseInvoiceItem, Supplier, Medicine, MedicineBatch, MedicineUnit,
    FinancialAccount, JournalEntry, JournalEntryLine, InventoryMovement, NumberSequence,
    OwnerSettings,
)
from app.models.enums import InvoiceStatus, PaymentStatus, AccountType, MovementReason, BatchStatus
from app.schemas.purchases import (
    PurchaseInvoiceCreate,
    PurchaseInvoiceUpdate,
    PurchaseInvoiceResponse,
    PurchaseInvoiceListResponse,
    PurchaseInvoiceDetailResponse,
    PurchaseInvoicePostRequest,
)
from app.core.exceptions import NotFoundError, ConflictError, ValidationError as AppValidationError, InvoicePostingError

router = APIRouter()


async def load_purchase_invoice_response(db: AsyncSession, invoice_id: UUID) -> PurchaseInvoiceResponse:
    """Reload an invoice with its supplier before building the API response."""
    result = await db.execute(
        select(PurchaseInvoice)
        .options(selectinload(PurchaseInvoice.supplier))
        .where(PurchaseInvoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundError("Purchase Invoice", str(invoice_id))
    return PurchaseInvoiceResponse.model_validate(invoice)


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
    
    # Get format template from owner settings or use default
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


@router.post("", response_model=PurchaseInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_invoice(
    data: PurchaseInvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Create a draft purchase invoice."""
    # Validate supplier
    result = await db.execute(select(Supplier).where(Supplier.id == data.supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise NotFoundError("Supplier", str(data.supplier_id))
    
    # Validate medicines and units
    for item in data.items:
        med_result = await db.execute(select(Medicine).where(Medicine.id == item.medicine_id))
        medicine = med_result.scalar_one_or_none()
        if not medicine:
            raise NotFoundError("Medicine", str(item.medicine_id))
        
        if item.purchase_unit_id:
            unit_result = await db.execute(select(MedicineUnit).where(MedicineUnit.id == item.purchase_unit_id))
            if not unit_result.scalar_one_or_none():
                raise NotFoundError("Purchase Unit", str(item.purchase_unit_id))
        
        # Validate expiry date
        if item.expiry_date < item.manufacturing_date if item.manufacturing_date else False:
            raise AppValidationError(f"Expiry date must be after manufacturing date for {medicine.name}")
    
    # Calculate totals
    subtotal = sum(item.line_total for item in data.items)
    discount_amount = sum(item.discount_amount for item in data.items)
    tax_amount = sum(item.tax_amount for item in data.items)
    total_amount = subtotal - discount_amount + tax_amount
    
    # Generate voucher number
    fy = get_financial_year(data.invoice_date)
    owner_result = await db.execute(select(OwnerSettings))
    owner_settings = owner_result.scalar_one_or_none()
    voucher_number = await get_next_voucher_number(
        db, owner_settings.purchase_prefix if owner_settings else "PUR", fy
    )
    
    # Create invoice
    invoice = PurchaseInvoice(
        voucher_number=voucher_number,
        supplier_invoice_number=data.supplier_invoice_number,
        supplier_id=data.supplier_id,
        invoice_date=data.invoice_date,
        received_date=data.received_date,
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
        invoice_item = PurchaseInvoiceItem(
            purchase_invoice_id=invoice.id,
            line_number=idx,
            medicine_id=item.medicine_id,
            batch_number=item.batch_number,
            manufacturing_date=item.manufacturing_date,
            expiry_date=item.expiry_date,
            quantity_received=item.quantity_received,
            purchase_unit_id=item.purchase_unit_id,
            conversion_factor=item.conversion_factor,
            purchase_rate=item.purchase_rate,
            discount_percent=item.discount_percent,
            discount_amount=item.discount_amount,
            tax_rate=item.tax_rate,
            tax_amount=item.tax_amount,
            line_total=item.line_total,
            notes=item.notes,
        )
        db.add(invoice_item)
    
    await db.commit()
    await db.refresh(invoice)
    return await load_purchase_invoice_response(db, invoice.id)


@router.get("", response_model=PurchaseInvoiceListResponse)
async def list_purchase_invoices(
    supplier_id: Optional[UUID] = Query(None),
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
    """List purchase invoices with filters."""
    query = select(PurchaseInvoice).options(selectinload(PurchaseInvoice.supplier))
    
    if supplier_id:
        query = query.where(PurchaseInvoice.supplier_id == supplier_id)
    if status_filter:
        query = query.where(PurchaseInvoice.status == status_filter)
    if date_from:
        query = query.where(PurchaseInvoice.invoice_date >= date_from)
    if date_to:
        query = query.where(PurchaseInvoice.invoice_date <= date_to)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Sorting
    sort_column = getattr(PurchaseInvoice, sort_by, PurchaseInvoice.invoice_date)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    invoices = result.scalars().all()
    
    return PurchaseInvoiceListResponse(
        items=[PurchaseInvoiceResponse.model_validate(inv) for inv in invoices],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{invoice_id}", response_model=PurchaseInvoiceDetailResponse)
async def get_purchase_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get purchase invoice by ID with items."""
    result = await db.execute(
        select(PurchaseInvoice)
        .options(
            selectinload(PurchaseInvoice.supplier),
            selectinload(PurchaseInvoice.items).selectinload(PurchaseInvoiceItem.medicine),
            selectinload(PurchaseInvoice.items).selectinload(PurchaseInvoiceItem.purchase_unit),
            selectinload(PurchaseInvoice.items).selectinload(PurchaseInvoiceItem.batch),
        )
        .where(PurchaseInvoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundError("Purchase Invoice", str(invoice_id))
    return PurchaseInvoiceDetailResponse.model_validate(invoice)


@router.patch("/{invoice_id}", response_model=PurchaseInvoiceResponse)
async def update_purchase_invoice(
    invoice_id: UUID,
    data: PurchaseInvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Update draft purchase invoice."""
    result = await db.execute(
        select(PurchaseInvoice)
        .options(selectinload(PurchaseInvoice.items))
        .where(PurchaseInvoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundError("Purchase Invoice", str(invoice_id))
    
    if invoice.status != InvoiceStatus.DRAFT.value:
        raise AppValidationError("Only draft invoices can be updated")
    
    # Update header fields
    update_data = data.model_dump(exclude_unset=True, exclude={"items"})
    for field, value in update_data.items():
        setattr(invoice, field, value)
    
    # If items provided, replace all items
    if data.items is not None:
        # Delete existing items
        for item in invoice.items:
            await db.delete(item)
        
        # Create new items
        for idx, item in enumerate(data.items, 1):
            invoice_item = PurchaseInvoiceItem(
                purchase_invoice_id=invoice.id,
                line_number=idx,
                medicine_id=item.medicine_id,
                batch_number=item.batch_number,
                manufacturing_date=item.manufacturing_date,
                expiry_date=item.expiry_date,
                quantity_received=item.quantity_received,
                purchase_unit_id=item.purchase_unit_id,
                conversion_factor=item.conversion_factor,
                purchase_rate=item.purchase_rate,
                discount_percent=item.discount_percent,
                discount_amount=item.discount_amount,
                tax_rate=item.tax_rate,
                tax_amount=item.tax_amount,
                line_total=item.line_total,
                notes=item.notes,
            )
            db.add(invoice_item)
        
        # Recalculate totals
        invoice.subtotal = sum(item.line_total for item in data.items)
        invoice.discount_amount = sum(item.discount_amount for item in data.items)
        invoice.tax_amount = sum(item.tax_amount for item in data.items)
        invoice.total_amount = invoice.subtotal - invoice.discount_amount + invoice.tax_amount
        invoice.balance_amount = invoice.total_amount - invoice.amount_paid
    
    await db.commit()
    await db.refresh(invoice)
    return await load_purchase_invoice_response(db, invoice.id)


@router.post("/{invoice_id}/post", response_model=PurchaseInvoiceResponse)
async def post_purchase_invoice(
    invoice_id: UUID,
    data: PurchaseInvoicePostRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Post a draft purchase invoice - update stock, create batches, create journal entries."""
    result = await db.execute(
        select(PurchaseInvoice)
        .options(
            selectinload(PurchaseInvoice.supplier),
            selectinload(PurchaseInvoice.items).selectinload(PurchaseInvoiceItem.medicine),
        )
        .where(PurchaseInvoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundError("Purchase Invoice", str(invoice_id))
    
    if invoice.status != InvoiceStatus.DRAFT.value:
        raise AppValidationError(f"Cannot post invoice with status '{invoice.status}'")
    
    if not invoice.items:
        raise AppValidationError("Invoice has no items")
    
    # Get owner settings for FY start month
    from app.core.config import settings
    fy_start_month = settings.financial_year_start_month
    
    # Process each item - create/update batches and update stock
    for item in invoice.items:
        medicine = item.medicine
        
        # Calculate base quantity
        qty_base = float(item.quantity_received) * float(item.conversion_factor)
        
        # Find or create batch
        batch_result = await db.execute(
            select(MedicineBatch)
            .where(
                and_(
                    MedicineBatch.medicine_id == item.medicine_id,
                    MedicineBatch.batch_number == item.batch_number,
                    MedicineBatch.supplier_id == invoice.supplier_id,
                )
            )
        )
        batch = batch_result.scalar_one_or_none()
        
        if batch:
            # Update existing batch
            old_available = float(batch.available_quantity)
            batch.available_quantity = old_available + qty_base
            batch.received_quantity = float(batch.received_quantity) + qty_base
            batch.updated_at = datetime.now(UTC)
        else:
            # Create new batch
            batch = MedicineBatch(
                medicine_id=item.medicine_id,
                batch_number=item.batch_number,
                manufacturing_date=item.manufacturing_date,
                expiry_date=item.expiry_date,
                supplier_id=invoice.supplier_id,
                purchase_invoice_id=invoice.id,
                received_quantity=qty_base,
                available_quantity=qty_base,
                purchase_cost_per_unit=float(item.purchase_rate) / float(item.conversion_factor),
                status=BatchStatus.ACTIVE.value,
                location="MAIN",
            )
            db.add(batch)
            await db.flush()
        
        # Link item to batch
        item.batch_id = batch.id
        item.quantity_base_units = qty_base
        
        # Record inventory movement
        movement = InventoryMovement(
            medicine_id=item.medicine_id,
            batch_id=batch.id,
            reason=MovementReason.PURCHASE.value,
            quantity_change=qty_base,
            quantity_before=float(batch.available_quantity) - qty_base,
            quantity_after=float(batch.available_quantity),
            unit_cost=batch.purchase_cost_per_unit,
            reference_type="purchase_invoice",
            reference_id=invoice.id,
            created_by=current_user.id,
        )
        db.add(movement)
        
        # Update medicine WAC (Weighted Average Cost)
        # This is a simplified version - in production, compute properly
        # For now, we'll update on the medicine level
    
    # Create journal entries
    # Debit: INVENTORY, Credit: PAYABLE (and TAX_PAYABLE, DISCOUNT_RECEIVED if applicable)
    je = JournalEntry(
        entry_number=await get_next_voucher_number(db, "JE", get_financial_year(invoice.invoice_date, fy_start_month)),
        entry_date=invoice.invoice_date,
        reference_type="purchase_invoice",
        reference_id=invoice.id,
        description=f"Purchase Invoice {invoice.voucher_number}",
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
    
    # Inventory debit
    inventory_account = await get_default_account(db, "INVENTORY")
    je_line = JournalEntryLine(
        journal_entry_id=je.id,
        account_id=inventory_account,
        line_number=line_num,
        entry_type="debit",
        amount=invoice.subtotal - invoice.discount_amount,
        description=f"Inventory purchase - {invoice.voucher_number}",
    )
    db.add(je_line)
    total_debit += float(invoice.subtotal - invoice.discount_amount)
    line_num += 1
    
    # Tax payable credit (if applicable)
    if invoice.tax_amount > 0:
        tax_account = await get_default_account(db, "TAX_PAYABLE")
        je_line = JournalEntryLine(
            journal_entry_id=je.id,
            account_id=tax_account,
            line_number=line_num,
            entry_type="credit",
            amount=invoice.tax_amount,
            description=f"Input tax - {invoice.voucher_number}",
        )
        db.add(je_line)
        total_credit += float(invoice.tax_amount)
        line_num += 1
    
    # Discount received credit (if applicable)
    if invoice.discount_amount > 0:
        disc_account = await get_default_account(db, "DISCOUNT_RECEIVED")
        je_line = JournalEntryLine(
            journal_entry_id=je.id,
            account_id=disc_account,
            line_number=line_num,
            entry_type="credit",
            amount=invoice.discount_amount,
            description=f"Discount received - {invoice.voucher_number}",
        )
        db.add(je_line)
        total_credit += float(invoice.discount_amount)
        line_num += 1
    
    # Payable credit
    payable_account = await get_default_account(db, "PAYABLE")
    je_line = JournalEntryLine(
        journal_entry_id=je.id,
        account_id=payable_account,
        line_number=line_num,
        entry_type="credit",
        amount=invoice.total_amount,
        description=f"Payable to {invoice.supplier.name} - {invoice.voucher_number}",
        party_type="supplier",
        party_id=invoice.supplier_id,
    )
    db.add(je_line)
    total_credit += float(invoice.total_amount)
    line_num += 1
    
    # If cash purchase (amount_paid > 0), add cash entry
    if invoice.amount_paid > 0:
        cash_account = await get_default_account(db, "CASH")
        je_line = JournalEntryLine(
            journal_entry_id=je.id,
            account_id=cash_account,
            line_number=line_num,
            entry_type="credit",
            amount=invoice.amount_paid,
            description=f"Cash payment - {invoice.voucher_number}",
        )
        db.add(je_line)
        total_credit += float(invoice.amount_paid)
        line_num += 1
        
        # Receivable/Payable adjustment for cash paid
        je_line = JournalEntryLine(
            journal_entry_id=je.id,
            account_id=payable_account,
            line_number=line_num,
            entry_type="debit",
            amount=invoice.amount_paid,
            description=f"Cash paid to {invoice.supplier.name} - {invoice.voucher_number}",
            party_type="supplier",
            party_id=invoice.supplier_id,
        )
        db.add(je_line)
        total_debit += float(invoice.amount_paid)
        line_num += 1
    
    je.total_debit = total_debit
    je.total_credit = total_credit
    
    # Update invoice status
    invoice.status = InvoiceStatus.POSTED.value
    invoice.posted_at = datetime.now(UTC)
    invoice.posted_by = current_user.id
    invoice.payment_status = PaymentStatus.PAID.value if invoice.balance_amount == 0 else PaymentStatus.PARTIAL.value if invoice.amount_paid > 0 else PaymentStatus.UNPAID.value
    
    await db.commit()
    await db.refresh(invoice)
    return await load_purchase_invoice_response(db, invoice.id)


@router.post("/{invoice_id}/cancel", response_model=PurchaseInvoiceResponse)
async def cancel_purchase_invoice(
    invoice_id: UUID,
    reason: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Cancel a posted purchase invoice (create reversal)."""
    result = await db.execute(
        select(PurchaseInvoice)
        .where(PurchaseInvoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundError("Purchase Invoice", str(invoice_id))
    
    if invoice.status != InvoiceStatus.POSTED.value:
        raise AppValidationError("Only posted invoices can be cancelled")
    
    # Create reversal journal entry
    from app.core.config import settings
    fy_start_month = settings.financial_year_start_month
    
    je = JournalEntry(
        entry_number=await get_next_voucher_number(db, "JE", get_financial_year(date.today(), fy_start_month)),
        entry_date=date.today(),
        reference_type="purchase_invoice_cancel",
        reference_id=invoice.id,
        description=f"Cancellation of Purchase Invoice {invoice.voucher_number}: {reason}",
        total_debit=0,
        total_credit=0,
        status="posted",
        created_by=current_user.id,
    )
    db.add(je)
    await db.flush()
    
    # Reverse the original entries (simplified)
    # This would need to reverse all the original journal entries
    # For now, just mark as cancelled
    
    invoice.status = InvoiceStatus.CANCELLED.value
    invoice.cancelled_at = datetime.now(UTC)
    invoice.cancelled_by = current_user.id
    invoice.cancellation_reason = reason
    
    await db.commit()
    await db.refresh(invoice)
    return await load_purchase_invoice_response(db, invoice.id)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_purchase_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Delete a draft purchase invoice."""
    result = await db.execute(select(PurchaseInvoice).where(PurchaseInvoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundError("Purchase Invoice", str(invoice_id))
    
    if invoice.status != InvoiceStatus.DRAFT.value:
        raise AppValidationError("Only draft invoices can be deleted")
    
    await db.delete(invoice)
    await db.commit()
