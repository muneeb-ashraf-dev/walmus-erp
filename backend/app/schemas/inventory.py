"""Inventory schemas."""
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from datetime import date, datetime

from app.schemas.summaries import MedicineBatchSummary, MedicineSummary


class InventorySummaryResponse(BaseModel):
    """Inventory dashboard summary."""
    total_products: int
    total_batches: int
    saleable_quantity: float
    saleable_value: float
    quarantined_quantity: float
    quarantined_value: float
    expired_quantity: float
    expired_value: float
    near_expiry_quantity: float
    near_expiry_value: float
    low_stock_count: int
    today_movements: int


class BatchDetailResponse(BaseModel):
    """Batch detail with history."""
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    medicine_id: UUID
    batch_number: str
    manufacturing_date: Optional[date]
    expiry_date: date
    supplier_id: Optional[UUID]
    purchase_invoice_id: Optional[UUID]
    received_quantity: Decimal
    available_quantity: Decimal
    purchase_cost_per_unit: Decimal
    status: str
    location: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    medicine: Optional[MedicineSummary] = None
    supplier: Optional[dict] = None
    purchase_invoice: Optional[dict] = None
    movements: List[dict] = []
    purchase_items: List[dict] = []
    sales_items: List[dict] = []


class BatchListResponse(BaseModel):
    items: List[BatchDetailResponse]
    total: int
    limit: int
    offset: int


class StockMovementResponse(BaseModel):
    """Inventory movement record."""
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    movement_date: str
    medicine_id: UUID
    batch_id: Optional[UUID]
    reason: str
    quantity_change: Decimal
    quantity_before: Decimal
    quantity_after: Decimal
    unit_cost: Optional[Decimal]
    reference_type: Optional[str]
    reference_id: Optional[UUID]
    notes: Optional[str]
    created_by: Optional[UUID]
    medicine: Optional[MedicineSummary] = None
    batch: Optional[MedicineBatchSummary] = None


class StockAdjustmentItemBase(BaseModel):
    medicine_id: UUID
    batch_id: Optional[UUID] = None
    quantity_change: Decimal = Field(..., description="Positive for increase, negative for decrease")
    unit_cost: Optional[Decimal] = None
    notes: Optional[str] = None


class StockAdjustmentCreate(BaseModel):
    adjustment_date: Optional[date] = None
    reason: str = Field(..., min_length=1)
    reference_type: Optional[str] = None
    reference_id: Optional[UUID] = None
    items: List[StockAdjustmentItemBase]
    notes: Optional[str] = None


class StockAdjustmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    adjustment_number: str
    adjustment_date: date
    reason: str
    reference_type: Optional[str]
    reference_id: Optional[UUID]
    total_items: int
    total_value_change: Decimal
    status: str
    notes: Optional[str]
    posted_at: Optional[datetime]
    posted_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID]


class ExpiringBatchResponse(BaseModel):
    """Batch expiring soon."""
    batch_id: UUID
    medicine_id: UUID
    medicine_name: str
    product_code: str
    batch_number: str
    manufacturing_date: Optional[date]
    expiry_date: date
    days_to_expiry: int
    available_quantity: float
    purchase_cost_per_unit: float
    stock_value: float
    supplier_name: Optional[str]


class ExpiredBatchResponse(BaseModel):
    """Expired batch."""
    batch_id: UUID
    medicine_id: UUID
    medicine_name: str
    product_code: str
    batch_number: str
    manufacturing_date: Optional[date]
    expiry_date: date
    days_expired: int
    available_quantity: float
    purchase_cost_per_unit: float
    stock_value: float
    supplier_name: Optional[str]