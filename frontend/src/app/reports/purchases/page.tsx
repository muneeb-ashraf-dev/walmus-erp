'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ShoppingCart, ArrowLeft, Calendar, Download, RefreshCw, 
  Loader2, Filter, TrendingDown, DollarSign, Truck, Tag
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
  PurchaseReportResponse, PurchasesBySupplierItem 
} from '@/types';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';

export default function PurchasesReportPage() {
  const today = new Date();
  const defaultTo = today.toISOString().split('T')[0];
  const defaultFrom = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [groupBy, setGroupBy] = useState<'day' | 'month' | 'year'>('month');

  const [loading, setLoading] = useState(true);
  const [purchaseData, setPurchaseData] = useState<PurchaseReportResponse | null>(null);
  const [supplierData, setSupplierData] = useState<PurchasesBySupplierItem[]>([]);

  useEffect(() => {
    fetchReportData();
  }, [groupBy]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const [purRes, suppRes] = await Promise.all([
        api.get(`/api/reports/purchases?date_from=${dateFrom}&date_to=${dateTo}&group_by=${groupBy}`),
        api.get(`/api/reports/purchases/by-supplier?date_from=${dateFrom}&date_to=${dateTo}&limit=50`).catch(() => ({ data: [] })),
      ]);

      setPurchaseData(purRes.data);
      setSupplierData(Array.isArray(suppRes.data) ? suppRes.data : []);
    } catch (err) {
      console.error('Failed to load purchase report:', err);
      toast.error('Failed to load purchase report data');
    } finally {
      setLoading(false);
    }
  };

  const chartData = (purchaseData?.periods || []).map((p) => {
    const periodLabel = p.period ? formatDate(p.period, { month: 'short', year: 'numeric', day: groupBy === 'day' ? 'numeric' : undefined }) : '';
    return {
      period: periodLabel,
      Purchases: p.total_purchases,
      Discount: p.total_discount,
      Net: p.net_purchases,
    };
  });

  const totalPurchases = purchaseData?.total_purchases || 0;
  const totalDiscount = purchaseData?.total_discount || 0;
  const netPurchases = totalPurchases - totalDiscount;
  const totalInvoices = purchaseData?.total_invoices || 0;

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
              <h1 className="text-2xl font-bold tracking-tight">Purchase Procurement Report</h1>
              <p className="text-sm text-muted-foreground">
                Inward stock procurement volumes, distributor billing, and vendor payables
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
                Gross Purchases
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalPurchases)}</div>
              <p className="text-xs text-muted-foreground mt-1">Vendor invoice subtotal</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Purchase Discounts
              </CardTitle>
              <Tag className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalDiscount)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalPurchases > 0 ? `${Math.round((totalDiscount / totalPurchases) * 100)}% saved` : '0%'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Net Procurement Cost
              </CardTitle>
              <DollarSign className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">{formatCurrency(netPurchases)}</div>
              <p className="text-xs text-muted-foreground mt-1">Net payable to suppliers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Purchase Vouchers
              </CardTitle>
              <Truck className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalInvoices}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Avg. Voucher: {formatCurrency(totalInvoices > 0 ? netPurchases / totalInvoices : 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Purchase Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Procurement Expenditure Trend</CardTitle>
            <CardDescription>
              Purchases billed across selected periods ({groupBy})
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
                No posted purchase invoices found in the selected date range.
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
                    <Bar dataKey="Purchases" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Net" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabbed Breakdown: Periodic vs Supplier */}
        <Tabs defaultValue="periods" className="w-full">
          <TabsList className="grid grid-cols-2 max-w-sm">
            <TabsTrigger value="periods">Period Breakdown</TabsTrigger>
            <TabsTrigger value="suppliers">By Supplier ({supplierData.length})</TabsTrigger>
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
                        <TableHead className="text-center">Vouchers</TableHead>
                        <TableHead className="text-right">Gross Purchases</TableHead>
                        <TableHead className="text-right">Discounts</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                        <TableHead className="text-right">Net Purchases</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(purchaseData?.periods || []).map((p, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-xs">
                            {formatDate(p.period, { month: 'short', year: 'numeric', day: groupBy === 'day' ? 'numeric' : undefined })}
                          </TableCell>
                          <TableCell className="text-center text-xs">{p.invoice_count}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{formatCurrency(p.total_purchases)}</TableCell>
                          <TableCell className="text-right text-xs font-mono text-emerald-600">{formatCurrency(p.total_discount)}</TableCell>
                          <TableCell className="text-right text-xs font-mono text-muted-foreground">{formatCurrency(p.total_tax)}</TableCell>
                          <TableCell className="text-right text-xs font-mono font-semibold text-primary">{formatCurrency(p.net_purchases)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* By Supplier */}
          <TabsContent value="suppliers" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier Name</TableHead>
                        <TableHead className="text-center">Vouchers Count</TableHead>
                        <TableHead className="text-right">Total Purchases (PKR)</TableHead>
                        <TableHead className="text-right">Current Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierData.map((item) => (
                        <TableRow key={item.supplier_id}>
                          <TableCell className="font-medium text-xs flex items-center gap-2">
                            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                            {item.name}
                          </TableCell>
                          <TableCell className="text-center text-xs">{item.invoice_count}</TableCell>
                          <TableCell className="text-right text-xs font-mono font-semibold text-primary">
                            {formatCurrency(item.total_purchases)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-medium text-rose-600">
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
