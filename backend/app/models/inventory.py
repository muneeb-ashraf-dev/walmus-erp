"""Inventory models: Batch, Purchase/Sales Invoices, Returns, Movements, Adjustments."""
from datetime import date, datetime, UTC
from typing import Optional, List
from uuid import UUID

from sqlalchemy import (
    String,
    Text,
    Integer,
    Boolean,
    Date,
    DateTime,
    Numeric,
    ForeignKey,
    UniqueConstraint,
    Index,
    CheckConstraint,
    Enum as SQLEnum,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import (
    InvoiceStatus,
    PaymentStatus,
    PaymentMethod,
    MovementReason,
    BatchStatus,
)


class MedicineBatch(BaseModel):
    """Medicine batch with expiry tracking."""
    __tablename__ = "medicine_batch"
    
    medicine_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine.id", ondelete="RESTRICT"), 
        nullable=False,
        index=True
    )
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False)
    manufacturing_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    supplier_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("supplier.id", ondelete="SET NULL"), 
        nullable=True,
        index=True
    )
    purchase_invoice_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("purchase_invoice.id", ondelete="SET NULL"), 
        nullable=True
    )
    received_quantity: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    available_quantity: Mapped[float] = mapped_column(Numeric(18, 4), default=0.0, nullable=False)
    purchase_cost_per_unit: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), 
        default=BatchStatus.ACTIVE.value, 
        nullable=False,
        index=True
    )
    location: Mapped[str] = mapped_column(String(100), default="MAIN", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Relationships
    medicine: Mapped["Medicine"] = relationship(back_populates="batches")
    supplier: Mapped[Optional["Supplier"]] = relationship(back_populates="batches")
    purchase_invoice: Mapped[Optional["PurchaseInvoice"]] = relationship()
    purchase_items: Mapped[List["PurchaseInvoiceItem"]] = relationship(back_populates="batch")
    sales_items: Mapped[List["SalesInvoiceItem"]] = relationship(back_populates="batch")
    
    __table_args__ = (
        UniqueConstraint("medicine_id", "batch_number", "supplier_id", name="uq_medicine_batch"),
        CheckConstraint("received_quantity >= 0", name="ck_batch_received_qty_nonneg"),
        CheckConstraint("available_quantity >= 0", name="ck_batch_available_qty_nonneg"),
        CheckConstraint("available_quantity <= received_quantity", name="ck_batch_available_le_received"),
        CheckConstraint("purchase_cost_per_unit >= 0", name="ck_batch_cost_nonneg"),
        Index("ix_batch_expiry_active", "expiry_date", postgresql_where=status == BatchStatus.ACTIVE.value),
        Index("ix_batch_medicine_expiry", "medicine_id", "expiry_date"),
    )


class PurchaseInvoice(BaseModel):
    """Purchase invoice from supplier."""
    __tablename__ = "purchase_invoice"
    
    voucher_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    supplier_invoice_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    supplier_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("supplier.id", ondelete="RESTRICT"), 
        nullable=False,
        index=True
    )
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    received_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), 
        default=InvoiceStatus.DRAFT.value, 
        nullable=False,
        index=True
    )
    subtotal: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    amount_paid: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    balance_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    payment_status: Mapped[str] = mapped_column(
        String(20), 
        default=PaymentStatus.UNPAID.value, 
        nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attachment_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    posted_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    # Relationships
    supplier: Mapped["Supplier"] = relationship(back_populates="purchase_invoices")
    items: Mapped[List["PurchaseInvoiceItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    batches: Mapped[List["MedicineBatch"]] = relationship(back_populates="purchase_invoice")
    payments: Mapped[List["Payment"]] = relationship(back_populates="purchase_invoice")
    returns: Mapped[List["PurchaseReturn"]] = relationship(back_populates="original_invoice")


class PurchaseInvoiceItem(BaseModel):
    """Purchase invoice line item."""
    __tablename__ = "purchase_invoice_item"
    
    purchase_invoice_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("purchase_invoice.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    medicine_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine.id", ondelete="RESTRICT"), 
        nullable=False,
        index=True
    )
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False)
    manufacturing_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    quantity_received: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    purchase_unit_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine_unit.id", ondelete="SET NULL"), 
        nullable=True
    )
    conversion_factor: Mapped[float] = mapped_column(Numeric(18, 4), default=1.0, nullable=False)
    purchase_rate: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    discount_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    batch_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine_batch.id", ondelete="SET NULL"), 
        nullable=True,
        index=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Computed column (quantity in base units)
    quantity_base_units: Mapped[float] = mapped_column(
        Numeric(18, 4), 
        default=0.0, 
        nullable=False
    )
    
    # Relationships
    invoice: Mapped["PurchaseInvoice"] = relationship(back_populates="items")
    medicine: Mapped["Medicine"] = relationship()
    purchase_unit: Mapped[Optional["MedicineUnit"]] = relationship()
    batch: Mapped[Optional["MedicineBatch"]] = relationship(back_populates="purchase_items")
    returns: Mapped[List["PurchaseReturnItem"]] = relationship(back_populates="original_item")
    
    __table_args__ = (
        UniqueConstraint("purchase_invoice_id", "line_number", name="uq_purchase_item_line"),
        CheckConstraint("quantity_received > 0", name="ck_purchase_item_qty_positive"),
        CheckConstraint("conversion_factor > 0", name="ck_purchase_item_conv_positive"),
        CheckConstraint("purchase_rate >= 0", name="ck_purchase_item_rate_nonneg"),
    )


class SalesInvoice(BaseModel):
    """Sales invoice to customer."""
    __tablename__ = "sales_invoice"
    
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    customer_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("customer.id", ondelete="RESTRICT"), 
        nullable=False,
        index=True
    )
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), 
        default=InvoiceStatus.DRAFT.value, 
        nullable=False,
        index=True
    )
    subtotal: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    amount_received: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    balance_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    payment_status: Mapped[str] = mapped_column(
        String(20), 
        default=PaymentStatus.UNPAID.value, 
        nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    printed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_printed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    posted_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    # Relationships
    customer: Mapped["Customer"] = relationship(back_populates="sales_invoices")
    items: Mapped[List["SalesInvoiceItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[List["Payment"]] = relationship(back_populates="sales_invoice")
    returns: Mapped[List["SalesReturn"]] = relationship(back_populates="original_invoice")


class SalesInvoiceItem(BaseModel):
    """Sales invoice line item with batch allocation."""
    __tablename__ = "sales_invoice_item"
    
    sales_invoice_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("sales_invoice.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    medicine_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine.id", ondelete="RESTRICT"), 
        nullable=False,
        index=True
    )
    batch_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine_batch.id", ondelete="RESTRICT"), 
        nullable=False,
        index=True
    )
    quantity_sold: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    sale_unit_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine_unit.id", ondelete="SET NULL"), 
        nullable=True
    )
    conversion_factor: Mapped[float] = mapped_column(Numeric(18, 4), default=1.0, nullable=False)
    sale_rate: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    discount_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    cost_per_base_unit: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Computed columns
    quantity_base_units: Mapped[float] = mapped_column(Numeric(18, 4), default=0.0, nullable=False)
    cogs_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    gross_profit: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    
    # Relationships
    invoice: Mapped["SalesInvoice"] = relationship(back_populates="items")
    medicine: Mapped["Medicine"] = relationship()
    batch: Mapped["MedicineBatch"] = relationship(back_populates="sales_items")
    sale_unit: Mapped[Optional["MedicineUnit"]] = relationship()
    returns: Mapped[List["SalesReturnItem"]] = relationship(back_populates="original_item")
    
    __table_args__ = (
        UniqueConstraint("sales_invoice_id", "line_number", name="uq_sales_item_line"),
        CheckConstraint("quantity_sold > 0", name="ck_sales_item_qty_positive"),
        CheckConstraint("conversion_factor > 0", name="ck_sales_item_conv_positive"),
        CheckConstraint("sale_rate >= 0", name="ck_sales_item_rate_nonneg"),
        CheckConstraint("cost_per_base_unit >= 0", name="ck_sales_item_cost_nonneg"),
    )


class PurchaseReturn(BaseModel):
    """Purchase return to supplier."""
    __tablename__ = "purchase_return"
    
    return_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    original_purchase_invoice_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("purchase_invoice.id", ondelete="RESTRICT"), 
        nullable=False,
        index=True
    )
    supplier_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("supplier.id", ondelete="RESTRICT"), 
        nullable=False,
        index=True
    )
    return_date: Mapped[date] = mapped_column(Date, default=lambda: datetime.now(UTC).date(), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), 
        default=InvoiceStatus.DRAFT.value, 
        nullable=False
    )
    total_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    credit_note_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    posted_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    # Relationships
    original_invoice: Mapped["PurchaseInvoice"] = relationship(back_populates="returns")
    supplier: Mapped["Supplier"] = relationship()
    items: Mapped[List["PurchaseReturnItem"]] = relationship(back_populates="return_", cascade="all, delete-orphan")


class PurchaseReturnItem(BaseModel):
    """Purchase return line item."""
    __tablename__ = "purchase_return_item"
    
    purchase_return_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("purchase_return.id", ondelete="CASCADE"), 
        nullable=False
    )
    original_purchase_item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("purchase_invoice_item.id", ondelete="RESTRICT"), 
        nullable=False
    )
    batch_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine_batch.id", ondelete="RESTRICT"), 
        nullable=False
    )
    quantity_returned: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    return_rate: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    restock_action: Mapped[str] = mapped_column(String(20), default="quarantine", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Relationships
    return_: Mapped["PurchaseReturn"] = relationship(back_populates="items")
    original_item: Mapped["PurchaseInvoiceItem"] = relationship(back_populates="returns")
    batch: Mapped["MedicineBatch"] = relationship()
    
    __table_args__ = (
        CheckConstraint("quantity_returned > 0", name="ck_purchase_return_item_qty_positive"),
    )


class SalesReturn(BaseModel):
    """Sales return from customer."""
    __tablename__ = "sales_return"
    
    return_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    original_sales_invoice_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("sales_invoice.id", ondelete="RESTRICT"), 
        nullable=False,
        index=True
    )
    customer_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("customer.id", ondelete="RESTRICT"), 
        nullable=False,
        index=True
    )
    return_date: Mapped[date] = mapped_column(Date, default=lambda: datetime.now(UTC).date(), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), 
        default=InvoiceStatus.DRAFT.value, 
        nullable=False
    )
    total_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    refund_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    credit_note_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    posted_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    # Relationships
    original_invoice: Mapped["SalesInvoice"] = relationship(back_populates="returns")
    customer: Mapped["Customer"] = relationship()
    items: Mapped[List["SalesReturnItem"]] = relationship(back_populates="return_", cascade="all, delete-orphan")


class SalesReturnItem(BaseModel):
    """Sales return line item."""
    __tablename__ = "sales_return_item"
    
    sales_return_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("sales_return.id", ondelete="CASCADE"), 
        nullable=False
    )
    original_sales_item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("sales_invoice_item.id", ondelete="RESTRICT"), 
        nullable=False
    )
    batch_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine_batch.id", ondelete="RESTRICT"), 
        nullable=False
    )
    quantity_returned: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    return_rate: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    restock_action: Mapped[str] = mapped_column(String(20), default="quarantine", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Relationships
    return_: Mapped["SalesReturn"] = relationship(back_populates="items")
    original_item: Mapped["SalesInvoiceItem"] = relationship(back_populates="returns")
    batch: Mapped["MedicineBatch"] = relationship()
    
    __table_args__ = (
        CheckConstraint("quantity_returned > 0", name="ck_sales_return_item_qty_positive"),
    )


class InventoryMovement(BaseModel):
    """Immutable inventory movement audit trail."""
    __tablename__ = "inventory_movement"
    
    movement_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(UTC), 
        nullable=False,
        index=True
    )
    medicine_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine.id", ondelete="RESTRICT"), 
        nullable=False,
        index=True
    )
    batch_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine_batch.id", ondelete="SET NULL"), 
        nullable=True,
        index=True
    )
    reason: Mapped[str] = mapped_column(
        String(50), 
        nullable=False,
        index=True
    )
    quantity_change: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    quantity_before: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    quantity_after: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    unit_cost: Mapped[Optional[float]] = mapped_column(Numeric(18, 4), nullable=True)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    # Relationships
    medicine: Mapped["Medicine"] = relationship()
    batch: Mapped[Optional["MedicineBatch"]] = relationship()
    
    __table_args__ = (
        Index("ix_invmov_medicine_date", "medicine_id", "movement_date"),
        Index("ix_invmov_batch_date", "batch_id", "movement_date"),
        Index("ix_invmov_reference", "reference_type", "reference_id"),
    )


class StockAdjustment(BaseModel):
    """Manual stock adjustment."""
    __tablename__ = "stock_adjustment"
    
    adjustment_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    adjustment_date: Mapped[date] = mapped_column(Date, default=lambda: datetime.now(UTC).date(), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    total_items: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_value_change: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), 
        default=InvoiceStatus.DRAFT.value, 
        nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    posted_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    # Relationships
    items: Mapped[List["StockAdjustmentItem"]] = relationship(back_populates="adjustment", cascade="all, delete-orphan")


class StockAdjustmentItem(BaseModel):
    """Stock adjustment line item."""
    __tablename__ = "stock_adjustment_item"
    
    stock_adjustment_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("stock_adjustment.id", ondelete="CASCADE"), 
        nullable=False
    )
    medicine_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine.id", ondelete="RESTRICT"), 
        nullable=False
    )
    batch_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine_batch.id", ondelete="SET NULL"), 
        nullable=True
    )
    quantity_change: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    unit_cost: Mapped[Optional[float]] = mapped_column(Numeric(18, 4), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Computed
    value_change: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    
    # Relationships
    adjustment: Mapped["StockAdjustment"] = relationship(back_populates="items")
    medicine: Mapped["Medicine"] = relationship()
    batch: Mapped[Optional["MedicineBatch"]] = relationship()