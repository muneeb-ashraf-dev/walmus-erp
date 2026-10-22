"""Financial schemas."""
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from datetime import date, datetime

from app.schemas.summaries import MedicineSummary


class FinancialAccountBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=20, pattern="^[A-Z0-9_]+$")
    name: str = Field(..., min_length=1, max_length=100)
    account_type: str = Field(..., max_length=20)
    currency: str = Field(default="PKR", pattern="^[A-Z]{3}$")
    opening_balance: Decimal = Field(default=Decimal("0.0"))
    opening_balance_date: Optional[date] = None
    is_active: bool = True
    description: Optional[str] = None


class FinancialAccountCreate(FinancialAccountBase):
    pass


class FinancialAccountUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20, pattern="^[A-Z0-9_]+$")
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    account_type: Optional[str] = Field(None, max_length=20)
    currency: Optional[str] = Field(None, pattern="^[A-Z]{3}$")
    opening_balance: Optional[Decimal] = None
    opening_balance_date: Optional[date] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None


class FinancialAccountResponse(FinancialAccountBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime


class JournalEntryLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    account_id: UUID
    line_number: int
    entry_type: str
    amount: Decimal
    description: Optional[str]
    party_type: Optional[str]
    party_id: Optional[UUID]
    account: Optional[FinancialAccountResponse] = None


class JournalEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    entry_number: str
    entry_date: date
    reference_type: Optional[str]
    reference_id: Optional[UUID]
    description: Optional[str]
    total_debit: Decimal
    total_credit: Decimal
    status: str
    created_at: datetime
    lines: List[JournalEntryLineResponse] = []


class PaymentAllocationCreate(BaseModel):
    invoice_type: str = Field(..., pattern="^(sales|purchase)$")
    invoice_id: UUID
    allocated_amount: Decimal = Field(..., gt=0)


class PaymentCreate(BaseModel):
    payment_date: Optional[date] = None
    account_id: UUID
    party_type: str = Field(..., pattern="^(customer|supplier)$")
    party_id: UUID
    payment_method: str = Field(..., max_length=20)
    amount: Decimal = Field(..., gt=0)
    reference_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    allocations: List[PaymentAllocationCreate] = []


class PaymentAllocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    invoice_type: str
    invoice_id: UUID
    allocated_amount: Decimal


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    payment_number: str
    payment_date: date
    account_id: UUID
    party_type: str
    party_id: UUID
    payment_method: str
    amount: Decimal
    reference_number: Optional[str]
    status: str
    notes: Optional[str]
    created_at: datetime
    allocations: List[PaymentAllocationResponse] = []
    account: Optional[FinancialAccountResponse] = None


class ExpenseCategoryBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=20, pattern="^[A-Z0-9_]+$")
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0


class ExpenseCategoryCreate(ExpenseCategoryBase):
    pass


class ExpenseCategoryUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20, pattern="^[A-Z0-9_]+$")
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class ExpenseCategoryResponse(ExpenseCategoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime


class ExpenseBase(BaseModel):
    expense_date: date
    category_id: UUID
    account_id: UUID
    amount: Decimal = Field(..., gt=0)
    tax_amount: Decimal = Field(default=Decimal("0.0"), ge=0)
    description: Optional[str] = None
    reference_number: Optional[str] = Field(None, max_length=100)
    attachment_path: Optional[str] = Field(None, max_length=500)
    medicine_id: Optional[UUID] = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    expense_date: Optional[date] = None
    category_id: Optional[UUID] = None
    account_id: Optional[UUID] = None
    amount: Optional[Decimal] = Field(None, gt=0)
    tax_amount: Optional[Decimal] = Field(None, ge=0)
    description: Optional[str] = None
    reference_number: Optional[str] = Field(None, max_length=100)
    attachment_path: Optional[str] = Field(None, max_length=500)
    medicine_id: Optional[UUID] = None


class ExpenseResponse(ExpenseBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    expense_number: str
    status: str
    created_at: datetime
    created_by: Optional[UUID]
    category: Optional[ExpenseCategoryResponse] = None
    account: Optional[FinancialAccountResponse] = None
    medicine: Optional[MedicineSummary] = None


class CashBankBalanceResponse(BaseModel):
    cash_balance: float
    bank_balance: float
    total: float
    cash_account: str
    bank_account: str


class AgingCustomer(BaseModel):
    customer_id: str
    name: str
    customer_type: str
    credit_limit: float
    total_outstanding: float
    current: float
    days_1_30: float
    days_31_60: float
    days_61_90: float
    over_90: float


class ReceivablesAgingResponse(BaseModel):
    customers: List[AgingCustomer]
    total_outstanding: float


class AgingSupplier(BaseModel):
    supplier_id: str
    name: str
    total_payable: float
    current: float
    days_1_30: float
    days_31_60: float
    days_61_90: float
    over_90: float


class PayablesAgingResponse(BaseModel):
    suppliers: List[AgingSupplier]
    total_payable: float


class ReconciliationDiscrepancy(BaseModel):
    account: str
    control_balance: Optional[float] = None
    subledger_total: Optional[float] = None
    physical_value: Optional[float] = None
    difference: float


class ReconciliationResponse(BaseModel):
    discrepancies: List[ReconciliationDiscrepancy]
    is_balanced: bool