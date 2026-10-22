"""Compact nested schemas used inside invoice and transaction responses.

These deliberately expose only scalar fields. Loading a full related model
inside an async response can trigger lazy IO outside SQLAlchemy's greenlet
context, and most list/detail screens only need the identifying labels.
"""
from typing import Optional
from uuid import UUID
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class MedicineSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_code: str
    name: str
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    dosage_form: Optional[str] = None
    packing_description: Optional[str] = None


class MedicineBatchSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    batch_number: str
    expiry_date: date
    available_quantity: Decimal
    purchase_cost_per_unit: Decimal
    status: str


class MedicineUnitSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str


class CustomerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_number: Optional[str] = None
    customer_type: str


class SupplierSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    tax_number: Optional[str] = None


class PurchaseInvoiceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    voucher_number: str
    invoice_date: date
