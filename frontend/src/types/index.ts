export interface User {
  id: string;
  username: string;
  full_name?: string;
  email?: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Medicine {
  id: string;
  product_code: string;
  barcode?: string;
  name: string;
  generic_name?: string;
  manufacturer_id?: string;
  manufacturer?: Manufacturer;
  strength?: string;
  dosage_form?: string;
  packing_description?: string;
  base_unit_id: string;
  base_unit?: MedicineUnit;
  units_per_pack: number;
  purchase_unit_id?: string;
  purchase_unit?: MedicineUnit;
  purchase_conversion_factor: number;
  sale_unit_id?: string;
  sale_unit?: MedicineUnit;
  sale_conversion_factor: number;
  default_purchase_rate: number;
  default_sale_rate: number;
  wholesale_rate?: number;
  retail_rate?: number;
  tax_rate: number;
  reorder_level: number;
  min_stock_qty: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_number?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MedicineUnit {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_base_unit: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_number?: string;
  credit_limit: number;
  payment_terms_days: number;
  opening_balance: number;
  opening_balance_date?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierDetail extends Supplier {
  outstanding_balance: number;
  overdue_amount: number;
  recent_purchases: Array<{
    id: string;
    voucher_number: string;
    invoice_date: string;
    total_amount: number;
    balance_amount: number;
    payment_status: string;
  }>;
}

export interface Customer {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_number?: string;
  customer_type: string;
  specialty?: string;
  area?: string;
  credit_limit: number;
  payment_terms_days: number;
  opening_balance: number;
  opening_balance_date?: string;
  default_sale_rate_type: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerDetail extends Customer {
  outstanding_balance: number;
  overdue_amount: number;
  recent_sales: Array<{
    id: string;
    invoice_number: string;
    invoice_date: string;
    total_amount: number;
    balance_amount: number;
    payment_status: string;
  }>;
  investments?: Array<{
    id: string;
    investment_amount: number;
    investment_date: string;
    roi_percentage: number;
    status: string;
    expected_sale?: number;
    actual_sales?: number;
  }>;
}

export interface MedicineBatch {
  id: string;
  medicine_id: string;
  medicine?: Medicine;
  batch_number: string;
  manufacturing_date?: string;
  expiry_date: string;
  supplier_id?: string;
  supplier?: Supplier;
  purchase_invoice_id?: string;
  received_quantity: number;
  available_quantity: number;
  purchase_cost_per_unit: number;
  status: 'active' | 'quarantined' | 'expired' | 'depleted';
  location: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseInvoice {
  id: string;
  voucher_number: string;
  supplier_invoice_number?: string;
  supplier_id: string;
  supplier?: Supplier;
  invoice_date: string;
  received_date?: string;
  due_date?: string;
  status: 'draft' | 'posted' | 'cancelled' | 'partially_returned' | 'fully_returned';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_amount: number;
  payment_status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  notes?: string;
  attachment_path?: string;
  posted_at?: string;
  posted_by?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  items?: PurchaseInvoiceItem[];
}

export interface PurchaseInvoiceItem {
  id: string;
  purchase_invoice_id: string;
  line_number: number;
  medicine_id: string;
  medicine?: Medicine;
  batch_number: string;
  manufacturing_date?: string;
  expiry_date: string;
  quantity_received: number;
  purchase_unit_id?: string;
  purchase_unit?: MedicineUnit;
  conversion_factor: number;
  purchase_rate: number;
  discount_percent: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  batch_id?: string;
  batch?: MedicineBatch;
  notes?: string;
  quantity_base_units: number;
}

export interface SalesInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer?: Customer;
  invoice_date: string;
  due_date?: string;
  status: 'draft' | 'posted' | 'cancelled' | 'partially_returned' | 'fully_returned';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_received: number;
  balance_amount: number;
  payment_status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  notes?: string;
  printed_count: number;
  last_printed_at?: string;
  posted_at?: string;
  posted_by?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  items?: SalesInvoiceItem[];
}

export interface SalesInvoiceItem {
  id: string;
  sales_invoice_id: string;
  line_number: number;
  medicine_id: string;
  medicine?: Medicine;
  batch_id: string;
  batch?: MedicineBatch;
  quantity_sold: number;
  sale_unit_id?: string;
  sale_unit?: MedicineUnit;
  conversion_factor: number;
  sale_rate: number;
  discount_percent: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  cost_per_base_unit: number;
  quantity_base_units: number;
  cogs_amount: number;
  gross_profit: number;
  notes?: string;
}

export interface DashboardSummary {
  today_sales: number;
  month_sales: number;
  today_purchases: number;
  month_purchases: number;
  month_gross_profit: number;
  month_expenses: number;
  net_operating_profit: number;
  total_receivables: number;
  overdue_receivables: number;
  total_payables: number;
  overdue_payables: number;
  cash_bank_balance: number;
  inventory_value: number;
  low_stock_count: number;
  expiring_batches_count: number;
  expiring_batches_value: number;
  expired_batches_count: number;
  expired_batches_value: number;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: any;
    borderColor?: string;
    backgroundColor?: string | string[];
  }>;
}

export type DashboardChartData = ChartData;

export interface ExpiryAlert {
  tier: string;
  label: string;
  batch_count: number;
  total_quantity: number;
  total_value: number;
}

export type ExpiryAlertItem = ExpiryAlert;

export interface ExpiryAlertSummary {
  alerts: ExpiryAlertItem[];
}

export interface LowStockItem {
  medicine_id: string;
  product_code: string;
  name: string;
  reorder_level: number;
  current_stock: number;
  stock_value: number;
}

export interface QuickAction {
  label: string;
  icon: string;
  href: string;
  color: string;
}

export type QuickActionItem = QuickAction;

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface DoctorInvestment {
  id: string;
  customer_id: string;
  customer?: Customer;
  investment_amount: number;
  investment_date: string;
  roi_percentage: number;
  expected_sale: number;
  status: 'active' | 'recovered' | 'written_off' | string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  doctor_name?: string;
  specialty?: string;
  area?: string;
  actual_sales?: number;
  balance?: number;
  achievement_pct?: number;
}

export interface FinancialAccount {
  id: string;
  code: string;
  name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | string;
  currency: string;
  opening_balance: number;
  opening_balance_date?: string;
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CashBankBalance {
  cash_balance: number;
  bank_balance: number;
  total: number;
  cash_account: string;
  bank_account: string;
}

export interface PaymentAllocation {
  id?: string;
  payment_id?: string;
  invoice_type: 'sales' | 'purchase';
  invoice_id: string;
  allocated_amount: number;
  invoice_number?: string;
}

export interface Payment {
  id: string;
  payment_number: string;
  payment_date: string;
  account_id: string;
  account?: FinancialAccount;
  party_type: 'customer' | 'supplier';
  party_id: string;
  party_name?: string;
  payment_method: string;
  amount: number;
  reference_number?: string;
  status: string;
  notes?: string;
  created_at: string;
  allocations: PaymentAllocation[];
}

export interface ExpenseCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Expense {
  id: string;
  expense_number: string;
  expense_date: string;
  category_id: string;
  category?: ExpenseCategory;
  account_id: string;
  account?: FinancialAccount;
  amount: number;
  tax_amount: number;
  description?: string;
  reference_number?: string;
  attachment_path?: string;
  status: string;
  medicine_id?: string;
  medicine?: Medicine;
  created_at: string;
  created_by?: string;
}

export interface OwnerSettings {
  id: string;
  business_name: string;
  business_address?: string;
  phone?: string;
  email?: string;
  tax_number?: string;
  currency: string;
  invoice_prefix: string;
  purchase_prefix: string;
  invoice_number_format: string;
  purchase_number_format: string;
  financial_year_start_month: number;
  default_payment_terms_days: number;
  expiry_alert_days: number[];
  default_tax_rate: number;
  opening_cash_balance: number;
  opening_bank_balance: number;
  created_at: string;
  updated_at: string;
}

export interface SalesReportPeriod {
  period: string;
  invoice_count: number;
  total_sales: number;
  total_discount: number;
  total_tax: number;
  net_sales: number;
}

export interface SalesReportResponse {
  date_from: string;
  date_to: string;
  group_by: string;
  periods: SalesReportPeriod[];
  total_invoices: number;
  total_sales: number;
  total_discount: number;
  total_tax: number;
}

export interface SalesByMedicineItem {
  medicine_id: string;
  product_code: string;
  name: string;
  generic_name?: string;
  units_sold: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
  margin_pct: number;
}

export interface SalesByCustomerItem {
  customer_id: string;
  name: string;
  customer_type: string;
  area?: string;
  invoice_count: number;
  total_sales: number;
  outstanding: number;
}

export interface PurchaseReportPeriod {
  period: string;
  invoice_count: number;
  total_purchases: number;
  total_discount: number;
  total_tax: number;
  net_purchases: number;
}

export interface PurchaseReportResponse {
  date_from: string;
  date_to: string;
  group_by: string;
  periods: PurchaseReportPeriod[];
  total_invoices: number;
  total_purchases: number;
  total_discount: number;
  total_tax: number;
}

export interface PurchasesBySupplierItem {
  supplier_id: string;
  name: string;
  invoice_count: number;
  total_purchases: number;
  outstanding: number;
}

export interface ProfitReportPeriod {
  period: string;
  gross_sales: number;
  discounts: number;
  tax: number;
  net_sales: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  expenses: number;
  expenses_by_category: Array<{ category: string; amount: number }>;
  net_profit: number;
  net_margin_pct: number;
}

export interface ProfitReportResponse {
  date_from: string;
  date_to: string;
  group_by: string;
  periods: ProfitReportPeriod[];
}

export interface InventoryValuationItem {
  medicine_id: string;
  product_code: string;
  name: string;
  generic_name?: string;
  total_quantity: number;
  total_value: number;
  batch_count: number;
}

export interface InventoryValuationResponse {
  items: InventoryValuationItem[];
  grand_total_quantity: number;
  grand_total_value: number;
}

export interface DoctorInvestmentReportItem {
  investment_id: string;
  customer_id: string;
  doctor_name: string;
  specialty?: string;
  area?: string;
  investment_amount: number;
  investment_date: string;
  roi_percentage: number;
  expected_sale: number;
  actual_sales: number;
  balance: number;
  achievement_pct: number;
  status: string;
}

export interface DoctorInvestmentReportResponse {
  date_from: string;
  date_to: string;
  doctors: DoctorInvestmentReportItem[];
  total_investment: number;
  total_expected: number;
  total_actual: number;
  total_balance: number;
}

export interface MonthlySummaryResponse {
  year: number;
  month: number;
  month_name: string;
  gross_sales: number;
  discounts: number;
  net_sales: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  total_purchases: number;
  purchase_discounts: number;
  net_purchases: number;
  expenses: number;
  net_profit: number;
  net_margin_pct: number;
  expense_categories: Array<{ category: string; amount: number }>;
}

export interface InventorySummary {
  total_products: number;
  total_batches: number;
  saleable_quantity: number;
  saleable_value: number;
  quarantined_quantity: number;
  quarantined_value: number;
  expired_quantity: number;
  expired_value: number;
  near_expiry_quantity: number;
  near_expiry_value: number;
  low_stock_count: number;
  today_movements: number;
}

export interface InventoryMovement {
  id: string;
  movement_date: string;
  medicine_id: string;
  batch_id?: string;
  reason: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost?: number;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_by?: string;
  medicine?: Medicine;
  batch?: MedicineBatch;
}

export interface StockAdjustment {
  id: string;
  adjustment_number: string;
  adjustment_date: string;
  reason: string;
  reference_type?: string;
  reference_id?: string;
  total_items: number;
  total_value_change: number;
  status: 'draft' | 'posted' | 'cancelled' | string;
  notes?: string;
  posted_at?: string;
  posted_by?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  items?: StockAdjustmentItem[];
}

export interface StockAdjustmentItem {
  id?: string;
  stock_adjustment_id?: string;
  medicine_id: string;
  batch_id?: string;
  quantity_change: number;
  unit_cost?: number;
  value_change?: number;
  notes?: string;
  medicine?: Medicine;
  batch?: MedicineBatch;
}

export interface ExpiringBatchItem {
  batch_id: string;
  medicine_id: string;
  medicine_name: string;
  product_code: string;
  batch_number: string;
  manufacturing_date?: string;
  expiry_date: string;
  days_to_expiry: number;
  available_quantity: number;
  purchase_cost_per_unit: number;
  stock_value: number;
  supplier_name?: string;
}

export interface ExpiredBatchItem {
  batch_id: string;
  medicine_id: string;
  medicine_name: string;
  product_code: string;
  batch_number: string;
  manufacturing_date?: string;
  expiry_date: string;
  days_expired: number;
  available_quantity: number;
  purchase_cost_per_unit: number;
  stock_value: number;
  supplier_name?: string;
}

export interface AvailableBatch {
  batch_id: string;
  batch_number: string;
  manufacturing_date?: string;
  expiry_date: string;
  available_quantity: number;
  purchase_cost_per_unit: number;
  allocated_quantity: number;
  days_to_expiry: number;
}