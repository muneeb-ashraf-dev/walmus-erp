"""Financial models: Accounts, Journal Entries, Payments, Expenses."""
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
    Enum as SQLEnum,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import AccountType, PaymentMethod


class FinancialAccount(BaseModel):
    """Chart of accounts."""
    __tablename__ = "financial_account"
    
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    account_type: Mapped[str] = mapped_column(String(20), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="PKR", nullable=False)
    opening_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    opening_balance_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Relationships
    journal_lines: Mapped[List["JournalEntryLine"]] = relationship(back_populates="account")


class JournalEntry(BaseModel):
    """Double-entry journal entry."""
    __tablename__ = "journal_entry"
    
    entry_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    total_debit: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    total_credit: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="posted", nullable=False)
    reversed_entry_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("journal_entry.id", ondelete="SET NULL"), 
        nullable=True
    )
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    # Relationships
    lines: Mapped[List["JournalEntryLine"]] = relationship(back_populates="entry", cascade="all, delete-orphan")
    reversed_entry: Mapped[Optional["JournalEntry"]] = relationship(remote_side="JournalEntry.id")
    
    __table_args__ = (
        CheckConstraint("total_debit = total_credit", name="ck_journal_balanced"),
        Index("ix_je_date_ref", "entry_date", "reference_type", "reference_id"),
    )


class JournalEntryLine(BaseModel):
    """Journal entry line (debit/credit)."""
    __tablename__ = "journal_entry_line"
    
    journal_entry_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("journal_entry.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    account_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("financial_account.id", ondelete="RESTRICT"), 
        nullable=False,
        index=True
    )
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    entry_type: Mapped[str] = mapped_column(String(6), nullable=False)  # "debit" or "credit"
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    party_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    party_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    
    # Relationships
    entry: Mapped["JournalEntry"] = relationship(back_populates="lines")
    account: Mapped["FinancialAccount"] = relationship(back_populates="journal_lines")
    
    __table_args__ = (
        UniqueConstraint("journal_entry_id", "line_number", name="uq_jel_line"),
        CheckConstraint("entry_type IN ('debit', 'credit')", name="ck_jel_entry_type"),
        CheckConstraint("amount > 0", name="ck_jel_amount_positive"),
        Index("ix_jel_party", "party_type", "party_id"),
    )


class Payment(BaseModel):
    """Payment (customer receipt or supplier payment)."""
    __tablename__ = "payment"
    
    payment_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    payment_date: Mapped[date] = mapped_column(Date, default=lambda: datetime.now(UTC).date(), nullable=False, index=True)
    account_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("financial_account.id", ondelete="RESTRICT"), 
        nullable=False
    )
    party_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "customer" or "supplier"
    party_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="posted", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Optional link to purchase invoice for supplier payments
    purchase_invoice_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("purchase_invoice.id", ondelete="SET NULL"), 
        nullable=True
    )
    # Optional link to sales invoice for customer receipts
    sales_invoice_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("sales_invoice.id", ondelete="SET NULL"), 
        nullable=True
    )
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    # Relationships
    account: Mapped["FinancialAccount"] = relationship()
    purchase_invoice: Mapped[Optional["PurchaseInvoice"]] = relationship(back_populates="payments")
    sales_invoice: Mapped[Optional["SalesInvoice"]] = relationship(back_populates="payments")
    allocations: Mapped[List["PaymentAllocation"]] = relationship(back_populates="payment", cascade="all, delete-orphan")
    
    __table_args__ = (
        CheckConstraint("party_type IN ('customer', 'supplier')", name="ck_payment_party_type"),
        CheckConstraint("amount > 0", name="ck_payment_amount_positive"),
        Index("ix_payment_party", "party_type", "party_id"),
        Index("ix_payment_date_party", "payment_date", "party_type", "party_id"),
        Index("ix_payment_purchase_invoice", "purchase_invoice_id"),
        Index("ix_payment_sales_invoice", "sales_invoice_id"),
    )


class PaymentAllocation(BaseModel):
    """Payment allocation to invoices."""
    __tablename__ = "payment_allocation"
    
    payment_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("payment.id", ondelete="CASCADE"), 
        nullable=False
    )
    invoice_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "sales" or "purchase"
    invoice_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    allocated_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    
    # Relationships
    payment: Mapped["Payment"] = relationship(back_populates="allocations")
    
    __table_args__ = (
        CheckConstraint("invoice_type IN ('sales', 'purchase')", name="ck_alloc_invoice_type"),
        CheckConstraint("allocated_amount > 0", name="ck_alloc_amount_positive"),
    )


class ExpenseCategory(BaseModel):
    """Expense category."""
    __tablename__ = "expense_category"
    
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Relationships
    expenses: Mapped[List["Expense"]] = relationship(back_populates="category")


class Expense(BaseModel):
    """Business expense."""
    __tablename__ = "expense"
    
    expense_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    category_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("expense_category.id", ondelete="RESTRICT"), 
        nullable=False,
        index=True
    )
    account_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("financial_account.id", ondelete="RESTRICT"), 
        nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    attachment_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="posted", nullable=False)
    # Optional link to medicine for product-level expense tracking
    medicine_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("medicine.id", ondelete="SET NULL"), 
        nullable=True,
        index=True
    )
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    # Relationships
    category: Mapped["ExpenseCategory"] = relationship(back_populates="expenses")
    account: Mapped["FinancialAccount"] = relationship()
    medicine: Mapped[Optional["Medicine"]] = relationship()
    
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_expense_amount_positive"),
        Index("ix_expense_date_category", "expense_date", "category_id"),
    )


class OpeningBalance(BaseModel):
    """Opening balances for financial year."""
    __tablename__ = "opening_balance"
    
    balance_date: Mapped[date] = mapped_column(Date, unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    posted_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("app_user.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    # Relationships
    items: Mapped[List["OpeningBalanceItem"]] = relationship(back_populates="opening_balance", cascade="all, delete-orphan")


class OpeningBalanceItem(BaseModel):
    """Opening balance line item."""
    __tablename__ = "opening_balance_item"
    
    opening_balance_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        ForeignKey("opening_balance.id", ondelete="CASCADE"), 
        nullable=False
    )
    item_type: Mapped[str] = mapped_column(String(20), nullable=False)
    reference_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    quantity: Mapped[Optional[float]] = mapped_column(Numeric(18, 4), nullable=True)
    unit_cost: Mapped[Optional[float]] = mapped_column(Numeric(18, 4), nullable=True)
    amount: Mapped[Optional[float]] = mapped_column(Numeric(18, 2), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Relationships
    opening_balance: Mapped["OpeningBalance"] = relationship(back_populates="items")
    
    __table_args__ = (
        CheckConstraint(
            "item_type IN ('medicine_batch', 'supplier', 'customer', 'cash', 'bank', 'expense_category')",
            name="ck_ob_item_type"
        ),
    )


class NumberSequence(BaseModel):
    """Number sequence for document numbering."""
    __tablename__ = "number_sequence"
    
    prefix: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    current_sequence: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    financial_year: Mapped[int] = mapped_column(Integer, nullable=False)
    format_template: Mapped[str] = mapped_column(String(100), default="{PREFIX}-{YEAR}-{SEQ:06d}", nullable=False)
    
    __table_args__ = (
        UniqueConstraint("prefix", "financial_year", name="uq_number_sequence"),
    )