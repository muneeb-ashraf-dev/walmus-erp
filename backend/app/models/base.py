"""Base model with common fields."""
from datetime import datetime, UTC
from uuid import uuid4

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, declared_attr


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


class BaseModel(Base):
    """Base model with UUID primary key and timestamps."""
    
    __abstract__ = True
    
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


class SoftDeleteMixin:
    """Mixin for soft delete support."""
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    
    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None
    
    def soft_delete(self) -> None:
        self.deleted_at = datetime.now(UTC)