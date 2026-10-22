'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ShoppingBag, ArrowLeft, Calendar, Download, RefreshCw, 
  Loader2, Filter, TrendingUp, DollarSign, Users, Pill
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { 
  SalesReportResponse, SalesByMedicineItem, SalesByCustomerItem 
} from '@/types';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';

export default function SalesReportPage() {
  const today = new Date();
  const defaultTo = today.toISOString().split('T')[0];
  const defaultFrom = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [groupBy, setGroupBy] = useState<'day' | 'month' | 'year'>('month');

  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<SalesReportResponse | null>(null);
  const [medicineData, setMedicineData] = useState<SalesByMedicineItem[]>([]);
  const [customerData, setCustomerData] = useState<SalesByCustomerItem[]>([]);

  useEffect(() => {
    fetchReportData();
  }, [groupBy]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const [salesRes, medRes, custRes] = await Promise.all([
        api.get(`/api/reports/sales?date_from=${dateFrom}&date_to=${dateTo}&group_by=${groupBy}`),
        api.get(`/api/reports/sales/by-medicine?date_from=${dateFrom}&date_to=${dateTo}&limit=50`).catch(() => ({ data: [] })),
        api.get(`/api/reports/sales/by-customer?date_from=${dateFrom}&date_to=${dateTo}&limit=50`).catch(() => ({ data: [] })),
      ]);

      setSalesData(salesRes.data);
      setMedicineData(Array.isArray(medRes.data) ? medRes.data : []);
      setCustomerData(Array.isArray(custRes.data) ? custRes.data : []);
    } catch (err) {
      console.error('Failed to load sales report:', err);
      toast.error('Failed to load sales report data');
    } finally {
      setLoading(false);
    }
  };

  const chartData = (salesData?.periods || []).map((p) => {
    const periodLabel = p.period ? formatDate(p.period, { month: 'short', year: 'numeric', day: groupBy === 'day' ? 'numeric' : undefined }) : '';
    return {
      period: periodLabel,
      Gross: p.total_sales,
      Net: p.net_sales,
      Discount: p.total_discount,
    };
  });

  const totalGross = salesData?.total_sales || 0;
  const totalDiscount = salesData?.total_discount || 0;
  const netSales = totalGross - totalDiscount;
  const totalInvoices = salesData?.total_invoices || 0;

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
              <h1 className="text-2xl font-bold tracking-tight">Sales Revenue Report</h1>
              <p className="text-sm text-muted-foreground">
                Invoiced revenue performance, trend analysis, product margins, and customer breakdown
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchReportData} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        {/* Date Filters & Group By */}
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
                <Button size="sm" onClick={fetchReportData} disabled={loading} className="h-9">
                  Apply Filter
                </Button>
              </div>

              {/* Group By selector */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-xs text-muted-foreground">Group By:</span>
                <div className="inline-flex rounded-md border p-1 bg-muted/40">
                  <button
                    type="button"
                    onClick={() => setGroupBy('day')}
                    className={`px-3 py-1 text-xs rounded-sm transition-all ${
                      groupBy === 'day' ? 'bg-background shadow font-medium text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupBy('month')}
                    className={`px-3 py-1 text-xs rounded-sm transition-all ${
                      groupBy === 'month' ? 'bg-background shadow font-medium text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupBy('year')}
                    className={`px-3 py-1 text-xs rounded-sm transition-all ${
                      groupBy === 'year' ? 'bg-background shadow font-medium text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Year
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Gross Sales
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalGross)}</div>
              <p className="text-xs text-muted-foreground mt-1">Total invoice face value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Discounts Given
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalDiscount)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalGross > 0 ? `${Math.round((totalDiscount / totalGross) * 100)}% of gross` : '0%'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Net Sales Realized
              </CardTitle>
              <ShoppingBag className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(netSales)}</div>
              <p className="text-xs text-muted-foreground mt-1">Revenue after trade discounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Posted Invoices
              </CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalInvoices}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Avg. Invoice: {formatCurrency(totalInvoices > 0 ? netSales / totalInvoices : 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Trend</CardTitle>
            <CardDescription>
              Gross vs. Net invoice revenue across selected periods ({groupBy})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
                Loading chart...
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                No posted invoices found in the selected date range.
              </div>
            ) : (
              <div className="h-72 w-full">
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
                    <Bar dataKey="Gross" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Net" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabbed Breakdown: Periodic, By Medicine, By Customer */}
        <Tabs defaultValue="periods" className="w-full">
          <TabsList className="grid grid-cols-3 max-w-md">
            <TabsTrigger value="periods">Period Breakdown</TabsTrigger>
            <TabsTrigger value="products">By Product ({medicineData.length})</TabsTrigger>
            <TabsTrigger value="customers">By Customer ({customerData.length})</TabsTrigger>
          </TabsList>

          {/* Period Breakdown */}
          <TabsContent value="periods" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-center">Invoices</TableHead>
                        <TableHead className="text-right">Gross Sales</TableHead>
                        <TableHead className="text-right">Discounts</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                        <TableHead className="text-right">Net Sales</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(salesData?.periods || []).map((p, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-xs">
                            {formatDate(p.period, { month: 'short', year: 'numeric', day: groupBy === 'day' ? 'numeric' : undefined })}
                          </TableCell>
                          <TableCell className="text-center text-xs">{p.invoice_count}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{formatCurrency(p.total_sales)}</TableCell>
                          <TableCell className="text-right text-xs font-mono text-amber-600">{formatCurrency(p.total_discount)}</TableCell>
                          <TableCell className="text-right text-xs font-mono text-muted-foreground">{formatCurrency(p.total_tax)}</TableCell>
                          <TableCell className="text-right text-xs font-mono font-semibold text-emerald-600">{formatCurrency(p.net_sales)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* By Medicine */}
          <TabsContent value="products" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Medicine Name</TableHead>
                        <TableHead>Generic</TableHead>
                        <TableHead className="text-right">Units Sold</TableHead>
                        <TableHead className="text-right">Revenue (PKR)</TableHead>
                        <TableHead className="text-right">COGS</TableHead>
                        <TableHead className="text-right">Gross Profit</TableHead>
                        <TableHead className="text-center">Margin %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {medicineData.map((item) => (
                        <TableRow key={item.medicine_id}>
                          <TableCell className="font-mono text-xs">{item.product_code}</TableCell>
                          <TableCell className="font-medium text-xs">{item.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.generic_name || '—'}</TableCell>
                          <TableCell className="text-right text-xs">{item.units_sold}</TableCell>
                          <TableCell className="text-right text-xs font-mono font-medium">{formatCurrency(item.revenue)}</TableCell>
                          <TableCell className="text-right text-xs font-mono text-muted-foreground">{formatCurrency(item.cogs)}</TableCell>
                          <TableCell className="text-right text-xs font-mono font-semibold text-emerald-600">{formatCurrency(item.gross_profit)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="font-mono text-[11px]">
                              {item.margin_pct}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* By Customer */}
          <TabsContent value="customers" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead className="text-center">Invoices</TableHead>
                        <TableHead className="text-right">Total Sales (PKR)</TableHead>
                        <TableHead className="text-right">Outstanding Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerData.map((item) => (
                        <TableRow key={item.customer_id}>
                          <TableCell className="font-medium text-xs">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-[11px]">
                              {item.customer_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.area || '—'}</TableCell>
                          <TableCell className="text-center text-xs">{item.invoice_count}</TableCell>
                          <TableCell className="text-right text-xs font-mono font-semibold text-emerald-600">
                            {formatCurrency(item.total_sales)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono text-amber-600">
                            {formatCurrency(item.outstanding)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
