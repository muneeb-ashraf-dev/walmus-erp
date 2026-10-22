"""Purchases schemas."""
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from datetime import date, datetime

from app.schemas.summaries import (
    MedicineBatchSummary,
    MedicineSummary,
    MedicineUnitSummary,
    SupplierSummary,
)


class PurchaseInvoiceItemBase(BaseModel):
    medicine_id: UUID
    batch_number: str = Field(..., min_length=1, max_length=100)
    manufacturing_date: Optional[date] = None
    expiry_date: date
    quantity_received: Decimal = Field(..., gt=0)
    purchase_unit_id: Optional[UUID] = None
    conversion_factor: Decimal = Field(default=Decimal("1.0"), gt=0)
    purchase_rate: Decimal = Field(..., ge=0)
    discount_percent: Decimal = Field(default=Decimal("0.0"), ge=0, le=100)
    discount_amount: Decimal = Field(default=Decimal("0.0"), ge=0)
    tax_rate: Decimal = Field(default=Decimal("0.0"), ge=0, le=100)
    tax_amount: Decimal = Field(default=Decimal("0.0"), ge=0)
    line_total: Decimal = Field(..., ge=0)
    notes: Optional[str] = None


class PurchaseInvoiceItemCreate(PurchaseInvoiceItemBase):
    pass


class PurchaseInvoiceItemResponse(PurchaseInvoiceItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    purchase_invoice_id: UUID
    line_number: int
    quantity_base_units: Decimal
    batch_id: Optional[UUID] = None
    medicine: Optional[MedicineSummary] = None
    purchase_unit: Optional[MedicineUnitSummary] = None
    batch: Optional[MedicineBatchSummary] = None


class PurchaseInvoiceBase(BaseModel):
    supplier_invoice_number: Optional[str] = Field(None, max_length=100)
    supplier_id: UUID
    invoice_date: date
    received_date: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    items: List[PurchaseInvoiceItemCreate]


class PurchaseInvoiceCreate(PurchaseInvoiceBase):
    pass


class PurchaseInvoiceUpdate(BaseModel):
    supplier_invoice_number: Optional[str] = Field(None, max_length=100)
    supplier_id: Optional[UUID] = None
    invoice_date: Optional[date] = None
    received_date: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    items: Optional[List[PurchaseInvoiceItemCreate]] = None


class PurchaseInvoicePostRequest(BaseModel):
    """Request to post a purchase invoice."""
    amount_paid: Decimal = Field(default=Decimal("0.0"), ge=0)
    payment_method: Optional[str] = Field(None, max_length=20)
    payment_reference: Optional[str] = Field(None, max_length=100)


class PurchaseInvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    voucher_number: str
    supplier_invoice_number: Optional[str]
    supplier_id: UUID
    invoice_date: date
    received_date: Optional[date]
    due_date: Optional[date]
    status: str
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    balance_amount: Decimal
    payment_status: str
    notes: Optional[str]
    attachment_path: Optional[str]
    posted_at: Optional[datetime]
    posted_by: Optional[UUID]
    cancelled_at: Optional[datetime]
    cancelled_by: Optional[UUID]
    cancellation_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID]
    supplier: Optional[SupplierSummary] = None


class PurchaseInvoiceDetailResponse(PurchaseInvoiceResponse):
    items: List[PurchaseInvoiceItemResponse]


class PurchaseInvoiceListResponse(BaseModel):
    items: List[PurchaseInvoiceResponse]
    total: int
    limit: int
    offset: int