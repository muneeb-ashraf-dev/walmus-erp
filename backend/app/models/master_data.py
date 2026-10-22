"""Master data models: Manufacturer, Medicine Unit, Medicine, Supplier, Customer, Doctor Investment."""
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
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import EntityType, InvestmentStatus


class Manufacturer(BaseModel):
    """Medicine manufacturer."""
    __tablename__ = "manufacturer"
    
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tax_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Relationships
    medicines: Mapped[List["Medicine"]] = relationship(back_populates="manufacturer")


class MedicineUnit(BaseModel):
    """Unit of measure for medicines."""
    __tablename__ = "medicine_unit"
    
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    is_base_unit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Relationships
    medicines_base: Mapped[List["Medicine"]] = relationship(
        "Medicine", 
        foreign_keys="Medicine.base_unit_id",
        back_populates="base_unit"
    )
    medicines_purchase: Mapped[List["Medicine"]] = relationship(
        "Medicine", 
        foreign_keys="Medicine.purchase_unit_id",
        back_populates="purchase_unit"
    )
    medicines_sale: Mapped[List["Medicine"]] = relationship(
        "Medicine", 
        foreign_keys="Medicine.sale_unit_id",
        back_populates="sale_unit"
    )


class Medicine(BaseModel):
    """Medicine/Product master."""
    __tablename__ = "medicine"
    
    product_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    barcode: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    generic_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, index=True)
    manufacturer_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("manufacturer.id", ondelete="SET NULL"), 
        nullable=True
    )
    strength: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    dosage_form: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    packing_description: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    
    # Units
    base_unit_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine_unit.id", ondelete="RESTRICT"), 
        nullable=False
    )
    units_per_pack: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    purchase_unit_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine_unit.id", ondelete="SET NULL"), 
        nullable=True
    )
    purchase_conversion_factor: Mapped[float] = mapped_column(Numeric(18, 4), default=1.0, nullable=False)
    sale_unit_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine_unit.id", ondelete="SET NULL"), 
        nullable=True
    )
    sale_conversion_factor: Mapped[float] = mapped_column(Numeric(18, 4), default=1.0, nullable=False)
    
    # Pricing
    default_purchase_rate: Mapped[float] = mapped_column(Numeric(18, 4), default=0.0, nullable=False)
    default_sale_rate: Mapped[float] = mapped_column(Numeric(18, 4), default=0.0, nullable=False)
    wholesale_rate: Mapped[Optional[float]] = mapped_column(Numeric(18, 4), nullable=True)
    retail_rate: Mapped[Optional[float]] = mapped_column(Numeric(18, 4), nullable=True)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0, nullable=False)
    
    # Inventory thresholds
    reorder_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    min_stock_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Audit
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    # Relationships
    manufacturer: Mapped[Optional["Manufacturer"]] = relationship(back_populates="medicines")
    base_unit: Mapped["MedicineUnit"] = relationship(
        "MedicineUnit", 
        foreign_keys=[base_unit_id], 
        back_populates="medicines_base"
    )
    purchase_unit: Mapped[Optional["MedicineUnit"]] = relationship(
        "MedicineUnit", 
        foreign_keys=[purchase_unit_id], 
        back_populates="medicines_purchase"
    )
    sale_unit: Mapped[Optional["MedicineUnit"]] = relationship(
        "MedicineUnit", 
        foreign_keys=[sale_unit_id], 
        back_populates="medicines_sale"
    )
    batches: Mapped[List["MedicineBatch"]] = relationship(back_populates="medicine")
    
    __table_args__ = (
        CheckConstraint("units_per_pack > 0", name="ck_medicine_units_per_pack_positive"),
        CheckConstraint("purchase_conversion_factor > 0", name="ck_medicine_purchase_conv_positive"),
        CheckConstraint("sale_conversion_factor > 0", name="ck_medicine_sale_conv_positive"),
        Index("ix_medicine_name_active", "name", postgresql_where=is_active == True),
    )


class Supplier(BaseModel):
    """Supplier/Distributor master."""
    __tablename__ = "supplier"
    
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tax_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    credit_limit: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    payment_terms_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    opening_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    opening_balance_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    # Relationships
    purchase_invoices: Mapped[List["PurchaseInvoice"]] = relationship(back_populates="supplier")
    batches: Mapped[List["MedicineBatch"]] = relationship(back_populates="supplier")


class Customer(BaseModel):
    """Customer/Doctor master."""
    __tablename__ = "customer"
    
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tax_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    customer_type: Mapped[str] = mapped_column(String(20), default="pharmacy", nullable=False)
    specialty: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    area: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    credit_limit: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    payment_terms_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    opening_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    opening_balance_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    default_sale_rate_type: Mapped[str] = mapped_column(String(20), default="retail", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    # Relationships
    sales_invoices: Mapped[List["SalesInvoice"]] = relationship(back_populates="customer")
    investments: Mapped[List["DoctorInvestment"]] = relationship(back_populates="customer", cascade="all, delete-orphan")


class DoctorInvestment(BaseModel):
    """Doctor investment / ROI tracking."""
    __tablename__ = "doctor_investment"
    
    customer_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("customer.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    investment_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    investment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    roi_percentage: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    # expected_sale = investment_amount / (roi_percentage / 100)
    expected_sale: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), 
        default=InvestmentStatus.ACTIVE.value, 
        nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    # Relationships
    customer: Mapped["Customer"] = relationship(back_populates="investments")
    transactions: Mapped[List["InvestmentTransaction"]] = relationship(back_populates="investment", cascade="all, delete-orphan")
    
    __table_args__ = (
        CheckConstraint("investment_amount >= 0", name="ck_investment_amount_nonneg"),
        CheckConstraint("roi_percentage > 0", name="ck_investment_roi_positive"),
    )


class InvestmentTransaction(BaseModel):
    """Transactions against doctor investments (disbursements, recoveries)."""
    __tablename__ = "investment_transaction"
    
    investment_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("doctor_investment.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    transaction_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    payment_method: Mapped[str] = mapped_column(String(30), default="cash", nullable=False)
    account_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("financial_account.id", ondelete="SET NULL"), 
        nullable=True
    )
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    investment: Mapped["DoctorInvestment"] = relationship(back_populates="transactions")
    
    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_investment_tx_amount_nonneg"),
    )


class SalesTarget(BaseModel):
    """Monthly expected sales target for a doctor or customer."""
    __tablename__ = "sales_target"
    
    customer_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("customer.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    target_year: Mapped[int] = mapped_column(Integer, nullable=False)
    target_month: Mapped[int] = mapped_column(Integer, nullable=False)
    target_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    customer: Mapped["Customer"] = relationship()
    
    __table_args__ = (
        UniqueConstraint("customer_id", "target_year", "target_month", name="uq_customer_target_month"),
        CheckConstraint("target_month >= 1 AND target_month <= 12", name="ck_target_month_range"),
        CheckConstraint("target_amount >= 0", name="ck_target_amount_nonneg"),
    )


class SalesAttribution(BaseModel):
    """Attribution of sales invoice to a doctor/business contact."""
    __tablename__ = "sales_attribution"
    
    sales_invoice_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("sales_invoice.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    customer_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("customer.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    attributed_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    customer: Mapped["Customer"] = relationship()
    
    __table_args__ = (
        CheckConstraint("attributed_amount >= 0", name="ck_sales_attribution_amount_nonneg"),
    )