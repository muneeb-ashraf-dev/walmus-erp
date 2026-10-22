"""Database enum definitions."""
import enum


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    POSTED = "posted"
    CANCELLED = "cancelled"
    PARTIALLY_RETURNED = "partially_returned"
    FULLY_RETURNED = "fully_returned"


class PaymentStatus(str, enum.Enum):
    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"
    OVERDUE = "overdue"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    CHEQUE = "cheque"
    CARD = "card"
    UPI = "upi"
    OTHER = "other"


class MovementReason(str, enum.Enum):
    PURCHASE = "purchase"
    PURCHASE_RETURN = "purchase_return"
    SALE = "sale"
    SALE_RETURN = "sale_return"
    ADJUSTMENT_IN = "adjustment_in"
    ADJUSTMENT_OUT = "adjustment_out"
    EXPIRED_WRITEOFF = "expired_writeoff"
    DAMAGED_WRITEOFF = "damaged_writeoff"
    OPENING_STOCK = "opening_stock"
    TRANSFER_IN = "transfer_in"
    TRANSFER_OUT = "transfer_out"


class BatchStatus(str, enum.Enum):
    ACTIVE = "active"
    QUARANTINED = "quarantined"
    EXPIRED = "expired"
    DEPLETED = "depleted"


class AccountType(str, enum.Enum):
    CASH = "cash"
    BANK = "bank"
    RECEIVABLE = "receivable"
    PAYABLE = "payable"
    EXPENSE = "expense"
    REVENUE = "revenue"
    COGS = "cogs"
    EQUITY = "equity"
    ASSET = "asset"


class EntityType(str, enum.Enum):
    CUSTOMER = "customer"
    DOCTOR = "doctor"
    SUPPLIER = "supplier"
    DISTRIBUTOR = "distributor"


class InvestmentStatus(str, enum.Enum):
    ACTIVE = "active"
    RECOVERED = "recovered"
    WRITTEN_OFF = "written_off"


class JournalEntryStatus(str, enum.Enum):
    DRAFT = "draft"
    POSTED = "posted"
    REVERSED = "reversed"