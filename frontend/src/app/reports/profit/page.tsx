'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  BarChart3, ArrowLeft, Calendar, Download, RefreshCw, 
  Loader2, TrendingUp, TrendingDown, DollarSign, Percent, 
  Receipt, PieChart as PieIcon, ArrowRight
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ProfitReportResponse, ProfitReportPeriod } from '@/types';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';

export default function ProfitReportPage() {
  const today = new Date();
  const defaultTo = today.toISOString().split('T')[0];
  const defaultFrom = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [groupBy, setGroupBy] = useState<'month' | 'year'>('month');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProfitReportResponse | null>(null);

  useEffect(() => {
    fetchProfitData();
  }, [groupBy]);

  const fetchProfitData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/reports/profit?date_from=${dateFrom}&date_to=${dateTo}&group_by=${groupBy}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load profit report:', err);
      toast.error('Failed to load profit and loss report');
    } finally {
      setLoading(false);
    }
  };

  // Aggregate Totals across all periods
  const periods = data?.periods || [];
  const totalGrossSales = periods.reduce((sum, p) => sum + p.gross_sales, 0);
  const totalDiscounts = periods.reduce((sum, p) => sum + p.discounts, 0);
  const totalNetSales = periods.reduce((sum, p) => sum + p.net_sales, 0);
  const totalCOGS = periods.reduce((sum, p) => sum + p.cogs, 0);
  const totalGrossProfit = periods.reduce((sum, p) => sum + p.gross_profit, 0);
  const totalExpenses = periods.reduce((sum, p) => sum + p.expenses, 0);
  const totalNetProfit = periods.reduce((sum, p) => sum + p.net_profit, 0);

  const overallGrossMargin = totalNetSales > 0 ? Math.round((totalGrossProfit / totalNetSales) * 100) : 0;
  const overallNetMargin = totalNetSales > 0 ? Math.round((totalNetProfit / totalNetSales) * 100) : 0;

  // Chart data
  const chartData = periods.map((p) => ({
    period: formatDate(p.period, { month: 'short', year: 'numeric' }),
    'Net Sales': p.net_sales,
    COGS: p.cogs,
    'Gross Profit': p.gross_profit,
    Expenses: p.expenses,
    'Net Profit': p.net_profit,
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
              <h1 className="text-2xl font-bold tracking-tight">Profit & Loss Statement (P&L)</h1>
              <p className="text-sm text-muted-foreground">
                Revenue, cost of goods sold (COGS), operating expenses, and net profit margins
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchProfitData} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <Label htmlFor="from" className="text-xs text-muted-foreground">From:</Label>
                  <Input
                    id="from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-9 w-36 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="to" className="text-xs text-muted-foreground">To:</Label>
                  <Input
                    id="to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9 w-36 text-xs"
                  />
                </div>
                <Button size="sm" onClick={fetchProfitData} disabled={loading} className="h-9">
                  Calculate Statement
                </Button>
              </div>

              {/* Group By selector */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-xs text-muted-foreground">Interval:</span>
                <div className="inline-flex rounded-md border p-1 bg-muted/40">
                  <button
                    type="button"
                    onClick={() => setGroupBy('month')}
                    className={`px-3 py-1 text-xs rounded-sm transition-all ${
                      groupBy === 'month' ? 'bg-background shadow font-medium text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupBy('year')}
                    className={`px-3 py-1 text-xs rounded-sm transition-all ${
                      groupBy === 'year' ? 'bg-background shadow font-medium text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Yearly
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Executive P&L Waterfall Banner */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          <Card className="border-t-4 border-t-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                1. Net Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{formatCurrency(totalNetSales)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Gross {formatCurrency(totalGrossSales)} - Disc {formatCurrency(totalDiscounts)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-amber-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                2. Cost of Goods Sold (COGS)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalCOGS)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Cost of medicine stock dispensed
              </p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-indigo-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                3. Gross Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">{formatCurrency(totalGrossProfit)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Gross Margin: <span className="font-semibold">{overallGrossMargin}%</span>
              </p>
            </CardContent>
          </Card>

          <Card className={`border-t-4 ${totalNetProfit >= 0 ? 'border-t-emerald-500' : 'border-t-rose-500'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                4. Net Operating Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(totalNetProfit)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Net Margin: <span className="font-semibold">{overallNetMargin}%</span> after {formatCurrency(totalExpenses)} OpEx
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Profit Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financial Trajectory</CardTitle>
            <CardDescription>
              Revenue, Cost of Goods, and Operating Profits over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
                Calculating statement...
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                No financial activity found in the selected period.
              </div>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(val: any) => [formatCurrency(Number(val)), '']}
                      contentStyle={{ borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="Net Sales" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="COGS" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Gross Profit" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Net Profit" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Period Income Statement Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comprehensive Period Statement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Gross Sales</TableHead>
                    <TableHead className="text-right">Discounts</TableHead>
                    <TableHead className="text-right">Net Sales</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Gross Profit</TableHead>
                    <TableHead className="text-center">Gross %</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Net Profit</TableHead>
                    <TableHead className="text-center">Net %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-semibold text-xs">
                        {formatDate(p.period, { month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-muted-foreground">{formatCurrency(p.gross_sales)}</TableCell>
                      <TableCell className="text-right text-xs font-mono text-amber-600">{formatCurrency(p.discounts)}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-medium">{formatCurrency(p.net_sales)}</TableCell>
                      <TableCell className="text-right text-xs font-mono text-amber-700">{formatCurrency(p.cogs)}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-medium text-indigo-600">{formatCurrency(p.gross_profit)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {p.gross_margin_pct}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-rose-600">{formatCurrency(p.expenses)}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold">
                        <span className={p.net_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {formatCurrency(p.net_profit)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="secondary"
                          className={p.net_margin_pct >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}
                        >
                          {p.net_margin_pct}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-bold border-t-2">
                    <TableCell className="text-xs uppercase">Totals</TableCell>
                    <TableCell className="text-right text-xs font-mono">{formatCurrency(totalGrossSales)}</TableCell>
                    <TableCell className="text-right text-xs font-mono text-amber-600">{formatCurrency(totalDiscounts)}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{formatCurrency(totalNetSales)}</TableCell>
                    <TableCell className="text-right text-xs font-mono text-amber-700">{formatCurrency(totalCOGS)}</TableCell>
                    <TableCell className="text-right text-xs font-mono text-indigo-600">{formatCurrency(totalGrossProfit)}</TableCell>
                    <TableCell className="text-center font-mono text-xs">{overallGrossMargin}%</TableCell>
                    <TableCell className="text-right text-xs font-mono text-rose-600">{formatCurrency(totalExpenses)}</TableCell>
                    <TableCell className="text-right text-xs font-mono text-emerald-600">{formatCurrency(totalNetProfit)}</TableCell>
                    <TableCell className="text-center font-mono text-xs">{overallNetMargin}%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
