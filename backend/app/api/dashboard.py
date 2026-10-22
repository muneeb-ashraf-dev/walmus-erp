"""Dashboard API endpoints."""
from datetime import date, datetime, timedelta, UTC
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, or_, case, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import AppUser
from app.models import (
    Medicine, MedicineBatch, PurchaseInvoice, PurchaseInvoiceItem,
    SalesInvoice, SalesInvoiceItem,
    Supplier, Customer, FinancialAccount, Expense, ExpenseCategory,
    DoctorInvestment, InventoryMovement,
)
from app.models.enums import InvoiceStatus, BatchStatus
from app.schemas.dashboard import (
    DashboardSummary,
    DashboardChartData,
    ExpiryAlertSummary,
    LowStockItem,
    QuickActionItem,
)

router = APIRouter()

# PostgreSQL needs a literal unit here; binding it as a parameter makes the
# SELECT expression differ from the GROUP BY expression.
_MONTH = text("'month'")


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """Get dashboard summary cards."""
    today = date.today()
    month_start = today.replace(day=1)
    
    # Today's sales
    today_sales_result = await db.execute(
        select(func.coalesce(func.sum(SalesInvoice.total_amount), 0))
        .where(
            and_(
                SalesInvoice.status == InvoiceStatus.POSTED.value,
                SalesInvoice.invoice_date == today,
            )
        )
    )
    today_sales = today_sales_result.scalar() or 0
    
    # This month's sales
    month_sales_result = await db.execute(
        select(func.coalesce(func.sum(SalesInvoice.total_amount), 0))
        .where(
            and_(
                SalesInvoice.status == InvoiceStatus.POSTED.value,
                SalesInvoice.invoice_date >= month_start,
                SalesInvoice.invoice_date <= today,
            )
        )
    )
    month_sales = month_sales_result.scalar() or 0
    
    # Today's purchases
    today_purchases_result = await db.execute(
        select(func.coalesce(func.sum(PurchaseInvoice.total_amount), 0))
        .where(
            and_(
                PurchaseInvoice.status == InvoiceStatus.POSTED.value,
                PurchaseInvoice.invoice_date == today,
            )
        )
    )
    today_purchases = today_purchases_result.scalar() or 0
    
    # This month's purchases
    month_purchases_result = await db.execute(
        select(func.coalesce(func.sum(PurchaseInvoice.total_amount), 0))
        .where(
            and_(
                PurchaseInvoice.status == InvoiceStatus.POSTED.value,
                PurchaseInvoice.invoice_date >= month_start,
                PurchaseInvoice.invoice_date <= today,
            )
        )
    )
    month_purchases = month_purchases_result.scalar() or 0
    
    # This month's gross profit
    month_gross_profit_result = await db.execute(
        select(func.coalesce(func.sum(SalesInvoiceItem.gross_profit), 0))
        .join(SalesInvoice, SalesInvoice.id == SalesInvoiceItem.sales_invoice_id)
        .where(
            and_(
                SalesInvoice.status == InvoiceStatus.POSTED.value,
                SalesInvoice.invoice_date >= month_start,
                SalesInvoice.invoice_date <= today,
            )
        )
    )
    month_gross_profit = month_gross_profit_result.scalar() or 0
    
    # Operating expenses this month
    month_expenses_result = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0))
        .where(
            and_(
                Expense.status == "posted",
                Expense.expense_date >= month_start,
                Expense.expense_date <= today,
            )
        )
    )
    month_expenses = month_expenses_result.scalar() or 0
    
    # Net operating profit
    net_operating_profit = month_gross_profit - month_expenses
    
    # Total receivables
    receivables_result = await db.execute(
        select(func.coalesce(func.sum(SalesInvoice.balance_amount), 0))
        .where(
            and_(
                SalesInvoice.status == InvoiceStatus.POSTED.value,
                SalesInvoice.balance_amount > 0,
            )
        )
    )
    total_receivables = receivables_result.scalar() or 0
    
    # Overdue receivables
    overdue_receivables_result = await db.execute(
        select(func.coalesce(func.sum(SalesInvoice.balance_amount), 0))
        .where(
            and_(
                SalesInvoice.status == InvoiceStatus.POSTED.value,
                SalesInvoice.balance_amount > 0,
                SalesInvoice.due_date < today,
            )
        )
    )
    overdue_receivables = overdue_receivables_result.scalar() or 0
    
    # Total payables
    payables_result = await db.execute(
        select(func.coalesce(func.sum(PurchaseInvoice.balance_amount), 0))
        .where(
            and_(
                PurchaseInvoice.status == InvoiceStatus.POSTED.value,
                PurchaseInvoice.balance_amount > 0,
            )
        )
    )
    total_payables = payables_result.scalar() or 0
    
    # Overdue payables
    overdue_payables_result = await db.execute(
        select(func.coalesce(func.sum(PurchaseInvoice.balance_amount), 0))
        .where(
            and_(
                PurchaseInvoice.status == InvoiceStatus.POSTED.value,
                PurchaseInvoice.balance_amount > 0,
                PurchaseInvoice.due_date < today,
            )
        )
    )
    overdue_payables = overdue_payables_result.scalar() or 0
    
    # Cash and bank balances
    cash_result = await db.execute(
        select(func.coalesce(func.sum(FinancialAccount.opening_balance), 0))
        .where(FinancialAccount.code.in_(["CASH", "BANK"]))
    )
    cash_bank_balance = cash_result.scalar() or 0
    
    # Add journal entries to get current balance
    # For simplicity, use opening balance + net journal entries
    # This is a simplified version - real implementation would compute from journal entries
    
    # Saleable inventory value
    inventory_value_result = await db.execute(
        select(func.coalesce(func.sum(
            MedicineBatch.available_quantity * MedicineBatch.purchase_cost_per_unit
        ), 0))
        .where(
            and_(
                MedicineBatch.status == BatchStatus.ACTIVE.value,
                MedicineBatch.available_quantity > 0,
            )
        )
    )
    inventory_value = inventory_value_result.scalar() or 0
    
    # Low stock count
    low_stock_result = await db.execute(
        select(func.count(func.distinct(MedicineBatch.medicine_id)))
        .where(
            and_(
                MedicineBatch.status == BatchStatus.ACTIVE.value,
                MedicineBatch.available_quantity > 0,
            )
        )
        .join(Medicine, Medicine.id == MedicineBatch.medicine_id)
        .where(MedicineBatch.available_quantity <= Medicine.reorder_level)
    )
    low_stock_count = low_stock_result.scalar() or 0
    
    # Expiring batches (≤30 days)
    expiring_30_result = await db.execute(
        select(
            func.count(MedicineBatch.id),
            func.coalesce(func.sum(MedicineBatch.available_quantity * MedicineBatch.purchase_cost_per_unit), 0)
        )
        .where(
            and_(
                MedicineBatch.status == BatchStatus.ACTIVE.value,
                MedicineBatch.available_quantity > 0,
                MedicineBatch.expiry_date <= today + timedelta(days=30),
                MedicineBatch.expiry_date >= today,
            )
        )
    )
    expiring_30_count, expiring_30_value = expiring_30_result.first() or (0, 0)
    
    # Expired stock
    expired_result = await db.execute(
        select(
            func.count(MedicineBatch.id),
            func.coalesce(func.sum(MedicineBatch.available_quantity * MedicineBatch.purchase_cost_per_unit), 0)
        )
        .where(
            and_(
                MedicineBatch.status == BatchStatus.EXPIRED.value,
                MedicineBatch.available_quantity > 0,
            )
        )
    )
    expired_count, expired_value = expired_result.first() or (0, 0)
    
    return DashboardSummary(
        today_sales=today_sales,
        month_sales=month_sales,
        today_purchases=today_purchases,
        month_purchases=month_purchases,
        month_gross_profit=month_gross_profit,
        month_expenses=month_expenses,
        net_operating_profit=net_operating_profit,
        total_receivables=total_receivables,
        overdue_receivables=overdue_receivables,
        total_payables=total_payables,
        overdue_payables=overdue_payables,
        cash_bank_balance=cash_bank_balance,
        inventory_value=inventory_value,
        low_stock_count=low_stock_count,
        expiring_batches_count=expiring_30_count,
        expiring_batches_value=expiring_30_value,
        expired_batches_count=expired_count,
        expired_batches_value=expired_value,
    )


@router.get("/charts/sales-purchases", response_model=DashboardChartData)
async def get_sales_purchases_chart(
    months: int = Query(12, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get monthly sales vs purchases chart data."""
    end_date = date.today()
    start_date = end_date - timedelta(days=months * 30)
    
    # Sales by month
    sales_result = await db.execute(
        select(
            func.date_trunc(_MONTH, SalesInvoice.invoice_date).label('month'),
            func.coalesce(func.sum(SalesInvoice.total_amount), 0).label('total')
        )
        .where(
            and_(
                SalesInvoice.status == InvoiceStatus.POSTED.value,
                SalesInvoice.invoice_date >= start_date,
                SalesInvoice.invoice_date <= end_date,
            )
        )
        .group_by(func.date_trunc(_MONTH, SalesInvoice.invoice_date))
        .order_by(func.date_trunc(_MONTH, SalesInvoice.invoice_date))
    )
    sales_data = {row.month.strftime("%Y-%m"): float(row.total) for row in sales_result}
    
    # Purchases by month
    purchases_result = await db.execute(
        select(
            func.date_trunc(_MONTH, PurchaseInvoice.invoice_date).label('month'),
            func.coalesce(func.sum(PurchaseInvoice.total_amount), 0).label('total')
        )
        .where(
            and_(
                PurchaseInvoice.status == InvoiceStatus.POSTED.value,
                PurchaseInvoice.invoice_date >= start_date,
                PurchaseInvoice.invoice_date <= end_date,
            )
        )
        .group_by(func.date_trunc(_MONTH, PurchaseInvoice.invoice_date))
        .order_by(func.date_trunc(_MONTH, PurchaseInvoice.invoice_date))
    )
    purchases_data = {row.month.strftime("%Y-%m"): float(row.total) for row in purchases_result}
    
    # Combine all months
    labels = []
    sales_values = []
    purchases_values = []
    
    current = start_date.replace(day=1)
    while current <= end_date:
        month_key = current.strftime("%Y-%m")
        labels.append(current.strftime("%b %Y"))
        sales_values.append(sales_data.get(month_key, 0))
        purchases_values.append(purchases_data.get(month_key, 0))
        # Next month
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)
    
    return DashboardChartData(
        labels=labels,
        datasets=[
            {"label": "Sales", "data": sales_values, "borderColor": "#3b82f6", "backgroundColor": "rgba(59, 130, 246, 0.1)"},
            {"label": "Purchases", "data": purchases_values, "borderColor": "#ef4444", "backgroundColor": "rgba(239, 68, 68, 0.1)"},
        ],
    )


@router.get("/charts/gross-profit", response_model=DashboardChartData)
async def get_gross_profit_chart(
    months: int = Query(12, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get monthly gross profit trend chart data."""
    end_date = date.today()
    start_date = end_date - timedelta(days=months * 30)
    
    result = await db.execute(
        select(
            func.date_trunc(_MONTH, SalesInvoice.invoice_date).label('month'),
            func.coalesce(func.sum(SalesInvoiceItem.gross_profit), 0).label('gross_profit')
        )
        .join(SalesInvoice, SalesInvoice.id == SalesInvoiceItem.sales_invoice_id)
        .where(
            and_(
                SalesInvoice.status == InvoiceStatus.POSTED.value,
                SalesInvoice.invoice_date >= start_date,
                SalesInvoice.invoice_date <= end_date,
            )
        )
        .group_by(func.date_trunc(_MONTH, SalesInvoice.invoice_date))
        .order_by(func.date_trunc(_MONTH, SalesInvoice.invoice_date))
    )
    
    profit_data = {row.month.strftime("%Y-%m"): float(row.gross_profit) for row in result}
    
    labels = []
    values = []
    current = start_date.replace(day=1)
    while current <= end_date:
        month_key = current.strftime("%Y-%m")
        labels.append(current.strftime("%b %Y"))
        values.append(profit_data.get(month_key, 0))
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)
    
    return DashboardChartData(
        labels=labels,
        datasets=[{"label": "Gross Profit", "data": values, "borderColor": "#22c55e", "backgroundColor": "rgba(34, 197, 94, 0.1)"}],
    )


@router.get("/charts/sales-by-product", response_model=DashboardChartData)
async def get_sales_by_product_chart(
    limit: int = Query(10, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get top products by sales chart data."""
    result = await db.execute(
        select(
            Medicine.name,
            func.coalesce(func.sum(SalesInvoiceItem.line_total), 0).label('total_sales')
        )
        .join(SalesInvoiceItem, SalesInvoiceItem.medicine_id == Medicine.id)
        .join(SalesInvoice, SalesInvoice.id == SalesInvoiceItem.sales_invoice_id)
        .where(SalesInvoice.status == InvoiceStatus.POSTED.value)
        .group_by(Medicine.id, Medicine.name)
        .order_by(func.coalesce(func.sum(SalesInvoiceItem.line_total), 0).desc())
        .limit(limit)
    )
    
    labels = []
    values = []
    for row in result:
        labels.append(row.name)
        values.append(float(row.total_sales))
    
    return DashboardChartData(
        labels=labels,
        datasets=[{"label": "Sales by Product", "data": values, "backgroundColor": [
            "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
            "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
        ][:len(values)]}],
    )


@router.get("/charts/expenses-by-category", response_model=DashboardChartData)
async def get_expenses_by_category_chart(
    months: int = Query(12, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get expenses by category chart data."""
    end_date = date.today()
    start_date = end_date - timedelta(days=months * 30)
    
    result = await db.execute(
        select(
            ExpenseCategory.name,
            func.coalesce(func.sum(Expense.amount), 0).label('total')
        )
        .join(Expense, Expense.category_id == ExpenseCategory.id)
        .where(
            and_(
                Expense.status == "posted",
                Expense.expense_date >= start_date,
                Expense.expense_date <= end_date,
            )
        )
        .group_by(ExpenseCategory.id, ExpenseCategory.name)
        .order_by(func.coalesce(func.sum(Expense.amount), 0).desc())
    )
    
    labels = []
    values = []
    for row in result:
        labels.append(row.name)
        values.append(float(row.total))
    
    return DashboardChartData(
        labels=labels,
        datasets=[{"label": "Expenses by Category", "data": values, "backgroundColor": [
            "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6",
            "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
        ][:len(values)]}],
    )


@router.get("/charts/expiry-distribution", response_model=DashboardChartData)
async def get_expiry_distribution_chart(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get expiry risk distribution chart data."""
    today = date.today()
    
    result = await db.execute(
        select(
            func.count(MedicineBatch.id).label('count'),
            func.coalesce(func.sum(MedicineBatch.available_quantity * MedicineBatch.purchase_cost_per_unit), 0).label('value'),
            case(
                (MedicineBatch.expiry_date < today, 'Expired'),
                (MedicineBatch.expiry_date <= today + timedelta(days=7), '≤7 days'),
                (MedicineBatch.expiry_date <= today + timedelta(days=30), '8-30 days'),
                (MedicineBatch.expiry_date <= today + timedelta(days=60), '31-60 days'),
                (MedicineBatch.expiry_date <= today + timedelta(days=90), '61-90 days'),
                else_='>90 days'
            ).label('tier')
        )
        .where(MedicineBatch.status == BatchStatus.ACTIVE.value)
        .group_by('tier')
    )
    
    # Define order
    tier_order = ['Expired', '≤7 days', '8-30 days', '31-60 days', '61-90 days', '>90 days']
    tier_data = {row.tier: {"count": row.count, "value": float(row.value)} for row in result}
    
    labels = []
    counts = []
    values = []
    colors = ["#dc2626", "#f97316", "#f59e0b", "#eab308", "#22c55e", "#3b82f6"]
    
    for i, tier in enumerate(tier_order):
        labels.append(tier)
        data = tier_data.get(tier, {"count": 0, "value": 0})
        counts.append(data["count"])
        values.append(data["value"])
    
    return DashboardChartData(
        labels=labels,
        datasets=[
            {"label": "Batch Count", "data": counts, "backgroundColor": colors},
            {"label": "Value (PKR)", "data": values, "backgroundColor": [c.replace("0.8", "0.3") for c in colors]},
        ],
    )


@router.get("/expiry-alerts", response_model=ExpiryAlertSummary)
async def get_expiry_alerts(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get expiry alerts summary."""
    today = date.today()
    
    tiers = [
        ("expired", today, today, "Expired"),
        ("critical", today, today + timedelta(days=7), "≤7 days"),
        ("expiring_30", today + timedelta(days=1), today + timedelta(days=30), "8-30 days"),
        ("expiring_60", today + timedelta(days=31), today + timedelta(days=60), "31-60 days"),
        ("expiring_90", today + timedelta(days=61), today + timedelta(days=90), "61-90 days"),
    ]
    
    alerts = []
    for key, start, end, label in tiers:
        if key == "expired":
            result = await db.execute(
                select(
                    func.count(MedicineBatch.id),
                    func.coalesce(func.sum(MedicineBatch.available_quantity), 0),
                    func.coalesce(func.sum(MedicineBatch.available_quantity * MedicineBatch.purchase_cost_per_unit), 0)
                )
                .where(
                    and_(
                        MedicineBatch.status == BatchStatus.EXPIRED.value,
                        MedicineBatch.available_quantity > 0,
                    )
                )
            )
        else:
            result = await db.execute(
                select(
                    func.count(MedicineBatch.id),
                    func.coalesce(func.sum(MedicineBatch.available_quantity), 0),
                    func.coalesce(func.sum(MedicineBatch.available_quantity * MedicineBatch.purchase_cost_per_unit), 0)
                )
                .where(
                    and_(
                        MedicineBatch.status == BatchStatus.ACTIVE.value,
                        MedicineBatch.available_quantity > 0,
                        MedicineBatch.expiry_date >= start,
                        MedicineBatch.expiry_date <= end,
                    )
                )
            )
        count, qty, value = result.first() or (0, 0, 0)
        alerts.append({
            "tier": key,
            "label": label,
            "batch_count": count,
            "total_quantity": float(qty),
            "total_value": float(value),
        })
    
    return ExpiryAlertSummary(alerts=alerts)


@router.get("/low-stock", response_model=list[LowStockItem])
async def get_low_stock(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get low stock items."""
    result = await db.execute(
        select(
            Medicine.id,
            Medicine.product_code,
            Medicine.name,
            Medicine.reorder_level,
            func.coalesce(func.sum(MedicineBatch.available_quantity), 0).label('total_qty'),
            func.coalesce(func.sum(MedicineBatch.available_quantity * MedicineBatch.purchase_cost_per_unit), 0).label('total_value')
        )
        .join(MedicineBatch, MedicineBatch.medicine_id == Medicine.id)
        .where(
            and_(
                Medicine.is_active == True,
                MedicineBatch.status == BatchStatus.ACTIVE.value,
                MedicineBatch.available_quantity > 0,
            )
        )
        .group_by(Medicine.id, Medicine.product_code, Medicine.name, Medicine.reorder_level)
        .having(func.coalesce(func.sum(MedicineBatch.available_quantity), 0) <= Medicine.reorder_level)
        .order_by(func.coalesce(func.sum(MedicineBatch.available_quantity), 0).asc())
        .limit(limit)
    )
    
    items = []
    for row in result:
        items.append(LowStockItem(
            medicine_id=str(row.id),
            product_code=row.product_code,
            name=row.name,
            reorder_level=row.reorder_level,
            current_stock=float(row.total_qty),
            stock_value=float(row.total_value),
        ))
    
    return items


@router.get("/quick-actions", response_model=list[QuickActionItem])
async def get_quick_actions(
    current_user = Depends(get_current_user),
):
    """Get quick action items for dashboard."""
    return [
        QuickActionItem(label="New Purchase", icon="shopping-cart", href="/purchases/new", color="blue"),
        QuickActionItem(label="New Sale", icon="shopping-bag", href="/sales/new", color="green"),
        QuickActionItem(label="Receive Payment", icon="credit-card", href="/receipts/new", color="indigo"),
        QuickActionItem(label="Pay Supplier", icon="banknote", href="/payments/new", color="orange"),
        QuickActionItem(label="Add Expense", icon="receipt", href="/expenses/new", color="red"),
        QuickActionItem(label="Add Medicine", icon="pill", href="/medicines/new", color="purple"),
        QuickActionItem(label="Review Expiring", icon="alert-triangle", href="/inventory/expiring", color="amber"),
    ]