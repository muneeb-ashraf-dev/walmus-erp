"""Customers schemas."""
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class CustomerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    contact_person: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    tax_number: Optional[str] = Field(None, max_length=50)
    customer_type: str = Field(default="pharmacy", max_length=20)
    specialty: Optional[str] = Field(None, max_length=50)
    area: Optional[str] = Field(None, max_length=100)
    credit_limit: Decimal = Field(default=Decimal("0.0"), ge=0)
    payment_terms_days: int = Field(default=30, ge=0)
    opening_balance: Decimal = Field(default=Decimal("0.0"))
    opening_balance_date: Optional[str] = None
    default_sale_rate_type: str = Field(default="retail", max_length=20)
    is_active: bool = True
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    contact_person: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    tax_number: Optional[str] = Field(None, max_length=50)
    customer_type: Optional[str] = Field(None, max_length=20)
    specialty: Optional[str] = Field(None, max_length=50)
    area: Optional[str] = Field(None, max_length=100)
    credit_limit: Optional[Decimal] = Field(None, ge=0)
    payment_terms_days: Optional[int] = Field(None, ge=0)
    opening_balance: Optional[Decimal] = None
    opening_balance_date: Optional[str] = None
    default_sale_rate_type: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class CustomerResponse(CustomerBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None


class CustomerListResponse(BaseModel):
    items: List[CustomerResponse]
    total: int
    limit: int
    offset: int


class CustomerDetailResponse(CustomerResponse):
    outstanding_balance: float
    overdue_amount: float
    recent_sales: List[dict]
    investments: List[dict]


# ===========================================
# Doctor Investment Schemas
# ===========================================

class DoctorInvestmentBase(BaseModel):
    investment_amount: Decimal = Field(..., gt=0)
    investment_date: date
    roi_percentage: Decimal = Field(..., gt=0, le=100)
    status: str = Field(default="active", max_length=20)
    notes: Optional[str] = None


class DoctorInvestmentCreate(DoctorInvestmentBase):
    pass


class DoctorInvestmentUpdate(BaseModel):
    investment_amount: Optional[Decimal] = Field(None, gt=0)
    investment_date: Optional[date] = None
    roi_percentage: Optional[Decimal] = Field(None, gt=0, le=100)
    status: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None


class DoctorInvestmentResponse(DoctorInvestmentBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    customer_id: UUID
    expected_sale: Decimal
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None