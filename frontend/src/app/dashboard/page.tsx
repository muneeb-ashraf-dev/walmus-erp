'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, Users, AlertTriangle, 
  ShoppingCart, CreditCard, Banknote, Pill, Receipt, AlertCircle,
  ChevronRight, Plus
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  DashboardSummary, 
  DashboardChartData, 
  ExpiryAlertSummary, 
  LowStockItem, 
  QuickActionItem 
} from '@/types';
import { cn, formatCurrency, formatNumber, getExpiryColor, getExpiryLabel } from '@/lib/utils';
import { api } from '@/lib/api';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

interface DashboardData {
  summary: DashboardSummary;
  salesPurchasesChart: DashboardChartData;
  grossProfitChart: DashboardChartData;
  salesByProductChart: DashboardChartData;
  expensesByCategoryChart: DashboardChartData;
  expiryDistributionChart: DashboardChartData;
  expiryAlerts: ExpiryAlertSummary;
  lowStock: LowStockItem[];
  quickActions: QuickActionItem[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [
        summaryRes,
        salesPurchasesRes,
        grossProfitRes,
        salesByProductRes,
        expensesByCategoryRes,
        expiryDistRes,
        expiryAlertsRes,
        lowStockRes,
        quickActionsRes,
      ] = await Promise.all([
        api.get('/api/dashboard/summary'),
        api.get('/api/dashboard/charts/sales-purchases?months=12'),
        api.get('/api/dashboard/charts/gross-profit?months=12'),
        api.get('/api/dashboard/charts/sales-by-product?limit=8'),
        api.get('/api/dashboard/charts/expenses-by-category?months=12'),
        api.get('/api/dashboard/charts/expiry-distribution'),
        api.get('/api/dashboard/expiry-alerts'),
        api.get('/api/dashboard/low-stock?limit=10'),
        api.get('/api/dashboard/quick-actions'),
      ]);

      setData({
        summary: summaryRes.data,
        salesPurchasesChart: salesPurchasesRes.data,
        grossProfitChart: grossProfitRes.data,
        salesByProductChart: salesByProductRes.data,
        expensesByCategoryChart: expensesByCategoryRes.data,
        expiryDistributionChart: expiryDistRes.data,
        expiryAlerts: expiryAlertsRes.data,
        lowStock: lowStockRes.data,
        quickActions: quickActionsRes.data,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Dashboard</h1>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}><CardContent className="h-24 animate-pulse" /></Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const summary = data?.summary;
  const quickActions = data?.quickActions || [];

  const SummaryCard = ({ 
    title, 
    value, 
    icon: Icon, 
    trend, 
    trendUp = true,
    color = 'text-primary',
    bgColor = 'bg-primary/10',
  }: { 
    title: string; 
    value: string; 
    icon: React.ComponentType<{ className?: string }>;
    trend?: string;
    trendUp?: boolean;
    color?: string;
    bgColor?: string;
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-muted-foreground" title={title}>
              {title}
            </p>
            <p className="mt-1 truncate text-2xl font-bold" title={value}>
              {value}
            </p>
            {trend && (
              <p
                className={cn(
                  'mt-1 flex min-w-0 items-center gap-1 text-sm',
                  trendUp ? 'text-green-600' : 'text-red-600'
                )}
              >
                <TrendingUp className="h-3 w-3 shrink-0" />
                <span className="truncate">{trend}</span>
              </p>
            )}
          </div>
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
              bgColor
            )}
          >
            <Icon className={cn('h-6 w-6', color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const quickActionIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    ShoppingCart,
    TrendingUp,
    Package,
    Users,
    CreditCard,
    Banknote,
    Receipt,
    Pill,
  };

  const ChartCard = ({ title, children, chart }: { title: string; children?: React.ReactNode; chart?: React.ReactNode }) => (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">{children || chart}</div>
      </CardContent>
    </Card>
  );

  const ExpiryAlertCard = ({ alert }: { alert: any }) => (
    <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
      <div className="flex items-center gap-3">
        <Badge variant={alert.tier as any} className={getExpiryColor(alert.tier)}>
          {getExpiryLabel(alert.tier)}
        </Badge>
        <div>
          <p className="font-medium">{alert.label}</p>
          <p className="text-sm text-muted-foreground">{alert.batch_count} batches • {formatNumber(alert.total_quantity)} units</p>
        </div>
      </div>
      <span className="font-medium">{formatCurrency(alert.total_value)}</span>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your pharmaceutical business</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/reports">View Reports</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sales/new">
                <Plus className="mr-2 h-4 w-4" />
                New Sale
              </Link>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <SummaryCard
            title="Today's Sales"
            value={formatCurrency(summary?.today_sales || 0)}
            icon={ShoppingCart}
            color="text-green-600"
            bgColor="bg-green-100 dark:bg-green-900/30"
          />
          <SummaryCard
            title="This Month Sales"
            value={formatCurrency(summary?.month_sales || 0)}
            icon={TrendingUp}
            color="text-blue-600"
            bgColor="bg-blue-100 dark:bg-blue-900/30"
          />
          <SummaryCard
            title="Gross Profit (Month)"
            value={formatCurrency(summary?.month_gross_profit || 0)}
            icon={DollarSign}
            color="text-emerald-600"
            bgColor="bg-emerald-100 dark:bg-emerald-900/30"
          />
          <SummaryCard
            title="Net Profit (Month)"
            value={formatCurrency(summary?.net_operating_profit || 0)}
            trend={summary && summary.net_operating_profit >= 0 ? 'Positive' : 'Negative'}
            trendUp={summary ? summary.net_operating_profit >= 0 : true}
            icon={TrendingUp}
            color="text-purple-600"
            bgColor="bg-purple-100 dark:bg-purple-900/30"
          />
          <SummaryCard
            title="Inventory Value"
            value={formatCurrency(summary?.inventory_value || 0)}
            icon={Package}
            color="text-orange-600"
            bgColor="bg-orange-100 dark:bg-orange-900/30"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Receivables"
            value={formatCurrency(summary?.total_receivables || 0)}
            trend={summary && summary.overdue_receivables > 0 ? `${formatCurrency(summary.overdue_receivables)} overdue` : undefined}
            trendUp={false}
            icon={Users}
            color="text-blue-600"
            bgColor="bg-blue-100 dark:bg-blue-900/30"
          />
          <SummaryCard
            title="Payables"
            value={formatCurrency(summary?.total_payables || 0)}
            trend={summary && summary.overdue_payables > 0 ? `${formatCurrency(summary.overdue_payables)} overdue` : undefined}
            trendUp={false}
            icon={CreditCard}
            color="text-red-600"
            bgColor="bg-red-100 dark:bg-red-900/30"
          />
          <SummaryCard
            title="Cash & Bank"
            value={formatCurrency(summary?.cash_bank_balance || 0)}
            icon={Banknote}
            color="text-green-600"
            bgColor="bg-green-100 dark:bg-green-900/30"
          />
          <SummaryCard
            title="Low Stock Items"
            value={summary?.low_stock_count?.toString() || '0'}
            icon={AlertTriangle}
            color="text-amber-600"
            bgColor="bg-amber-100 dark:bg-amber-900/30"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Expiring (≤30 days)"
            value={data?.expiryAlerts?.alerts.find(a => a.tier === 'expiring_30')?.batch_count.toString() || '0'}
            trend={`${data?.expiryAlerts?.alerts.find(a => a.tier === 'expiring_30')?.total_quantity || 0} units`}
            icon={AlertCircle}
            color="text-amber-600"
            bgColor="bg-amber-100 dark:bg-amber-900/30"
          />
          <SummaryCard
            title="Critical (≤7 days)"
            value={data?.expiryAlerts?.alerts.find(a => a.tier === 'critical')?.batch_count.toString() || '0'}
            icon={AlertTriangle}
            color="text-orange-600"
            bgColor="bg-orange-100 dark:bg-orange-900/30"
          />
          <SummaryCard
            title="Expired"
            value={summary?.expired_batches_count?.toString() || '0'}
            trend={formatCurrency(summary?.expired_batches_value || 0)}
            trendUp={false}
            icon={AlertCircle}
            color="text-red-600"
            bgColor="bg-red-100 dark:bg-red-900/30"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Sales vs Purchases (12 Months)">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data?.salesPurchasesChart?.datasets[0]?.data || []}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(val: any) => formatCurrency(Number(val))} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), 'PKR']} />
                <Legend />
                <Area type="monotone" dataKey="Sales" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="Purchases" stroke="#ef4444" fillOpacity={1} fill="url(#colorPurchases)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Gross Profit Trend (12 Months)">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data?.grossProfitChart?.datasets[0]?.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(val: any) => formatCurrency(Number(val))} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), 'PKR']} />
                <Line type="monotone" dataKey="Gross Profit" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Top Products by Sales">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.salesByProductChart?.datasets[0]?.data || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(val: any) => formatCurrency(Number(val))} />
                <YAxis type="category" dataKey="label" width={120} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), 'PKR']} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Expenses by Category">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data?.expensesByCategoryChart?.datasets[0]?.data || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="label"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {data?.expensesByCategoryChart?.datasets[0]?.data?.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [formatCurrency(value), 'PKR']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Charts Row 3 */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Expiry Risk Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.expiryDistributionChart?.datasets[0]?.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => [value, 'Batches']} />
                <Bar dataKey="Batch Count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Expiry Value Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.expiryDistributionChart?.datasets[1]?.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(val: any) => formatCurrency(Number(val))} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), 'PKR']} />
                <Bar dataKey="Value (PKR)" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Expiry Alerts & Low Stock */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Expiry Alerts</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/inventory/expiring">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data?.expiryAlerts?.alerts.map((alert) => (
                  <ExpiryAlertCard key={alert.tier} alert={alert} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card id="low-stock" className="scroll-mt-20">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Low Stock Items</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/inventory?low_stock=true">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data?.lowStock?.map((item) => (
                  <div key={item.medicine_id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.product_code} • Reorder: {item.reorder_level}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-amber-600">{formatNumber(item.current_stock)} units</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(item.stock_value)}</p>
                    </div>
                  </div>
                ))}
                {(!data?.lowStock || data.lowStock.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">No low stock items</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
              {quickActions.map((action) => {
                const IconComponent = quickActionIconMap[action.icon] || Pill;
                return (
                  <Link key={action.label} href={action.href}>
                    <Button
                      variant="outline"
                      className="flex flex-col items-center gap-2 h-24 w-full"
                    >
                      <IconComponent className={cn('h-6 w-6', `text-${action.color}-600`)} />
                      <span className="text-sm font-medium">{action.label}</span>
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}