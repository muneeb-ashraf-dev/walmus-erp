"""Sales schemas."""
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from datetime import date, datetime

from app.schemas.summaries import (
    CustomerSummary,
    MedicineBatchSummary,
    MedicineSummary,
    MedicineUnitSummary,
)


class SalesInvoiceItemBase(BaseModel):
    medicine_id: UUID
    batch_id: UUID
    quantity_sold: Decimal = Field(..., gt=0)
    sale_unit_id: Optional[UUID] = None
    conversion_factor: Decimal = Field(default=Decimal("1.0"), gt=0)
    sale_rate: Decimal = Field(..., ge=0)
    discount_percent: Decimal = Field(default=Decimal("0.0"), ge=0, le=100)
    discount_amount: Decimal = Field(default=Decimal("0.0"), ge=0)
    tax_rate: Decimal = Field(default=Decimal("0.0"), ge=0, le=100)
    tax_amount: Decimal = Field(default=Decimal("0.0"), ge=0)
    line_total: Decimal = Field(..., ge=0)
    notes: Optional[str] = None


class SalesInvoiceItemCreate(SalesInvoiceItemBase):
    pass


class SalesInvoiceItemResponse(SalesInvoiceItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    sales_invoice_id: UUID
    line_number: int
    quantity_base_units: Decimal
    cost_per_base_unit: Decimal
    cogs_amount: Decimal
    gross_profit: Decimal
    medicine: Optional[MedicineSummary] = None
    batch: Optional[MedicineBatchSummary] = None
    sale_unit: Optional[MedicineUnitSummary] = None


class SalesInvoiceBase(BaseModel):
    customer_id: UUID
    invoice_date: date
    due_date: Optional[date] = None
    notes: Optional[str] = None
    items: List[SalesInvoiceItemCreate]


class SalesInvoiceCreate(SalesInvoiceBase):
    pass


class SalesInvoiceUpdate(BaseModel):
    customer_id: Optional[UUID] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    items: Optional[List[SalesInvoiceItemCreate]] = None


class SalesInvoicePostRequest(BaseModel):
    """Request to post a sales invoice."""
    amount_received: Decimal = Field(default=Decimal("0.0"), ge=0)
    payment_method: Optional[str] = Field(None, max_length=20)
    payment_reference: Optional[str] = Field(None, max_length=100)


class SalesInvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    invoice_number: str
    customer_id: UUID
    invoice_date: date
    due_date: Optional[date]
    status: str
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    amount_received: Decimal
    balance_amount: Decimal
    payment_status: str
    notes: Optional[str]
    printed_count: int
    last_printed_at: Optional[datetime]
    posted_at: Optional[datetime]
    posted_by: Optional[UUID]
    cancelled_at: Optional[datetime]
    cancelled_by: Optional[UUID]
    cancellation_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID]
    customer: Optional[CustomerSummary] = None


class SalesInvoiceDetailResponse(SalesInvoiceResponse):
    items: List[SalesInvoiceItemResponse]


class SalesInvoiceListResponse(BaseModel):
    items: List[SalesInvoiceResponse]
    total: int
    limit: int
    offset: int


class BatchAvailabilityResponse(BaseModel):
    """Available batch for sale allocation."""
    batch_id: UUID
    batch_number: str
    manufacturing_date: Optional[date]
    expiry_date: date
    available_quantity: float
    purchase_cost_per_unit: float
    allocated_quantity: float
    days_to_expiry: int