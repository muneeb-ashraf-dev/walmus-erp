"""Reports schemas."""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import date
from decimal import Decimal


class SalesReportResponse(BaseModel):
    date_from: date
    date_to: date
    group_by: str
    periods: List[Dict[str, Any]]
    total_invoices: int
    total_sales: float
    total_discount: float
    total_tax: float


class PurchaseReportResponse(BaseModel):
    date_from: date
    date_to: date
    group_by: str
    periods: List[Dict[str, Any]]
    total_invoices: int
    total_purchases: float
    total_discount: float
    total_tax: float


class ProfitReportResponse(BaseModel):
    date_from: date
    date_to: date
    group_by: str
    periods: List[Dict[str, Any]]


class InventoryValuationResponse(BaseModel):
    items: List[Dict[str, Any]]
    grand_total_quantity: float
    grand_total_value: float


class ExpiryReportResponse(BaseModel):
    as_of_date: date
    expiring_within_days: int
    expiring_batches: List[Dict[str, Any]]
    expired_batches: List[Dict[str, Any]]


class DoctorInvestmentReportResponse(BaseModel):
    date_from: date
    date_to: date
    doctors: List[Dict[str, Any]]
    total_investment: float
    total_expected: float
    total_actual: float
    total_balance: float


class MonthlySummaryResponse(BaseModel):
    year: int
    month: int
    month_name: str
    gross_sales: float
    discounts: float
    net_sales: float
    cogs: float
    gross_profit: float
    gross_margin_pct: float
    total_purchases: float
    purchase_discounts: float
    net_purchases: float
    expenses: float
    net_profit: float
    net_margin_pct: float
    expense_categories: List[Dict[str, Any]]
    imported_sales: float = 0
    imported_purchases: float = 0
    imported_profit: float = 0
    imported_expenses: float = 0
    total_sales_with_history: float = 0
    total_profit_with_history: float = 0


class ExportRequest(BaseModel):
    report_type: str = Field(..., pattern="^(sales|purchases|profit|inventory|expiry|doctor-investments|monthly-summary)$")
    format: str = Field(default="csv", pattern="^(csv|excel)$")
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    filters: Dict[str, Any] = {}