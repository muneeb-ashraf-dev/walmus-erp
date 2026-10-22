'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  FileSpreadsheet, ArrowLeft, RefreshCw, Loader2, 
  DollarSign, TrendingUp, TrendingDown, Percent, 
  Receipt, ShoppingCart, ShoppingBag, PieChart as PieIcon
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { MonthlySummaryResponse } from '@/types';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend
} from 'recharts';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function MonthlySummaryReportPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MonthlySummaryResponse | null>(null);

  useEffect(() => {
    fetchMonthlySummary();
  }, [selectedYear, selectedMonth]);

  const fetchMonthlySummary = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/reports/monthly-summary?year=${selectedYear}&month=${selectedMonth}`);
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to load monthly summary:', err);
      toast.error('Failed to load monthly summary');
    } finally {
      setLoading(false);
    }
  };

  const expensePieData = (summary?.expense_categories || []).map((cat) => ({
    name: cat.category,
    value: cat.amount,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/reports">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Monthly Business Summary</h1>
              <p className="text-sm text-muted-foreground">
                Consolidated executive financial statement mirroring the Excel monthly ledger workflow
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchMonthlySummary} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        {/* Month & Year Selectors */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Month:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                    className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 font-medium"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Year:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 font-medium"
                  >
                    {[2024, 2025, 2026, 2027].map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Displaying accounting period:{' '}
                <strong className="text-foreground">
                  {summary?.month_name || MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
            <p>Compiling monthly summary...</p>
          </div>
        ) : summary ? (
          <>
            {/* Executive KPI Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                    Net Sales
                  </CardTitle>
                  <ShoppingBag className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(summary.net_sales)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gross: {formatCurrency(summary.gross_sales)} (Disc: {formatCurrency(summary.discounts)})
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                    Gross Profit
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-indigo-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-600">{formatCurrency(summary.gross_profit)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gross Margin: <span className="font-semibold text-foreground">{summary.gross_margin_pct}%</span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                    Operating Expenses
                  </CardTitle>
                  <Receipt className="h-4 w-4 text-rose-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-rose-600">{formatCurrency(summary.expenses)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across {summary.expense_categories?.length || 0} cost heads
                  </p>
                </CardContent>
              </Card>

              <Card className={`border-2 ${summary.net_profit >= 0 ? 'border-emerald-500/40' : 'border-rose-500/40'}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                    Net Operating Profit
                  </CardTitle>
                  <Percent className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${summary.net_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(summary.net_profit)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Net Margin: <span className="font-semibold">{summary.net_margin_pct}%</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Excel-Style Statement & Expense Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Financial Statement Ledger Table */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    Monthly Financial Ledger Statement
                  </CardTitle>
                  <CardDescription>
                    P&L hierarchy for {summary.month_name} {summary.year}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account / Line Item</TableHead>
                          <TableHead className="text-right">Amount (PKR)</TableHead>
                          <TableHead className="text-right">% of Net Sales</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Gross Sales */}
                        <TableRow>
                          <TableCell className="font-medium text-xs">Gross Invoiced Sales</TableCell>
                          <TableCell className="text-right font-mono text-xs">{formatCurrency(summary.gross_sales)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground font-mono">
                            {summary.net_sales > 0 ? `${((summary.gross_sales / summary.net_sales) * 100).toFixed(1)}%` : '—'}
                          </TableCell>
                        </TableRow>

                        {/* Discounts */}
                        <TableRow className="text-muted-foreground">
                          <TableCell className="pl-6 text-xs italic">Less: Trade & Customer Discounts</TableCell>
                          <TableCell className="text-right font-mono text-xs text-amber-600">({formatCurrency(summary.discounts)})</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground font-mono">
                            {summary.net_sales > 0 ? `${((summary.discounts / summary.net_sales) * 100).toFixed(1)}%` : '—'}
                          </TableCell>
                        </TableRow>

                        {/* Net Sales */}
                        <TableRow className="bg-muted/40 font-semibold border-t">
                          <TableCell className="text-xs">NET SALES REVENUE</TableCell>
                          <TableCell className="text-right font-mono text-xs text-primary">{formatCurrency(summary.net_sales)}</TableCell>
                          <TableCell className="text-right text-xs font-mono">100.0%</TableCell>
                        </TableRow>

                        {/* COGS */}
                        <TableRow className="text-muted-foreground">
                          <TableCell className="pl-6 text-xs italic">Less: Cost of Goods Sold (COGS)</TableCell>
                          <TableCell className="text-right font-mono text-xs text-amber-700">({formatCurrency(summary.cogs)})</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground font-mono">
                            {summary.net_sales > 0 ? `${((summary.cogs / summary.net_sales) * 100).toFixed(1)}%` : '—'}
                          </TableCell>
                        </TableRow>

                        {/* Gross Profit */}
                        <TableRow className="bg-indigo-50/50 dark:bg-indigo-950/20 font-semibold border-t">
                          <TableCell className="text-xs text-indigo-900 dark:text-indigo-300">GROSS PROFIT</TableCell>
                          <TableCell className="text-right font-mono text-xs text-indigo-600">{formatCurrency(summary.gross_profit)}</TableCell>
                          <TableCell className="text-right text-xs font-mono font-bold text-indigo-600">{summary.gross_margin_pct}%</TableCell>
                        </TableRow>

                        {/* Operating Expenses Section */}
                        <TableRow className="border-t">
                          <TableCell colSpan={3} className="font-semibold text-xs text-muted-foreground uppercase pt-3">
                            Operating Expenses Breakdown:
                          </TableCell>
                        </TableRow>
                        {(summary.expense_categories || []).map((cat, idx) => (
                          <TableRow key={idx} className="text-muted-foreground">
                            <TableCell className="pl-6 text-xs">{cat.category}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatCurrency(cat.amount)}</TableCell>
                            <TableCell className="text-right text-xs font-mono">
                              {summary.net_sales > 0 ? `${((cat.amount / summary.net_sales) * 100).toFixed(1)}%` : '—'}
                            </TableCell>
                          </TableRow>
                        ))}

                        {/* Total Expenses */}
                        <TableRow className="font-semibold">
                          <TableCell className="pl-6 text-xs">Total Operating Expenses</TableCell>
                          <TableCell className="text-right font-mono text-xs text-rose-600">({formatCurrency(summary.expenses)})</TableCell>
                          <TableCell className="text-right text-xs font-mono text-rose-600">
                            {summary.net_sales > 0 ? `${((summary.expenses / summary.net_sales) * 100).toFixed(1)}%` : '—'}
                          </TableCell>
                        </TableRow>

                        {/* NET PROFIT */}
                        <TableRow className={`border-t-2 font-bold ${summary.net_profit >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-rose-50 dark:bg-rose-950/30'}`}>
                          <TableCell className="text-sm">NET OPERATING PROFIT</TableCell>
                          <TableCell className={`text-right font-mono text-sm ${summary.net_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatCurrency(summary.net_profit)}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm ${summary.net_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {summary.net_margin_pct}%
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Right Side: Expenses Breakdown Chart & Procurement Summary */}
              <div className="space-y-6">
                {/* Expense Distribution Pie Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <PieIcon className="h-4 w-4 text-primary" />
                      Operating Cost Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {expensePieData.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                        No expenses logged for this month.
                      </div>
                    ) : (
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={expensePieData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={70}
                              innerRadius={35}
                              paddingAngle={2}
                            >
                              {expensePieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Amount']} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Monthly Procurement Inflow */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-emerald-600" />
                      Inward Procurement Inflow
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Gross Purchases Billed:</span>
                      <span className="font-mono font-medium">{formatCurrency(summary.total_purchases)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Supplier Discounts:</span>
                      <span className="font-mono text-emerald-600">{formatCurrency(summary.purchase_discounts)}</span>
                    </div>
                    <div className="flex justify-between py-1 font-semibold">
                      <span>Net Inventory Additions:</span>
                      <span className="font-mono text-primary">{formatCurrency(summary.net_purchases)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
