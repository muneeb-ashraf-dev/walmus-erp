"""Reports API endpoints."""
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select, func, and_, or_, desc, case, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import (
    Medicine, MedicineBatch, Supplier, Customer, PurchaseInvoice, PurchaseInvoiceItem,
    SalesInvoice, SalesInvoiceItem, Expense, ExpenseCategory, FinancialAccount,
    JournalEntry, JournalEntryLine, DoctorInvestment, InventoryMovement,
    ImportedMonthSummary, ImportedCustomerPerformance
)
from app.models.enums import InvoiceStatus, BatchStatus, PaymentStatus
from app.schemas.reports import (
    SalesReportResponse,
    PurchaseReportResponse,
    ProfitReportResponse,
    InventoryValuationResponse,
    ExpiryReportResponse,
    DoctorInvestmentReportResponse,
    MonthlySummaryResponse,
    ExportRequest,
)
from app.core.exceptions import NotFoundError
from app.services.excel_import_export import workbook_bytes, csv_bytes

router = APIRouter()


# ===========================================
# Sales Reports
# ===========================================

@router.get("/sales", response_model=SalesReportResponse)
async def get_sales_report(
    date_from: date = Query(...),
    date_to: date = Query(...),
    customer_id: Optional[UUID] = Query(None),
    medicine_id: Optional[UUID] = Query(None),
    group_by: str = Query("day", pattern="^(day|month|year)$"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get sales report with filters."""
    _group_expr = text(f"'{group_by}'")
    query = select(
        func.date_trunc(_group_expr, SalesInvoice.invoice_date).label('period'),
        func.count(SalesInvoice.id).label('invoice_count'),
        func.coalesce(func.sum(SalesInvoice.total_amount), 0).label('total_sales'),
        func.coalesce(func.sum(SalesInvoice.discount_amount), 0).label('total_discount'),
        func.coalesce(func.sum(SalesInvoice.tax_amount), 0).label('total_tax'),
    ).where(
        and_(
            SalesInvoice.status == InvoiceStatus.POSTED.value,
            SalesInvoice.invoice_date >= date_from,
            SalesInvoice.invoice_date <= date_to,
        )
    )
    
    if customer_id:
        query = query.where(SalesInvoice.customer_id == customer_id)
    
    query = query.group_by(func.date_trunc(_group_expr, SalesInvoice.invoice_date))
    query = query.order_by(func.date_trunc(_group_expr, SalesInvoice.invoice_date))
    
    result = await db.execute(query)
    periods = []
    for row in result:
        periods.append({
            "period": row.period,
            "invoice_count": row.invoice_count,
            "total_sales": float(row.total_sales),
            "total_discount": float(row.total_discount),
            "total_tax": float(row.total_tax),
            "net_sales": float(row.total_sales) - float(row.total_discount),
        })
    
    # Totals
    totals_result = await db.execute(
        select(
            func.count(SalesInvoice.id),
            func.coalesce(func.sum(SalesInvoice.total_amount), 0),
            func.coalesce(func.sum(SalesInvoice.discount_amount), 0),
            func.coalesce(func.sum(SalesInvoice.tax_amount), 0),
        ).where(
            and_(
                SalesInvoice.status == InvoiceStatus.POSTED.value,
                SalesInvoice.invoice_date >= date_from,
                SalesInvoice.invoice_date <= date_to,
            )
        )
    )
    totals = totals_result.first()
    
    return SalesReportResponse(
        date_from=date_from,
        date_to=date_to,
        group_by=group_by,
        periods=periods,
        total_invoices=totals[0] or 0,
        total_sales=float(totals[1] or 0),
        total_discount=float(totals[2] or 0),
        total_tax=float(totals[3] or 0),
    )


@router.get("/sales/by-medicine")
async def get_sales_by_medicine(
    date_from: date = Query(...),
    date_to: date = Query(...),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get sales grouped by medicine."""
    result = await db.execute(
        select(
            Medicine.id,
            Medicine.product_code,
            Medicine.name,
            Medicine.generic_name,
            func.coalesce(func.sum(SalesInvoiceItem.quantity_base_units), 0).label('units_sold'),
            func.coalesce(func.sum(SalesInvoiceItem.line_total), 0).label('revenue'),
            func.coalesce(func.sum(SalesInvoiceItem.cogs_amount), 0).label('cogs'),
            func.coalesce(func.sum(SalesInvoiceItem.gross_profit), 0).label('gross_profit'),
        )
        .join(SalesInvoiceItem, SalesInvoiceItem.medicine_id == Medicine.id)
        .join(SalesInvoice, and_(
            SalesInvoice.id == SalesInvoiceItem.sales_invoice_id,
            SalesInvoice.status == InvoiceStatus.POSTED.value,
            SalesInvoice.invoice_date >= date_from,
            SalesInvoice.invoice_date <= date_to,
        ))
        .group_by(Medicine.id, Medicine.product_code, Medicine.name, Medicine.generic_name)
        .order_by(func.coalesce(func.sum(SalesInvoiceItem.line_total), 0).desc())
        .limit(limit)
    )
    
    return [
        {
            "medicine_id": str(row.id),
            "product_code": row.product_code,
            "name": row.name,
            "generic_name": row.generic_name,
            "units_sold": float(row.units_sold),
            "revenue": float(row.revenue),
            "cogs": float(row.cogs),
            "gross_profit": float(row.gross_profit),
            "margin_pct": round((float(row.gross_profit) / float(row.revenue) * 100) if float(row.revenue) > 0 else 0, 2),
        }
        for row in result
    ]


@router.get("/sales/by-customer")
async def get_sales_by_customer(
    date_from: date = Query(...),
    date_to: date = Query(...),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get sales grouped by customer."""
    result = await db.execute(
        select(
            Customer.id,
            Customer.name,
            Customer.customer_type,
            Customer.area,
            func.count(SalesInvoice.id).label('invoice_count'),
            func.coalesce(func.sum(SalesInvoice.total_amount), 0).label('total_sales'),
            func.coalesce(func.sum(SalesInvoice.balance_amount), 0).label('outstanding'),
        )
        .join(SalesInvoice, and_(
            SalesInvoice.customer_id == Customer.id,
            SalesInvoice.status == InvoiceStatus.POSTED.value,
            SalesInvoice.invoice_date >= date_from,
            SalesInvoice.invoice_date <= date_to,
        ))
        .group_by(Customer.id, Customer.name, Customer.customer_type, Customer.area)
        .order_by(func.coalesce(func.sum(SalesInvoice.total_amount), 0).desc())
        .limit(limit)
    )
    
    return [
        {
            "customer_id": str(row.id),
            "name": row.name,
            "customer_type": row.customer_type,
            "area": row.area,
            "invoice_count": row.invoice_count,
            "total_sales": float(row.total_sales),
            "outstanding": float(row.outstanding),
        }
        for row in result
    ]


# ===========================================
# Purchase Reports
# ===========================================

@router.get("/purchases", response_model=PurchaseReportResponse)
async def get_purchase_report(
    date_from: date = Query(...),
    date_to: date = Query(...),
    supplier_id: Optional[UUID] = Query(None),
    medicine_id: Optional[UUID] = Query(None),
    group_by: str = Query("day", pattern="^(day|month|year)$"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get purchase report with filters."""
    _group_expr = text(f"'{group_by}'")
    query = select(
        func.date_trunc(_group_expr, PurchaseInvoice.invoice_date).label('period'),
        func.count(PurchaseInvoice.id).label('invoice_count'),
        func.coalesce(func.sum(PurchaseInvoice.total_amount), 0).label('total_purchases'),
        func.coalesce(func.sum(PurchaseInvoice.discount_amount), 0).label('total_discount'),
        func.coalesce(func.sum(PurchaseInvoice.tax_amount), 0).label('total_tax'),
    ).where(
        and_(
            PurchaseInvoice.status == InvoiceStatus.POSTED.value,
            PurchaseInvoice.invoice_date >= date_from,
            PurchaseInvoice.invoice_date <= date_to,
        )
    )
    
    if supplier_id:
        query = query.where(PurchaseInvoice.supplier_id == supplier_id)
    
    query = query.group_by(func.date_trunc(_group_expr, PurchaseInvoice.invoice_date))
    query = query.order_by(func.date_trunc(_group_expr, PurchaseInvoice.invoice_date))
    
    result = await db.execute(query)
    periods = []
    for row in result:
        periods.append({
            "period": row.period,
            "invoice_count": row.invoice_count,
            "total_purchases": float(row.total_purchases),
            "total_discount": float(row.total_discount),
            "total_tax": float(row.total_tax),
            "net_purchases": float(row.total_purchases) - float(row.total_discount),
        })
    
    totals_result = await db.execute(
        select(
            func.count(PurchaseInvoice.id),
            func.coalesce(func.sum(PurchaseInvoice.total_amount), 0),
            func.coalesce(func.sum(PurchaseInvoice.discount_amount), 0),
            func.coalesce(func.sum(PurchaseInvoice.tax_amount), 0),
        ).where(
            and_(
                PurchaseInvoice.status == InvoiceStatus.POSTED.value,
                PurchaseInvoice.invoice_date >= date_from,
                PurchaseInvoice.invoice_date <= date_to,
            )
        )
    )
    totals = totals_result.first()
    
    return PurchaseReportResponse(
        date_from=date_from,
        date_to=date_to,
        group_by=group_by,
        periods=periods,
        total_invoices=totals[0] or 0,
        total_purchases=float(totals[1] or 0),
        total_discount=float(totals[2] or 0),
        total_tax=float(totals[3] or 0),
    )


@router.get("/purchases/by-supplier")
async def get_purchases_by_supplier(
    date_from: date = Query(...),
    date_to: date = Query(...),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get purchases grouped by supplier."""
    result = await db.execute(
        select(
            Supplier.id,
            Supplier.name,
            func.count(PurchaseInvoice.id).label('invoice_count'),
            func.coalesce(func.sum(PurchaseInvoice.total_amount), 0).label('total_purchases'),
            func.coalesce(func.sum(PurchaseInvoice.balance_amount), 0).label('outstanding'),
        )
        .join(PurchaseInvoice, and_(
            PurchaseInvoice.supplier_id == Supplier.id,
            PurchaseInvoice.status == InvoiceStatus.POSTED.value,
            PurchaseInvoice.invoice_date >= date_from,
            PurchaseInvoice.invoice_date <= date_to,
        ))
        .group_by(Supplier.id, Supplier.name)
        .order_by(func.coalesce(func.sum(PurchaseInvoice.total_amount), 0).desc())
        .limit(limit)
    )
    
    return [
        {
            "supplier_id": str(row.id),
            "name": row.name,
            "invoice_count": row.invoice_count,
            "total_purchases": float(row.total_purchases),
            "outstanding": float(row.outstanding),
        }
        for row in result
    ]


# ===========================================
# Profit Reports
# ===========================================

@router.get("/profit", response_model=ProfitReportResponse)
async def get_profit_report(
    date_from: date = Query(...),
    date_to: date = Query(...),
    group_by: str = Query("month", pattern="^(month|year)$"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get profit and loss report."""
    _group_expr = text(f"'{group_by}'")
    # Sales data
    sales_result = await db.execute(
        select(
            func.date_trunc(_group_expr, SalesInvoice.invoice_date).label('period'),
            func.coalesce(func.sum(SalesInvoice.total_amount), 0).label('gross_sales'),
            func.coalesce(func.sum(SalesInvoice.discount_amount), 0).label('discounts'),
            func.coalesce(func.sum(SalesInvoice.tax_amount), 0).label('tax'),
        )
        .where(
            and_(
                SalesInvoice.status == InvoiceStatus.POSTED.value,
                SalesInvoice.invoice_date >= date_from,
                SalesInvoice.invoice_date <= date_to,
            )
        )
        .group_by(func.date_trunc(_group_expr, SalesInvoice.invoice_date))
    )
    sales_by_period = {row.period: row for row in sales_result}
    
    # COGS
    cogs_result = await db.execute(
        select(
            func.date_trunc(_group_expr, SalesInvoice.invoice_date).label('period'),
            func.coalesce(func.sum(SalesInvoiceItem.cogs_amount), 0).label('cogs'),
        )
        .join(SalesInvoice, and_(
            SalesInvoice.id == SalesInvoiceItem.sales_invoice_id,
            SalesInvoice.status == InvoiceStatus.POSTED.value,
            SalesInvoice.invoice_date >= date_from,
            SalesInvoice.invoice_date <= date_to,
        ))
        .group_by(func.date_trunc(_group_expr, SalesInvoice.invoice_date))
    )
    cogs_by_period = {row.period: float(row.cogs) for row in cogs_result}
    
    # Expenses
    expense_result = await db.execute(
        select(
            func.date_trunc(_group_expr, Expense.expense_date).label('period'),
            func.coalesce(func.sum(Expense.amount), 0).label('expenses'),
        )
        .where(
            and_(
                Expense.status == "posted",
                Expense.expense_date >= date_from,
                Expense.expense_date <= date_to,
            )
        )
        .group_by(func.date_trunc(_group_expr, Expense.expense_date))
    )
    expenses_by_period = {row.period: float(row.expenses) for row in expense_result}
    
    # Expenses by category
    cat_expense_result = await db.execute(
        select(
            func.date_trunc(_group_expr, Expense.expense_date).label('period'),
            ExpenseCategory.name,
            func.coalesce(func.sum(Expense.amount), 0).label('amount'),
        )
        .join(ExpenseCategory, ExpenseCategory.id == Expense.category_id)
        .where(
            and_(
                Expense.status == "posted",
                Expense.expense_date >= date_from,
                Expense.expense_date <= date_to,
            )
        )
        .group_by(func.date_trunc(_group_expr, Expense.expense_date), ExpenseCategory.name)
    )
    
    expenses_by_cat_by_period = {}
    for row in cat_expense_result:
        if row.period not in expenses_by_cat_by_period:
            expenses_by_cat_by_period[row.period] = []
        expenses_by_cat_by_period[row.period].append({
            "category": row.name,
            "amount": float(row.amount),
        })
    
    # Build periods
    periods = []
    current = date_from.replace(day=1)
    while current <= date_to:
        period_key = current.replace(day=1)
        sales = sales_by_period.get(period_key)
        cogs = cogs_by_period.get(period_key, 0)
        expenses = expenses_by_period.get(period_key, 0)
        cat_expenses = expenses_by_cat_by_period.get(period_key, [])
        
        gross_sales = float(sales.gross_sales) if sales else 0
        discounts = float(sales.discounts) if sales else 0
        tax = float(sales.tax) if sales else 0
        net_sales = gross_sales - discounts
        gross_profit = net_sales - cogs
        net_profit = gross_profit - expenses
        
        periods.append({
            "period": period_key,
            "gross_sales": gross_sales,
            "discounts": discounts,
            "tax": tax,
            "net_sales": net_sales,
            "cogs": cogs,
            "gross_profit": gross_profit,
            "gross_margin_pct": round((gross_profit / net_sales * 100) if net_sales > 0 else 0, 2),
            "expenses": expenses,
            "expenses_by_category": cat_expenses,
            "net_profit": net_profit,
            "net_margin_pct": round((net_profit / net_sales * 100) if net_sales > 0 else 0, 2),
        })
        
        # Next period
        if group_by == "month":
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
        else:
            current = current.replace(year=current.year + 1)
    
    return ProfitReportResponse(
        date_from=date_from,
        date_to=date_to,
        group_by=group_by,
        periods=periods,
    )


# ===========================================
# Inventory Valuation
# ===========================================

@router.get("/inventory-valuation", response_model=InventoryValuationResponse)
async def get_inventory_valuation(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get inventory valuation report."""
    result = await db.execute(
        select(
            Medicine.id,
            Medicine.product_code,
            Medicine.name,
            Medicine.generic_name,
            func.coalesce(func.sum(MedicineBatch.available_quantity), 0).label('total_qty'),
            func.coalesce(func.sum(MedicineBatch.available_quantity * MedicineBatch.purchase_cost_per_unit), 0).label('total_value'),
            func.count(MedicineBatch.id).label('batch_count'),
        )
        .join(MedicineBatch, MedicineBatch.medicine_id == Medicine.id)
        .where(
            and_(
                Medicine.is_active == True,
                MedicineBatch.status == BatchStatus.ACTIVE.value,
                MedicineBatch.available_quantity > 0,
            )
        )
        .group_by(Medicine.id, Medicine.product_code, Medicine.name, Medicine.generic_name)
        .order_by(Medicine.name)
    )
    
    items = []
    grand_total_qty = 0
    grand_total_value = 0
    
    for row in result:
        items.append({
            "medicine_id": str(row.id),
            "product_code": row.product_code,
            "name": row.name,
            "generic_name": row.generic_name,
            "total_quantity": float(row.total_qty),
            "total_value": float(row.total_value),
            "batch_count": row.batch_count,
        })
        grand_total_qty += float(row.total_qty)
        grand_total_value += float(row.total_value)
    
    return InventoryValuationResponse(
        items=items,
        grand_total_quantity=grand_total_qty,
        grand_total_value=grand_total_value,
    )


# ===========================================
# Expiry Reports
# ===========================================

@router.get("/expiry", response_model=ExpiryReportResponse)
async def get_expiry_report(
    days: int = Query(90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get expiry report."""
    today = date.today()
    
    # Expiring within days
    expiring_result = await db.execute(
        select(
            MedicineBatch.id,
            MedicineBatch.medicine_id,
            Medicine.name,
            Medicine.product_code,
            MedicineBatch.batch_number,
            MedicineBatch.manufacturing_date,
            MedicineBatch.expiry_date,
            MedicineBatch.available_quantity,
            MedicineBatch.purchase_cost_per_unit,
            Supplier.name.label('supplier_name'),
        )
        .join(Medicine, Medicine.id == MedicineBatch.medicine_id)
        .outerjoin(Supplier, Supplier.id == MedicineBatch.supplier_id)
        .where(
            and_(
                MedicineBatch.status == BatchStatus.ACTIVE.value,
                MedicineBatch.available_quantity > 0,
                MedicineBatch.expiry_date <= today + timedelta(days=days),
                MedicineBatch.expiry_date >= today,
            )
        )
        .order_by(MedicineBatch.expiry_date.asc())
    )
    
    expiring = []
    for row in expiring_result:
        expiring.append({
            "batch_id": str(row.id),
            "medicine_id": str(row.medicine_id),
            "medicine_name": row.name,
            "product_code": row.product_code,
            "batch_number": row.batch_number,
            "manufacturing_date": row.manufacturing_date,
            "expiry_date": row.expiry_date,
            "days_to_expiry": (row.expiry_date - today).days,
            "available_quantity": float(row.available_quantity),
            "purchase_cost_per_unit": float(row.purchase_cost_per_unit),
            "stock_value": float(row.available_quantity) * float(row.purchase_cost_per_unit),
            "supplier_name": row.supplier_name,
        })
    
    # Already expired
    expired_result = await db.execute(
        select(
            MedicineBatch.id,
            MedicineBatch.medicine_id,
            Medicine.name,
            Medicine.product_code,
            MedicineBatch.batch_number,
            MedicineBatch.manufacturing_date,
            MedicineBatch.expiry_date,
            MedicineBatch.available_quantity,
            MedicineBatch.purchase_cost_per_unit,
            Supplier.name.label('supplier_name'),
        )
        .join(Medicine, Medicine.id == MedicineBatch.medicine_id)
        .outerjoin(Supplier, Supplier.id == MedicineBatch.supplier_id)
        .where(
            and_(
                MedicineBatch.status == BatchStatus.EXPIRED.value,
                MedicineBatch.available_quantity > 0,
            )
        )
        .order_by(MedicineBatch.expiry_date.asc())
    )
    
    expired = []
    for row in expired_result:
        expired.append({
            "batch_id": str(row.id),
            "medicine_id": str(row.medicine_id),
            "medicine_name": row.name,
            "product_code": row.product_code,
            "batch_number": row.batch_number,
            "manufacturing_date": row.manufacturing_date,
            "expiry_date": row.expiry_date,
            "days_expired": (today - row.expiry_date).days,
            "available_quantity": float(row.available_quantity),
            "purchase_cost_per_unit": float(row.purchase_cost_per_unit),
            "stock_value": float(row.available_quantity) * float(row.purchase_cost_per_unit),
            "supplier_name": row.supplier_name,
        })
    
    return ExpiryReportResponse(
        as_of_date=today,
        expiring_within_days=days,
        expiring_batches=expiring,
        expired_batches=expired,
    )


# ===========================================
# Doctor Investment / ROI Report
# ===========================================

@router.get("/doctor-investments", response_model=DoctorInvestmentReportResponse)
async def get_doctor_investment_report(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get doctor investment ROI report."""
    if not date_from:
        date_from = date.today().replace(month=1, day=1)
    if not date_to:
        date_to = date.today()
    
    result = await db.execute(
        select(
            DoctorInvestment.id,
            DoctorInvestment.customer_id,
            Customer.name,
            Customer.specialty,
            Customer.area,
            DoctorInvestment.investment_amount,
            DoctorInvestment.investment_date,
            DoctorInvestment.roi_percentage,
            DoctorInvestment.expected_sale,
            DoctorInvestment.status,
        )
        .join(Customer, Customer.id == DoctorInvestment.customer_id)
        .where(DoctorInvestment.status == "active")
    )
    
    doctors = []
    for row in result:
        # Get actual sales for this doctor in the period
        sales_result = await db.execute(
            select(func.coalesce(func.sum(SalesInvoice.total_amount), 0))
            .where(
                and_(
                    SalesInvoice.customer_id == row.customer_id,
                    SalesInvoice.status == InvoiceStatus.POSTED.value,
                    SalesInvoice.invoice_date >= date_from,
                    SalesInvoice.invoice_date <= date_to,
                )
            )
        )
        actual_sales = float(sales_result.scalar() or 0)

        # Include imported historical performance (ROI/OLX) for the period.
        imported_result = await db.execute(
            select(func.coalesce(func.sum(ImportedCustomerPerformance.actual_sales), 0))
            .where(
                and_(
                    ImportedCustomerPerformance.customer_id == row.customer_id,
                    ImportedCustomerPerformance.period_year >= date_from.year,
                    ImportedCustomerPerformance.period_year <= date_to.year,
                    or_(
                        ImportedCustomerPerformance.period_year > date_from.year,
                        ImportedCustomerPerformance.period_month >= date_from.month,
                    ),
                    or_(
                        ImportedCustomerPerformance.period_year < date_to.year,
                        ImportedCustomerPerformance.period_month <= date_to.month,
                    ),
                )
            )
        )
        imported_sales = float(imported_result.scalar() or 0)
        actual_sales += imported_sales
        
        doctors.append({
            "investment_id": str(row.id),
            "customer_id": str(row.customer_id),
            "doctor_name": row.name,
            "specialty": row.specialty,
            "area": row.area,
            "investment_amount": float(row.investment_amount),
            "investment_date": row.investment_date,
            "roi_percentage": float(row.roi_percentage),
            "expected_sale": float(row.expected_sale),
            "actual_sales": actual_sales,
            "imported_sales": imported_sales,
            "balance": float(row.expected_sale) - actual_sales,
            "achievement_pct": round((actual_sales / float(row.expected_sale) * 100) if float(row.expected_sale) > 0 else 0, 2),
            "status": row.status,
        })
    
    return DoctorInvestmentReportResponse(
        date_from=date_from,
        date_to=date_to,
        doctors=doctors,
        total_investment=sum(d["investment_amount"] for d in doctors),
        total_expected=sum(d["expected_sale"] for d in doctors),
        total_actual=sum(d["actual_sales"] for d in doctors),
        total_balance=sum(d["balance"] for d in doctors),
    )


# ===========================================
# Monthly Summary (Excel-style)
# ===========================================

@router.get("/monthly-summary", response_model=MonthlySummaryResponse)
async def get_monthly_summary(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get monthly summary like the Excel workbook."""
    month_start = date(year, month, 1)
    if month == 12:
        month_end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(year, month + 1, 1) - timedelta(days=1)
    
    # Sales
    sales_result = await db.execute(
        select(
            func.coalesce(func.sum(SalesInvoice.total_amount), 0),
            func.coalesce(func.sum(SalesInvoice.discount_amount), 0),
            func.coalesce(func.sum(SalesInvoiceItem.cogs_amount), 0),
            func.coalesce(func.sum(SalesInvoiceItem.gross_profit), 0),
        )
        .join(SalesInvoiceItem, SalesInvoiceItem.sales_invoice_id == SalesInvoice.id)
        .where(
            and_(
                SalesInvoice.status == InvoiceStatus.POSTED.value,
                SalesInvoice.invoice_date >= month_start,
                SalesInvoice.invoice_date <= month_end,
            )
        )
    )
    sales = sales_result.first()
    
    # Purchases
    purchases_result = await db.execute(
        select(
            func.coalesce(func.sum(PurchaseInvoice.total_amount), 0),
            func.coalesce(func.sum(PurchaseInvoice.discount_amount), 0),
        )
        .where(
            and_(
                PurchaseInvoice.status == InvoiceStatus.POSTED.value,
                PurchaseInvoice.invoice_date >= month_start,
                PurchaseInvoice.invoice_date <= month_end,
            )
        )
    )
    purchases = purchases_result.first()
    
    # Expenses
    expenses_result = await db.execute(
        select(
            func.coalesce(func.sum(Expense.amount), 0),
        )
        .where(
            and_(
                Expense.status == "posted",
                Expense.expense_date >= month_start,
                Expense.expense_date <= month_end,
            )
        )
    )
    expenses = expenses_result.scalar() or 0
    
    # Expenses by category
    cat_expenses_result = await db.execute(
        select(
            ExpenseCategory.name,
            func.coalesce(func.sum(Expense.amount), 0),
        )
        .join(ExpenseCategory, ExpenseCategory.id == Expense.category_id)
        .where(
            and_(
                Expense.status == "posted",
                Expense.expense_date >= month_start,
                Expense.expense_date <= month_end,
            )
        )
        .group_by(ExpenseCategory.name)
    )
    
    gross_sales = float(sales[0] or 0)
    discounts = float(sales[1] or 0)
    cogs = float(sales[2] or 0)
    gross_profit = float(sales[3] or 0)
    net_sales = gross_sales - discounts
    total_purchases = float(purchases[0] or 0)
    purchase_discounts = float(purchases[1] or 0)
    net_purchases = total_purchases - purchase_discounts
    total_expenses = float(expenses)
    net_profit = gross_profit - total_expenses
    
    # Imported historical figures for the same month (performance records only)
    imported_result = await db.execute(
        select(ImportedMonthSummary).where(
            ImportedMonthSummary.period_year == year,
            ImportedMonthSummary.period_month == month,
        )
    )
    imported = imported_result.scalars().first()
    imported_sales = float(imported.total_sales) if imported else 0
    imported_purchases = float(imported.total_purchase) if imported else 0
    imported_profit = float(imported.total_profit) if imported else 0
    imported_expenses = float(imported.total_expense) if imported else 0

    return MonthlySummaryResponse(
        year=year,
        month=month,
        month_name=month_start.strftime("%B %Y"),
        gross_sales=gross_sales,
        discounts=discounts,
        net_sales=net_sales,
        cogs=cogs,
        gross_profit=gross_profit,
        gross_margin_pct=round((gross_profit / net_sales * 100) if net_sales > 0 else 0, 2),
        total_purchases=total_purchases,
        purchase_discounts=purchase_discounts,
        net_purchases=net_purchases,
        expenses=total_expenses,
        net_profit=net_profit,
        net_margin_pct=round((net_profit / net_sales * 100) if net_sales > 0 else 0, 2),
        expense_categories=[
            {"category": row.name, "amount": float(row[1])}
            for row in cat_expenses_result
        ],
        imported_sales=imported_sales,
        imported_purchases=imported_purchases,
        imported_profit=imported_profit,
        imported_expenses=imported_expenses,
        total_sales_with_history=net_sales + imported_sales,
        total_profit_with_history=gross_profit + imported_profit,
    )


# ===========================================
# Export
# ===========================================

@router.post("/export")
async def export_report(
    data: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Export report data as a real CSV or Excel download."""
    date_from = data.date_from or date.today().replace(day=1)
    date_to = data.date_to or date.today()
    report_type = data.report_type
    headers: List[str] = []
    rows: List[List] = []
    title = report_type

    if report_type == "sales":
        result = await get_sales_report(
            date_from=date_from, date_to=date_to, customer_id=None, medicine_id=None,
            group_by="month", db=db, current_user=current_user,
        )
        headers = ["Period", "Invoices", "Total Sales", "Discount", "Tax", "Net Sales"]
        rows = [
            [p["period"], p["invoice_count"], p["total_sales"], p["total_discount"],
             p["total_tax"], p["net_sales"]]
            for p in result.periods
        ]
    elif report_type == "purchases":
        result = await get_purchase_report(
            date_from=date_from, date_to=date_to, supplier_id=None, medicine_id=None,
            group_by="month", db=db, current_user=current_user,
        )
        headers = ["Period", "Invoices", "Total Purchases", "Discount", "Tax", "Net Purchases"]
        rows = [
            [p["period"], p["invoice_count"], p["total_purchases"], p["total_discount"],
             p["total_tax"], p["net_purchases"]]
            for p in result.periods
        ]
    elif report_type == "profit":
        result = await get_profit_report(
            date_from=date_from, date_to=date_to, group_by="month",
            db=db, current_user=current_user,
        )
        headers = ["Period", "Gross Sales", "Discounts", "Net Sales", "COGS", "Gross Profit",
                   "Gross Margin %", "Expenses", "Net Profit", "Net Margin %"]
        rows = [
            [p["period"], p["gross_sales"], p["discounts"], p["net_sales"], p["cogs"],
             p["gross_profit"], p["gross_margin_pct"], p["expenses"], p["net_profit"],
             p["net_margin_pct"]]
            for p in result.periods
        ]
    elif report_type == "inventory":
        result = await get_inventory_valuation(db=db, current_user=current_user)
        headers = ["Product Code", "Medicine", "Generic", "Quantity", "Value", "Batches"]
        rows = [
            [i["product_code"], i["name"], i["generic_name"], i["total_quantity"],
             i["total_value"], i["batch_count"]]
            for i in result.items
        ]
    elif report_type == "expiry":
        result = await get_expiry_report(days=90, db=db, current_user=current_user)
        headers = ["Status", "Medicine", "Product Code", "Batch", "Expiry", "Days", "Quantity", "Cost/Unit", "Stock Value", "Supplier"]
        rows = [
            ["Expiring", b["medicine_name"], b["product_code"], b["batch_number"],
             b["expiry_date"], b["days_to_expiry"], b["available_quantity"],
             b["purchase_cost_per_unit"], b["stock_value"], b["supplier_name"]]
            for b in result.expiring_batches
        ] + [
            ["Expired", b["medicine_name"], b["product_code"], b["batch_number"],
             b["expiry_date"], -b["days_expired"], b["available_quantity"],
             b["purchase_cost_per_unit"], b["stock_value"], b["supplier_name"]]
            for b in result.expired_batches
        ]
    elif report_type == "doctor-investments":
        result = await get_doctor_investment_report(
            date_from=date_from, date_to=date_to, db=db, current_user=current_user,
        )
        headers = ["Doctor", "Specialty", "Area", "Investment", "Date", "ROI %",
                   "Expected Sale", "Actual Sales", "Balance", "Achievement %", "Status"]
        rows = [
            [d["doctor_name"], d["specialty"], d["area"], d["investment_amount"],
             d["investment_date"], d["roi_percentage"], d["expected_sale"],
             d["actual_sales"], d["balance"], d["achievement_pct"], d["status"]]
            for d in result.doctors
        ]
    else:  # monthly-summary
        year = int(data.filters.get("year") or date_to.year)
        month = int(data.filters.get("month") or date_to.month)
        result = await get_monthly_summary(year=year, month=month, db=db, current_user=current_user)
        headers = ["Metric", "Value"]
        payload = result.model_dump()
        rows = [
            [key.replace("_", " ").title(), value]
            for key, value in payload.items()
            if key != "expense_categories"
        ]
        for category in result.expense_categories:
            rows.append([f"Expense: {category['category']}", category["amount"]])

    is_excel = data.format == "excel"
    if is_excel:
        content = workbook_bytes(title, headers, rows)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        extension = "xlsx"
    else:
        content = csv_bytes(headers, rows)
        media_type = "text/csv; charset=utf-8"
        extension = "csv"

    filename = f"{report_type}-{date.today().isoformat()}.{extension}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )