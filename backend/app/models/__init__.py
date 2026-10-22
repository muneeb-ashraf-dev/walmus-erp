"""Models package initialization - exports all models."""
from app.models.base import Base, BaseModel, SoftDeleteMixin
from app.models.enums import (
    InvoiceStatus,
    PaymentStatus,
    PaymentMethod,
    MovementReason,
    BatchStatus,
    AccountType,
    EntityType,
    InvestmentStatus,
    JournalEntryStatus,
)
from app.models.owner import OwnerSettings, AppUser
from app.models.master_data import (
    Manufacturer,
    MedicineUnit,
    Medicine,
    Supplier,
    Customer,
    DoctorInvestment,
    InvestmentTransaction,
    SalesTarget,
    SalesAttribution,
)
from app.models.inventory import (
    MedicineBatch,
    PurchaseInvoice,
    PurchaseInvoiceItem,
    SalesInvoice,
    SalesInvoiceItem,
    PurchaseReturn,
    PurchaseReturnItem,
    SalesReturn,
    SalesReturnItem,
    InventoryMovement,
    StockAdjustment,
    StockAdjustmentItem,
)
from app.models.financial import (
    FinancialAccount,
    JournalEntry,
    JournalEntryLine,
    Payment,
    PaymentAllocation,
    ExpenseCategory,
    Expense,
    OpeningBalance,
    OpeningBalanceItem,
    NumberSequence,
)
from app.models.audit import AuditLog, ApplicationSetting
from app.models.imports import (
    ImportBatch,
    ImportedSalesHistory,
    ImportedMonthSummary,
    ImportedCustomerPerformance,
)

# Ensure all models are imported for Base.metadata
__all__ = [
    # Base
    "Base",
    "BaseModel",
    "SoftDeleteMixin",
    # Enums
    "InvoiceStatus",
    "PaymentStatus",
    "PaymentMethod",
    "MovementReason",
    "BatchStatus",
    "AccountType",
    "EntityType",
    "InvestmentStatus",
    "JournalEntryStatus",
    # Owner
    "OwnerSettings",
    "AppUser",
    # Master Data
    "Manufacturer",
    "MedicineUnit",
    "Medicine",
    "Supplier",
    "Customer",
    "DoctorInvestment",
    "InvestmentTransaction",
    "SalesTarget",
    "SalesAttribution",
    # Inventory
    "MedicineBatch",
    "PurchaseInvoice",
    "PurchaseInvoiceItem",
    "SalesInvoice",
    "SalesInvoiceItem",
    "PurchaseReturn",
    "PurchaseReturnItem",
    "SalesReturn",
    "SalesReturnItem",
    "InventoryMovement",
    "StockAdjustment",
    "StockAdjustmentItem",
    # Financial
    "FinancialAccount",
    "JournalEntry",
    "JournalEntryLine",
    "Payment",
    "PaymentAllocation",
    "ExpenseCategory",
    "Expense",
    "OpeningBalance",
    "OpeningBalanceItem",
    "NumberSequence",
    # Audit
    "AuditLog",
    "ApplicationSetting",
    # Imports
    "ImportBatch",
    "ImportedSalesHistory",
    "ImportedMonthSummary",
    "ImportedCustomerPerformance",
]