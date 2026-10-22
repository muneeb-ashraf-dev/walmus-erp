"""Owner settings and user models."""
from datetime import datetime, UTC
from typing import Optional, List
from uuid import UUID

from sqlalchemy import (
    String,
    Text,
    Integer,
    Boolean,
    DateTime,
    ARRAY,
    Numeric,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import InvoiceStatus


class OwnerSettings(BaseModel):
    """Singleton table for business settings."""
    __tablename__ = "owner_settings"
    
    business_name: Mapped[str] = mapped_column(String(200), nullable=False)
    business_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tax_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="PKR", nullable=False)
    invoice_prefix: Mapped[str] = mapped_column(String(20), default="INV", nullable=False)
    purchase_prefix: Mapped[str] = mapped_column(String(20), default="PUR", nullable=False)
    invoice_number_format: Mapped[str] = mapped_column(
        String(50), 
        default="{PREFIX}-{YEAR}-{SEQ:06d}", 
        nullable=False
    )
    purchase_number_format: Mapped[str] = mapped_column(
        String(50), 
        default="{PREFIX}-{YEAR}-{SEQ:06d}", 
        nullable=False
    )
    financial_year_start_month: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    default_payment_terms_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    expiry_alert_days: Mapped[List[int]] = mapped_column(
        ARRAY(Integer), 
        default=[90, 60, 30, 7], 
        nullable=False
    )
    default_tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0.00, nullable=False)
    opening_cash_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0.00, nullable=False)
    opening_bank_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0.00, nullable=False)
    
    # Singleton enforcement - only one row allowed
    __table_args__ = (
        UniqueConstraint("id", name="uq_owner_settings_singleton"),
    )


class AppUser(BaseModel):
    """Application user (owner only)."""
    __tablename__ = "app_user"
    
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)