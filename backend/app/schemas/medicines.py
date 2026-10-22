"""Medicines schemas."""
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


# ===========================================
# Manufacturer Schemas
# ===========================================

class ManufacturerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    contact_person: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    tax_number: Optional[str] = Field(None, max_length=50)
    is_active: bool = True


class ManufacturerCreate(ManufacturerBase):
    pass


class ManufacturerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    contact_person: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    tax_number: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class ManufacturerResponse(ManufacturerBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime


# ===========================================
# Medicine Unit Schemas
# ===========================================

class MedicineUnitBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=20, pattern="^[A-Z0-9_]+$")
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=200)
    is_base_unit: bool = False
    sort_order: int = 0


class MedicineUnitCreate(MedicineUnitBase):
    pass


class MedicineUnitUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20, pattern="^[A-Z0-9_]+$")
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=200)
    is_base_unit: Optional[bool] = None
    sort_order: Optional[int] = None


class MedicineUnitResponse(MedicineUnitBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime


# ===========================================
# Medicine Schemas
# ===========================================

class MedicineBase(BaseModel):
    product_code: str = Field(..., min_length=1, max_length=50, pattern="^[A-Z0-9_-]+$")
    barcode: Optional[str] = Field(None, max_length=100)
    name: str = Field(..., min_length=1, max_length=200)
    generic_name: Optional[str] = Field(None, max_length=200)
    manufacturer_id: Optional[UUID] = None
    strength: Optional[str] = Field(None, max_length=100)
    dosage_form: Optional[str] = Field(None, max_length=50)
    packing_description: Optional[str] = Field(None, max_length=200)
    base_unit_id: UUID
    units_per_pack: int = Field(default=1, ge=1)
    purchase_unit_id: Optional[UUID] = None
    purchase_conversion_factor: Decimal = Field(default=Decimal("1.0"), ge=Decimal("0.0001"))
    sale_unit_id: Optional[UUID] = None
    sale_conversion_factor: Decimal = Field(default=Decimal("1.0"), ge=Decimal("0.0001"))
    default_purchase_rate: Decimal = Field(default=Decimal("0.0"), ge=0)
    default_sale_rate: Decimal = Field(default=Decimal("0.0"), ge=0)
    wholesale_rate: Optional[Decimal] = Field(None, ge=0)
    retail_rate: Optional[Decimal] = Field(None, ge=0)
    tax_rate: Decimal = Field(default=Decimal("0.0"), ge=0, le=100)
    reorder_level: int = Field(default=0, ge=0)
    min_stock_qty: int = Field(default=0, ge=0)
    is_active: bool = True
    notes: Optional[str] = None


class MedicineCreate(MedicineBase):
    pass


class MedicineUpdate(BaseModel):
    product_code: Optional[str] = Field(None, min_length=1, max_length=50, pattern="^[A-Z0-9_-]+$")
    barcode: Optional[str] = Field(None, max_length=100)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    generic_name: Optional[str] = Field(None, max_length=200)
    manufacturer_id: Optional[UUID] = None
    strength: Optional[str] = Field(None, max_length=100)
    dosage_form: Optional[str] = Field(None, max_length=50)
    packing_description: Optional[str] = Field(None, max_length=200)
    base_unit_id: Optional[UUID] = None
    units_per_pack: Optional[int] = Field(None, ge=1)
    purchase_unit_id: Optional[UUID] = None
    purchase_conversion_factor: Optional[Decimal] = Field(None, ge=Decimal("0.0001"))
    sale_unit_id: Optional[UUID] = None
    sale_conversion_factor: Optional[Decimal] = Field(None, ge=Decimal("0.0001"))
    default_purchase_rate: Optional[Decimal] = Field(None, ge=0)
    default_sale_rate: Optional[Decimal] = Field(None, ge=0)
    wholesale_rate: Optional[Decimal] = Field(None, ge=0)
    retail_rate: Optional[Decimal] = Field(None, ge=0)
    tax_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    reorder_level: Optional[int] = Field(None, ge=0)
    min_stock_qty: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class MedicineResponse(MedicineBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None
    # Related objects
    manufacturer: Optional[ManufacturerResponse] = None
    base_unit: Optional[MedicineUnitResponse] = None
    purchase_unit: Optional[MedicineUnitResponse] = None
    sale_unit: Optional[MedicineUnitResponse] = None


class MedicineListResponse(BaseModel):
    items: List[MedicineResponse]
    total: int
    limit: int
    offset: int