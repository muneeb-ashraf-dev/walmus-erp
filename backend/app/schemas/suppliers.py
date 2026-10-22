"""Suppliers schemas."""
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class SupplierBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    contact_person: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    tax_number: Optional[str] = Field(None, max_length=50)
    credit_limit: Decimal = Field(default=Decimal("0.0"), ge=0)
    payment_terms_days: int = Field(default=30, ge=0)
    opening_balance: Decimal = Field(default=Decimal("0.0"))
    opening_balance_date: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    contact_person: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    tax_number: Optional[str] = Field(None, max_length=50)
    credit_limit: Optional[Decimal] = Field(None, ge=0)
    payment_terms_days: Optional[int] = Field(None, ge=0)
    opening_balance: Optional[Decimal] = None
    opening_balance_date: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class SupplierResponse(SupplierBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None


class SupplierListResponse(BaseModel):
    items: List[SupplierResponse]
    total: int
    limit: int
    offset: int


class SupplierDetailResponse(SupplierResponse):
    outstanding_balance: float
    overdue_amount: float
    recent_purchases: List[dict]