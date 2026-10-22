"""Audit and system models."""
from datetime import datetime, UTC
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    String,
    Text,
    DateTime,
    ForeignKey,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB, INET
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel


class AuditLog(BaseModel):
    """Audit trail for all important actions."""
    __tablename__ = "audit_log"
    
    event_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(UTC), 
        nullable=False,
        index=True
    )
    user_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True,
        index=True
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    old_values: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    new_values: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(INET, nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Relationships
    user: Mapped[Optional["AppUser"]] = relationship()
    
    __table_args__ = (
        Index("ix_audit_entity", "entity_type", "entity_id"),
        Index("ix_audit_user_time", "user_id", "event_time"),
    )


class ApplicationSetting(Base):
    """Application settings (key-value store)."""
    __tablename__ = "application_setting"
    
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )