"""Settings schemas."""
from typing import Optional, Dict, Any, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from datetime import date, datetime


class OwnerSettingsBase(BaseModel):
    business_name: str = Field(..., min_length=1, max_length=200)
    business_address: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    tax_number: Optional[str] = Field(None, max_length=50)
    currency: str = Field(default="PKR", pattern="^[A-Z]{3}$")
    invoice_prefix: str = Field(default="INV", max_length=20)
    purchase_prefix: str = Field(default="PUR", max_length=20)
    invoice_number_format: str = Field(default="{PREFIX}-{YEAR}-{SEQ:06d}", max_length=50)
    purchase_number_format: str = Field(default="{PREFIX}-{YEAR}-{SEQ:06d}", max_length=50)
    financial_year_start_month: int = Field(default=7, ge=1, le=12)
    default_payment_terms_days: int = Field(default=30, ge=0)
    expiry_alert_days: list[int] = Field(default=[90, 60, 30, 7])
    default_tax_rate: Decimal = Field(default=Decimal("0.0"), ge=0, le=100)
    opening_cash_balance: Decimal = Field(default=Decimal("0.0"), ge=0)
    opening_bank_balance: Decimal = Field(default=Decimal("0.0"), ge=0)


class OwnerSettingsUpdate(BaseModel):
    business_name: Optional[str] = Field(None, min_length=1, max_length=200)
    business_address: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    tax_number: Optional[str] = Field(None, max_length=50)
    currency: Optional[str] = Field(None, pattern="^[A-Z]{3}$")
    invoice_prefix: Optional[str] = Field(None, max_length=20)
    purchase_prefix: Optional[str] = Field(None, max_length=20)
    invoice_number_format: Optional[str] = Field(None, max_length=50)
    purchase_number_format: Optional[str] = Field(None, max_length=50)
    financial_year_start_month: Optional[int] = Field(None, ge=1, le=12)
    default_payment_terms_days: Optional[int] = Field(None, ge=0)
    expiry_alert_days: Optional[list[int]] = None
    default_tax_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    opening_cash_balance: Optional[Decimal] = Field(None, ge=0)
    opening_bank_balance: Optional[Decimal] = Field(None, ge=0)


class OwnerSettingsResponse(OwnerSettingsBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=100)


class UserPasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str


class AppSettingBase(BaseModel):
    key: str = Field(..., min_length=1, max_length=100)
    value: Dict[str, Any]
    description: Optional[str] = None


class AppSettingUpdate(BaseModel):
    value: Dict[str, Any]
    description: Optional[str] = None


class AppSettingResponse(AppSettingBase):
    model_config = ConfigDict(from_attributes=True)
    updated_at: datetime
    updated_by: Optional[UUID]