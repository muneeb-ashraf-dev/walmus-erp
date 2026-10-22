"""Financial API endpoints."""
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, or_, desc, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import (
    FinancialAccount, JournalEntry, JournalEntryLine, Payment, PaymentAllocation,
    Expense, ExpenseCategory, Supplier, Customer, PurchaseInvoice, SalesInvoice
)
from app.models.enums import AccountType
from app.schemas.financial import (
    FinancialAccountCreate,
    FinancialAccountUpdate,
    FinancialAccountResponse,
    JournalEntryResponse,
    PaymentCreate,
    PaymentResponse,
    ExpenseCategoryCreate,
    ExpenseCategoryUpdate,
    ExpenseCategoryResponse,
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseResponse,
    CashBankBalanceResponse,
    ReceivablesAgingResponse,
    PayablesAgingResponse,
    ReconciliationResponse,
)
from app.core.exceptions import NotFoundError, ValidationError as AppValidationError

router = APIRouter()


# ===========================================
# Financial Accounts
# ===========================================

@router.post("/accounts", response_model=FinancialAccountResponse, status_code=201)
async def create_financial_account(
    data: FinancialAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Create a financial account."""
    # Check duplicate code
    result = await db.execute(select(FinancialAccount).where(FinancialAccount.code == data.code))
    if result.scalar_one_or_none():
        raise AppValidationError(f"Account code '{data.code}' already exists")
    
    account = FinancialAccount(**data.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return FinancialAccountResponse.model_validate(account)


@router.get("/accounts", response_model=List[FinancialAccountResponse])
async def list_financial_accounts(
    account_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List financial accounts."""
    query = select(FinancialAccount)
    
    if account_type:
        query = query.where(FinancialAccount.account_type == account_type)
    if is_active is not None:
        query = query.where(FinancialAccount.is_active == is_active)
    
    query = query.order_by(FinancialAccount.code)
    result = await db.execute(query)
    return [FinancialAccountResponse.model_validate(a) for a in result.scalars().all()]


@router.get("/accounts/{account_id}", response_model=FinancialAccountResponse)
async def get_financial_account(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get financial account by ID."""
    result = await db.execute(select(FinancialAccount).where(FinancialAccount.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise NotFoundError("Financial Account", str(account_id))
    return FinancialAccountResponse.model_validate(account)


@router.patch("/accounts/{account_id}", response_model=FinancialAccountResponse)
async def update_financial_account(
    account_id: UUID,
    data: FinancialAccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Update financial account."""
    result = await db.execute(select(FinancialAccount).where(FinancialAccount.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise NotFoundError("Financial Account", str(account_id))
    
    if data.code and data.code != account.code:
        existing = await db.execute(select(FinancialAccount).where(FinancialAccount.code == data.code))
        if existing.scalar_one_or_none():
            raise AppValidationError(f"Account code '{data.code}' already exists")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    
    await db.commit()
    await db.refresh(account)
    return FinancialAccountResponse.model_validate(account)


@router.get("/cash-bank-balance", response_model=CashBankBalanceResponse)
async def get_cash_bank_balance(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get current cash and bank balances."""
    result = await db.execute(
        select(FinancialAccount).where(FinancialAccount.code.in_(["CASH", "BANK"]))
    )
    accounts = result.scalars().all()
    
    cash = next((a for a in accounts if a.code == "CASH"), None)
    bank = next((a for a in accounts if a.code == "BANK"), None)
    
    async def calc_balance(account_id: UUID) -> float:
        res = await db.execute(
            select(
                FinancialAccount.opening_balance + func.coalesce(func.sum(
                    case((JournalEntryLine.entry_type == "debit", JournalEntryLine.amount), else_=-JournalEntryLine.amount)
                ), 0)
            )
            .select_from(FinancialAccount)
            .outerjoin(JournalEntryLine, JournalEntryLine.account_id == FinancialAccount.id)
            .outerjoin(JournalEntry, and_(JournalEntry.id == JournalEntryLine.journal_entry_id, JournalEntry.status == "posted"))
            .where(FinancialAccount.id == account_id)
            .group_by(FinancialAccount.id, FinancialAccount.opening_balance)
        )
        return float(res.scalar() or 0)
    
    cash_balance = await calc_balance(cash.id) if cash else 0.0
    bank_balance = await calc_balance(bank.id) if bank else 0.0
    
    return CashBankBalanceResponse(
        cash_balance=cash_balance,
        bank_balance=bank_balance,
        total=cash_balance + bank_balance,
        cash_account=cash.name if cash else "Cash",
        bank_account=bank.name if bank else "Bank",
    )


# ===========================================
# Journal Entries
# ===========================================

@router.get("/journal-entries", response_model=List[JournalEntryResponse])
async def list_journal_entries(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    reference_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List journal entries."""
    query = select(JournalEntry).options(selectinload(JournalEntry.lines).selectinload(JournalEntryLine.account))
    
    if date_from:
        query = query.where(JournalEntry.entry_date >= date_from)
    if date_to:
        query = query.where(JournalEntry.entry_date <= date_to)
    if reference_type:
        query = query.where(JournalEntry.reference_type == reference_type)
    
    query = query.order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return [JournalEntryResponse.model_validate(je) for je in result.scalars().all()]


# ===========================================
# Payments
# ===========================================

@router.post("/payments", response_model=PaymentResponse, status_code=201)
async def create_payment(
    data: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Create a payment (customer receipt or supplier payment)."""
    # Validate account
    account_result = await db.execute(select(FinancialAccount).where(FinancialAccount.id == data.account_id))
    account = account_result.scalar_one_or_none()
    if not account:
        raise NotFoundError("Financial Account", str(data.account_id))
    
    # Validate party
    if data.party_type == "customer":
        party_result = await db.execute(select(Customer).where(Customer.id == data.party_id))
        if not party_result.scalar_one_or_none():
            raise NotFoundError("Customer", str(data.party_id))
    elif data.party_type == "supplier":
        party_result = await db.execute(select(Supplier).where(Supplier.id == data.party_id))
        if not party_result.scalar_one_or_none():
            raise NotFoundError("Supplier", str(data.party_id))
    else:
        raise AppValidationError("party_type must be 'customer' or 'supplier'")
    
    # Generate payment number
    from app.core.config import settings
    fy = date.today().year if date.today().month >= settings.financial_year_start_month else date.today().year - 1
    from app.models import NumberSequence
    seq_result = await db.execute(
        select(NumberSequence).where(
            and_(NumberSequence.prefix == "PAY", NumberSequence.financial_year == fy)
        )
    )
    seq = seq_result.scalar_one_or_none()
    if seq:
        seq.current_sequence += 1
    else:
        seq = NumberSequence(prefix="PAY", current_sequence=1, financial_year=fy)
        db.add(seq)
    await db.flush()
    
    pay_number = seq.format_template.replace("{PREFIX}", "PAY").replace("{YEAR}", str(fy)).replace("{SEQ:06d}", str(seq.current_sequence).zfill(6))
    
    # Create payment
    payment = Payment(
        payment_number=pay_number,
        payment_date=data.payment_date or date.today(),
        account_id=data.account_id,
        party_type=data.party_type,
        party_id=data.party_id,
        payment_method=data.payment_method,
        amount=data.amount,
        reference_number=data.reference_number,
        status="posted",
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(payment)
    await db.flush()
    
    # Create allocations
    remaining = float(data.amount)
    for alloc in data.allocations:
        alloc_amount = min(float(alloc.allocated_amount), remaining)
        if alloc_amount <= 0:
            break
        
        payment_alloc = PaymentAllocation(
            payment_id=payment.id,
            invoice_type=alloc.invoice_type,
            invoice_id=alloc.invoice_id,
            allocated_amount=alloc_amount,
        )
        db.add(payment_alloc)
        remaining -= alloc_amount
        
        # Update invoice balance
        if alloc.invoice_type == "sales":
            inv_result = await db.execute(select(SalesInvoice).where(SalesInvoice.id == alloc.invoice_id))
            inv = inv_result.scalar_one_or_none()
            if inv:
                inv.amount_received = float(inv.amount_received) + alloc_amount
                inv.balance_amount = float(inv.total_amount) - float(inv.amount_received)
                if inv.balance_amount <= 0:
                    inv.payment_status = "paid"
                    inv.balance_amount = 0
                else:
                    inv.payment_status = "partial"
        elif alloc.invoice_type == "purchase":
            inv_result = await db.execute(select(PurchaseInvoice).where(PurchaseInvoice.id == alloc.invoice_id))
            inv = inv_result.scalar_one_or_none()
            if inv:
                inv.amount_paid = float(inv.amount_paid) + alloc_amount
                inv.balance_amount = float(inv.total_amount) - float(inv.amount_paid)
                if inv.balance_amount <= 0:
                    inv.payment_status = "paid"
                    inv.balance_amount = 0
                else:
                    inv.payment_status = "partial"
    
    # Create journal entry
    from app.core.config import settings as app_settings
    fy_start = app_settings.financial_year_start_month
    
    def get_fy(d: date) -> int:
        return d.year if d.month >= fy_start else d.year - 1
    
    je = JournalEntry(
        entry_number=pay_number.replace("PAY", "JE"),
        entry_date=payment.payment_date,
        reference_type="payment",
        reference_id=payment.id,
        description=f"Payment {pay_number}",
        total_debit=0,
        total_credit=0,
        status="posted",
        created_by=current_user.id,
    )
    db.add(je)
    await db.flush()
    
    line_num = 1
    total_debit = 0
    total_credit = 0
    
    if data.party_type == "customer":
        # Customer payment: Debit Cash/Bank, Credit Receivable
        je_line = JournalEntryLine(
            journal_entry_id=je.id,
            account_id=data.account_id,
            line_number=line_num,
            entry_type="debit",
            amount=data.amount,
            description=f"Payment received from customer",
        )
        db.add(je_line)
        total_debit += float(data.amount)
        line_num += 1
        
        receivable_account = await db.execute(select(FinancialAccount).where(FinancialAccount.code == "RECEIVABLE"))
        receivable = receivable_account.scalar_one()
        je_line = JournalEntryLine(
            journal_entry_id=je.id,
            account_id=receivable.id,
            line_number=line_num,
            entry_type="credit",
            amount=data.amount,
            description=f"Payment from customer",
            party_type="customer",
            party_id=data.party_id,
        )
        db.add(je_line)
        total_credit += float(data.amount)
    else:
        # Supplier payment: Debit Payable, Credit Cash/Bank
        payable_account = await db.execute(select(FinancialAccount).where(FinancialAccount.code == "PAYABLE"))
        payable = payable_account.scalar_one()
        je_line = JournalEntryLine(
            journal_entry_id=je.id,
            account_id=payable.id,
            line_number=line_num,
            entry_type="debit",
            amount=data.amount,
            description=f"Payment to supplier",
            party_type="supplier",
            party_id=data.party_id,
        )
        db.add(je_line)
        total_debit += float(data.amount)
        line_num += 1
        
        je_line = JournalEntryLine(
            journal_entry_id=je.id,
            account_id=data.account_id,
            line_number=line_num,
            entry_type="credit",
            amount=data.amount,
            description=f"Payment to supplier",
        )
        db.add(je_line)
        total_credit += float(data.amount)
    
    je.total_debit = total_debit
    je.total_credit = total_credit
    
    await db.commit()
    result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.account), selectinload(Payment.allocations))
        .where(Payment.id == payment.id)
    )
    return PaymentResponse.model_validate(result.scalar_one())


@router.get("/payments", response_model=List[PaymentResponse])
async def list_payments(
    party_type: Optional[str] = Query(None),
    party_id: Optional[UUID] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List payments."""
    query = select(Payment).options(
        selectinload(Payment.account),
        selectinload(Payment.allocations),
    )
    
    if party_type:
        query = query.where(Payment.party_type == party_type)
    if party_id:
        query = query.where(Payment.party_id == party_id)
    if date_from:
        query = query.where(Payment.payment_date >= date_from)
    if date_to:
        query = query.where(Payment.payment_date <= date_to)
    
    query = query.order_by(Payment.payment_date.desc(), Payment.id.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return [PaymentResponse.model_validate(p) for p in result.scalars().all()]


# ===========================================
# Expense Categories
# ===========================================

@router.post("/expense-categories", response_model=ExpenseCategoryResponse, status_code=201)
async def create_expense_category(
    data: ExpenseCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Create expense category."""
    result = await db.execute(select(ExpenseCategory).where(ExpenseCategory.code == data.code))
    if result.scalar_one_or_none():
        raise AppValidationError(f"Expense category code '{data.code}' already exists")
    
    category = ExpenseCategory(**data.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return ExpenseCategoryResponse.model_validate(category)


@router.get("/expense-categories", response_model=List[ExpenseCategoryResponse])
async def list_expense_categories(
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List expense categories."""
    query = select(ExpenseCategory).order_by(ExpenseCategory.sort_order, ExpenseCategory.code)
    if is_active is not None:
        query = query.where(ExpenseCategory.is_active == is_active)
    result = await db.execute(query)
    return [ExpenseCategoryResponse.model_validate(c) for c in result.scalars().all()]


# ===========================================
# Expenses
# ===========================================

@router.post("/expenses", response_model=ExpenseResponse, status_code=201)
async def create_expense(
    data: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Create an expense."""
    # Validate category
    cat_result = await db.execute(select(ExpenseCategory).where(ExpenseCategory.id == data.category_id))
    if not cat_result.scalar_one_or_none():
        raise NotFoundError("Expense Category", str(data.category_id))
    
    # Validate account
    acc_result = await db.execute(select(FinancialAccount).where(FinancialAccount.id == data.account_id))
    if not acc_result.scalar_one_or_none():
        raise NotFoundError("Financial Account", str(data.account_id))
    
    # Validate medicine if provided
    if data.medicine_id:
        med_result = await db.execute(select(Medicine).where(Medicine.id == data.medicine_id))
        if not med_result.scalar_one_or_none():
            raise NotFoundError("Medicine", str(data.medicine_id))
    
    # Generate expense number
    from app.core.config import settings
    fy = date.today().year if date.today().month >= settings.financial_year_start_month else date.today().year - 1
    from app.models import NumberSequence
    seq_result = await db.execute(
        select(NumberSequence).where(
            and_(NumberSequence.prefix == "EXP", NumberSequence.financial_year == fy)
        )
    )
    seq = seq_result.scalar_one_or_none()
    if seq:
        seq.current_sequence += 1
    else:
        seq = NumberSequence(prefix="EXP", current_sequence=1, financial_year=fy)
        db.add(seq)
    await db.flush()
    
    exp_number = seq.format_template.replace("{PREFIX}", "EXP").replace("{YEAR}", str(fy)).replace("{SEQ:06d}", str(seq.current_sequence).zfill(6))
    
    # Create expense
    expense = Expense(
        expense_number=exp_number,
        expense_date=data.expense_date,
        category_id=data.category_id,
        account_id=data.account_id,
        amount=data.amount,
        tax_amount=data.tax_amount or 0,
        description=data.description,
        reference_number=data.reference_number,
        attachment_path=data.attachment_path,
        status="posted",
        medicine_id=data.medicine_id,
        created_by=current_user.id,
    )
    db.add(expense)
    await db.flush()
    
    # Create journal entry
    je = JournalEntry(
        entry_number=exp_number.replace("EXP", "JE"),
        entry_date=data.expense_date,
        reference_type="expense",
        reference_id=expense.id,
        description=f"Expense {exp_number}: {data.description}",
        total_debit=0,
        total_credit=0,
        status="posted",
        created_by=current_user.id,
    )
    db.add(je)
    await db.flush()
    
    line_num = 1
    total_debit = 0
    total_credit = 0
    
    # Look up expense account
    expense_acc_res = await db.execute(
        select(FinancialAccount).where(FinancialAccount.code == "EXPENSE")
    )
    expense_acc = expense_acc_res.scalar_one_or_none()
    if not expense_acc:
        expense_acc_res = await db.execute(
            select(FinancialAccount).where(FinancialAccount.account_type == "expense")
        )
        expense_acc = expense_acc_res.scalar_one_or_none()
    expense_account_id = expense_acc.id if expense_acc else data.account_id

    # Debit expense
    je_line = JournalEntryLine(
        journal_entry_id=je.id,
        account_id=expense_account_id,
        line_number=line_num,
        entry_type="debit",
        amount=expense.amount,
        description=f"Expense: {data.description}",
    )
    db.add(je_line)
    total_debit += float(expense.amount)
    line_num += 1
    
    # Credit cash/bank
    je_line = JournalEntryLine(
        journal_entry_id=je.id,
        account_id=data.account_id,
        line_number=line_num,
        entry_type="credit",
        amount=expense.amount + expense.tax_amount,
        description=f"Payment for expense {exp_number}",
    )
    db.add(je_line)
    total_credit += float(expense.amount + expense.tax_amount)
    
    if expense.tax_amount > 0:
        # Tax payable
        tax_account = await db.execute(select(FinancialAccount).where(FinancialAccount.code == "TAX_PAYABLE"))
        tax_acc = tax_account.scalar_one()
        je_line = JournalEntryLine(
            journal_entry_id=je.id,
            account_id=tax_acc.id,
            line_number=line_num + 1,
            entry_type="debit",
            amount=expense.tax_amount,
            description=f"Input tax on expense {exp_number}",
        )
        db.add(je_line)
        total_debit += float(expense.tax_amount)
    
    je.total_debit = total_debit
    je.total_credit = total_credit
    
    await db.commit()
    result = await db.execute(
        select(Expense)
        .options(
            selectinload(Expense.category),
            selectinload(Expense.account),
            selectinload(Expense.medicine),
        )
        .where(Expense.id == expense.id)
    )
    return ExpenseResponse.model_validate(result.scalar_one())


@router.get("/expenses", response_model=List[ExpenseResponse])
async def list_expenses(
    category_id: Optional[UUID] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    medicine_id: Optional[UUID] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List expenses."""
    query = select(Expense).options(
        selectinload(Expense.category),
        selectinload(Expense.account),
        selectinload(Expense.medicine),
    )
    
    if category_id:
        query = query.where(Expense.category_id == category_id)
    if date_from:
        query = query.where(Expense.expense_date >= date_from)
    if date_to:
        query = query.where(Expense.expense_date <= date_to)
    if medicine_id:
        query = query.where(Expense.medicine_id == medicine_id)
    
    query = query.order_by(Expense.expense_date.desc(), Expense.id.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return [ExpenseResponse.model_validate(e) for e in result.scalars().all()]


# ===========================================
# Receivables/Payables Aging
# ===========================================

@router.get("/receivables-aging", response_model=ReceivablesAgingResponse)
async def get_receivables_aging(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get customer receivables aging report."""
    today = date.today()
    
    result = await db.execute(
        select(
            Customer.id,
            Customer.name,
            Customer.customer_type,
            Customer.credit_limit,
            func.coalesce(func.sum(
                case((SalesInvoice.balance_amount > 0, SalesInvoice.balance_amount), else_=0)
            ), 0).label("total_outstanding"),
        )
        .select_from(Customer)
        .outerjoin(SalesInvoice, and_(
            SalesInvoice.customer_id == Customer.id,
            SalesInvoice.status == InvoiceStatus.POSTED.value
        ))
        .where(Customer.is_active == True)
        .group_by(Customer.id, Customer.name, Customer.customer_type, Customer.credit_limit)
    )
    
    customers = []
    total_outstanding = 0
    for row in result:
        # Get aging buckets
        aging_result = await db.execute(
            select(
                func.coalesce(func.sum(
                    case((and_(SalesInvoice.balance_amount > 0, SalesInvoice.due_date >= today), SalesInvoice.balance_amount), else_=0)
                ), 0).label("current"),
                func.coalesce(func.sum(
                    case((and_(SalesInvoice.balance_amount > 0, SalesInvoice.due_date < today, SalesInvoice.due_date >= today - timedelta(days=30)), SalesInvoice.balance_amount), else_=0)
                ), 0).label("days_1_30"),
                func.coalesce(func.sum(
                    case((and_(SalesInvoice.balance_amount > 0, SalesInvoice.due_date < today - timedelta(days=30), SalesInvoice.due_date >= today - timedelta(days=60)), SalesInvoice.balance_amount), else_=0)
                ), 0).label("days_31_60"),
                func.coalesce(func.sum(
                    case((and_(SalesInvoice.balance_amount > 0, SalesInvoice.due_date < today - timedelta(days=60), SalesInvoice.due_date >= today - timedelta(days=90)), SalesInvoice.balance_amount), else_=0)
                ), 0).label("days_61_90"),
                func.coalesce(func.sum(
                    case((and_(SalesInvoice.balance_amount > 0, SalesInvoice.due_date < today - timedelta(days=90)), SalesInvoice.balance_amount), else_=0)
                ), 0).label("over_90"),
            )
            .where(
                and_(
                    SalesInvoice.customer_id == row.id,
                    SalesInvoice.status == InvoiceStatus.POSTED.value,
                )
            )
        )
        aging = aging_result.first()
        
        cust_data = {
            "customer_id": str(row.id),
            "name": row.name,
            "customer_type": row.customer_type,
            "credit_limit": float(row.credit_limit),
            "total_outstanding": float(row.total_outstanding or 0),
            "current": float(aging.current or 0),
            "days_1_30": float(aging.days_1_30 or 0),
            "days_31_60": float(aging.days_31_60 or 0),
            "days_61_90": float(aging.days_61_90 or 0),
            "over_90": float(aging.over_90 or 0),
        }
        customers.append(cust_data)
        total_outstanding += float(row.total_outstanding or 0)
    
    return ReceivablesAgingResponse(
        customers=customers,
        total_outstanding=total_outstanding,
    )


@router.get("/payables-aging", response_model=PayablesAgingResponse)
async def get_payables_aging(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get supplier payables aging report."""
    today = date.today()
    
    result = await db.execute(
        select(
            Supplier.id,
            Supplier.name,
            func.coalesce(func.sum(
                case((PurchaseInvoice.balance_amount > 0, PurchaseInvoice.balance_amount), else_=0)
            ), 0).label("total_payable"),
        )
        .select_from(Supplier)
        .outerjoin(PurchaseInvoice, and_(
            PurchaseInvoice.supplier_id == Supplier.id,
            PurchaseInvoice.status == InvoiceStatus.POSTED.value
        ))
        .where(Supplier.is_active == True)
        .group_by(Supplier.id, Supplier.name)
    )
    
    suppliers = []
    total_payable = 0
    for row in result:
        aging_result = await db.execute(
            select(
                func.coalesce(func.sum(
                    case((and_(PurchaseInvoice.balance_amount > 0, PurchaseInvoice.due_date >= today), PurchaseInvoice.balance_amount), else_=0)
                ), 0).label("current"),
                func.coalesce(func.sum(
                    case((and_(PurchaseInvoice.balance_amount > 0, PurchaseInvoice.due_date < today, PurchaseInvoice.due_date >= today - timedelta(days=30)), PurchaseInvoice.balance_amount), else_=0)
                ), 0).label("days_1_30"),
                func.coalesce(func.sum(
                    case((and_(PurchaseInvoice.balance_amount > 0, PurchaseInvoice.due_date < today - timedelta(days=30), PurchaseInvoice.due_date >= today - timedelta(days=60)), PurchaseInvoice.balance_amount), else_=0)
                ), 0).label("days_31_60"),
                func.coalesce(func.sum(
                    case((and_(PurchaseInvoice.balance_amount > 0, PurchaseInvoice.due_date < today - timedelta(days=60), PurchaseInvoice.due_date >= today - timedelta(days=90)), PurchaseInvoice.balance_amount), else_=0)
                ), 0).label("days_61_90"),
                func.coalesce(func.sum(
                    case((and_(PurchaseInvoice.balance_amount > 0, PurchaseInvoice.due_date < today - timedelta(days=90)), PurchaseInvoice.balance_amount), else_=0)
                ), 0).label("over_90"),
            )
            .where(
                and_(
                    PurchaseInvoice.supplier_id == row.id,
                    PurchaseInvoice.status == InvoiceStatus.POSTED.value,
                )
            )
        )
        aging = aging_result.first()
        
        supp_data = {
            "supplier_id": str(row.id),
            "name": row.name,
            "total_payable": float(row.total_payable or 0),
            "current": float(aging.current or 0),
            "days_1_30": float(aging.days_1_30 or 0),
            "days_31_60": float(aging.days_31_60 or 0),
            "days_61_90": float(aging.days_61_90 or 0),
            "over_90": float(aging.over_90 or 0),
        }
        suppliers.append(supp_data)
        total_payable += float(row.total_payable or 0)
    
    return PayablesAgingResponse(
        suppliers=suppliers,
        total_payable=total_payable,
    )


# ===========================================
# Reconciliation
# ===========================================

@router.get("/reconciliation", response_model=ReconciliationResponse)
async def get_reconciliation(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get reconciliation report."""
    discrepancies = []
    
    # 1. Customer ledger vs Receivable control
    receivable_account = await db.execute(select(FinancialAccount).where(FinancialAccount.code == "RECEIVABLE"))
    receivable_acc = receivable_account.scalar_one_or_none()
    
    if receivable_acc:
        # Calculate control account balance
        control_balance_result = await db.execute(
            select(
                receivable_acc.opening_balance + func.coalesce(func.sum(
                    case((JournalEntryLine.entry_type == "credit", JournalEntryLine.amount), else_=-JournalEntryLine.amount)
                ), 0)
            )
            .select_from(FinancialAccount)
            .outerjoin(JournalEntryLine, JournalEntryLine.account_id == FinancialAccount.id)
            .outerjoin(JournalEntry, and_(JournalEntry.id == JournalEntryLine.journal_entry_id, JournalEntry.status == "posted"))
            .where(FinancialAccount.id == receivable_acc.id)
        )
        control_balance = float(control_balance_result.scalar() or 0)
        
        # Calculate sub-ledger total
        subledger_result = await db.execute(
            select(func.coalesce(func.sum(SalesInvoice.balance_amount), 0))
            .where(
                and_(
                    SalesInvoice.status == InvoiceStatus.POSTED.value,
                    SalesInvoice.balance_amount > 0,
                )
            )
        )
        subledger_total = float(subledger_result.scalar() or 0)
        
        diff = control_balance - subledger_total
        if abs(diff) > 0.01:
            discrepancies.append({
                "account": "RECEIVABLE",
                "control_balance": control_balance,
                "subledger_total": subledger_total,
                "difference": diff,
            })
    
    # 2. Supplier ledger vs Payable control
    payable_account = await db.execute(select(FinancialAccount).where(FinancialAccount.code == "PAYABLE"))
    payable_acc = payable_account.scalar_one_or_none()
    
    if payable_acc:
        control_balance_result = await db.execute(
            select(
                payable_acc.opening_balance + func.coalesce(func.sum(
                    case((JournalEntryLine.entry_type == "credit", JournalEntryLine.amount), else_=-JournalEntryLine.amount)
                ), 0)
            )
            .select_from(FinancialAccount)
            .outerjoin(JournalEntryLine, JournalEntryLine.account_id == FinancialAccount.id)
            .outerjoin(JournalEntry, and_(JournalEntry.id == JournalEntryLine.journal_entry_id, JournalEntry.status == "posted"))
            .where(FinancialAccount.id == payable_acc.id)
        )
        control_balance = float(control_balance_result.scalar() or 0)
        
        subledger_result = await db.execute(
            select(func.coalesce(func.sum(PurchaseInvoice.balance_amount), 0))
            .where(
                and_(
                    PurchaseInvoice.status == InvoiceStatus.POSTED.value,
                    PurchaseInvoice.balance_amount > 0,
                )
            )
        )
        subledger_total = float(subledger_result.scalar() or 0)
        
        diff = control_balance - subledger_total
        if abs(diff) > 0.01:
            discrepancies.append({
                "account": "PAYABLE",
                "control_balance": control_balance,
                "subledger_total": subledger_total,
                "difference": diff,
            })
    
    # 3. Inventory valuation vs Inventory account
    inventory_account = await db.execute(select(FinancialAccount).where(FinancialAccount.code == "INVENTORY"))
    inventory_acc = inventory_account.scalar_one_or_none()
    
    if inventory_acc:
        control_balance_result = await db.execute(
            select(
                inventory_acc.opening_balance + func.coalesce(func.sum(
                    case((JournalEntryLine.entry_type == "credit", JournalEntryLine.amount), else_=-JournalEntryLine.amount)
                ), 0)
            )
            .select_from(FinancialAccount)
            .outerjoin(JournalEntryLine, JournalEntryLine.account_id == FinancialAccount.id)
            .outerjoin(JournalEntry, and_(JournalEntry.id == JournalEntryLine.journal_entry_id, JournalEntry.status == "posted"))
            .where(FinancialAccount.id == inventory_acc.id)
        )
        control_balance = float(control_balance_result.scalar() or 0)
        
        # Physical inventory value (WAC)
        phys_result = await db.execute(
            select(func.coalesce(func.sum(MedicineBatch.available_quantity * MedicineBatch.purchase_cost_per_unit), 0))
            .where(
                and_(
                    MedicineBatch.status == BatchStatus.ACTIVE.value,
                    MedicineBatch.available_quantity > 0,
                )
            )
        )
        physical_value = float(phys_result.scalar() or 0)
        
        diff = control_balance - physical_value
        if abs(diff) > 0.01:
            discrepancies.append({
                "account": "INVENTORY",
                "control_balance": control_balance,
                "physical_value": physical_value,
                "difference": diff,
            })
    
    return ReconciliationResponse(
        discrepancies=discrepancies,
        is_balanced=len(discrepancies) == 0,
    )


from sqlalchemy import case
from datetime import timedelta
from app.models import MedicineBatch, Medicine
from app.models.enums import BatchStatus, InvoiceStatus