"""Dashboard schemas."""
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class DashboardSummary(BaseModel):
    """Dashboard summary cards."""
    today_sales: float
    month_sales: float
    today_purchases: float
    month_purchases: float
    month_gross_profit: float
    month_expenses: float
    net_operating_profit: float
    total_receivables: float
    overdue_receivables: float
    total_payables: float
    overdue_payables: float
    cash_bank_balance: float
    inventory_value: float
    low_stock_count: int
    expiring_batches_count: int
    expiring_batches_value: float
    expired_batches_count: int
    expired_batches_value: float


class DashboardChartData(BaseModel):
    """Chart data for Recharts."""
    labels: List[str]
    datasets: List[dict]


class ExpiryAlertItem(BaseModel):
    """Single expiry alert tier."""
    tier: str
    label: str
    batch_count: int
    total_quantity: float
    total_value: float


class ExpiryAlertSummary(BaseModel):
    """Expiry alerts summary."""
    alerts: List[ExpiryAlertItem]


class LowStockItem(BaseModel):
    """Low stock item."""
    medicine_id: str
    product_code: str
    name: str
    reorder_level: int
    current_stock: float
    stock_value: float


class QuickActionItem(BaseModel):
    """Quick action for dashboard."""
    label: str
    icon: str
    href: str
    color: str