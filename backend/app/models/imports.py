"""Import tracking and historical Excel data models."""
from typing import Optional

from sqlalchemy import (
    String,
    Text,
    Integer,
    Numeric,
    JSON,
    ForeignKey,
    UniqueConstraint,
    Index,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from uuid import UUID

from app.models.base import BaseModel


class ImportBatch(BaseModel):
    """One execution of an Excel/CSV import."""

    __tablename__ = "import_batch"

    source_file: Mapped[str] = mapped_column(String(500), nullable=False)
    source_sheet: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    import_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="completed", nullable=False)
    rows_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_imported: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_skipped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    summary: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("app_user.id", ondelete="SET NULL"),
        nullable=True,
    )

    sales_history: Mapped[list["ImportedSalesHistory"]] = relationship(
        back_populates="import_batch", cascade="all, delete-orphan"
    )
    month_summaries: Mapped[list["ImportedMonthSummary"]] = relationship(
        back_populates="import_batch", cascade="all, delete-orphan"
    )
    customer_performance: Mapped[list["ImportedCustomerPerformance"]] = relationship(
        back_populates="import_batch", cascade="all, delete-orphan"
    )


class ImportedSalesHistory(BaseModel):
    """Product-level historical sales imported from the workbook.

    These are performance records, not sales invoices. They never affect stock
    or receivables.
    """

    __tablename__ = "imported_sales_history"

    import_batch_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("import_batch.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    period_year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)
    product_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    product_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    quantity_sold: Mapped[float] = mapped_column(Numeric(18, 4), default=0, nullable=False)
    sale_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    purchase_quantity: Mapped[float] = mapped_column(Numeric(18, 4), default=0, nullable=False)
    purchase_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    profit_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    balance_quantity: Mapped[float] = mapped_column(Numeric(18, 4), default=0, nullable=False)
    source_row: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    import_batch: Mapped["ImportBatch"] = relationship(back_populates="sales_history")

    __table_args__ = (
        UniqueConstraint(
            "period_year", "period_month", "product_name",
            name="uq_imported_sales_month_product",
        ),
        CheckConstraint("period_month >= 1 AND period_month <= 12", name="ck_ish_month_range"),
        Index("ix_imported_sales_period", "period_year", "period_month"),
    )


class ImportedMonthSummary(BaseModel):
    """Monthly totals from the workbook ledger."""

    __tablename__ = "imported_month_summary"

    import_batch_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("import_batch.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    period_year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)
    total_sales: Mapped[float] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    total_purchase: Mapped[float] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    total_purchase_out: Mapped[float] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    total_profit: Mapped[float] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    total_discount: Mapped[float] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    total_expense: Mapped[float] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    closing_balance_units: Mapped[float] = mapped_column(Numeric(18, 4), default=0, nullable=False)

    import_batch: Mapped["ImportBatch"] = relationship(back_populates="month_summaries")

    __table_args__ = (
        UniqueConstraint("period_year", "period_month", name="uq_imported_month_summary"),
        CheckConstraint("period_month >= 1 AND period_month <= 12", name="ck_ims_month_range"),
    )


class ImportedCustomerPerformance(BaseModel):
    """Doctor/customer monthly sales performance imported from the ROI/OLX sheets."""

    __tablename__ = "imported_customer_performance"

    import_batch_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("import_batch.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("customer.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    period_year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)
    actual_sales: Mapped[float] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    source: Mapped[str] = mapped_column(String(30), default="roi", nullable=False)
    source_row: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    import_batch: Mapped["ImportBatch"] = relationship(back_populates="customer_performance")

    __table_args__ = (
        UniqueConstraint(
            "customer_name", "period_year", "period_month", "source",
            name="uq_imported_customer_perf",
        ),
        CheckConstraint("period_month >= 1 AND period_month <= 12", name="ck_icp_month_range"),
        Index("ix_imported_customer_period", "period_year", "period_month"),
    )
