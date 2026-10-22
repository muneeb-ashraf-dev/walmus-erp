'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Stethoscope, DollarSign, Target, TrendingUp, 
  Calendar, CheckCircle, Clock, AlertTriangle, Loader2, RefreshCw,
  FileText, User, MapPin, Phone, Mail
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Customer, DoctorInvestment } from '@/types';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';

export default function InvestmentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const investmentId = params.id as string;
  const initialCustomerId = searchParams.get('customer_id');

  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [investment, setInvestment] = useState<DoctorInvestment | null>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);

  useEffect(() => {
    loadInvestmentData();
  }, [investmentId]);

  const loadInvestmentData = async () => {
    setLoading(true);
    try {
      let custId = initialCustomerId;
      let currentInv: DoctorInvestment | null = null;

      // 1. If we don't have customer_id, look up through reports
      if (!custId) {
        const reportRes = await api.get('/api/reports/doctor-investments');
        const found = (reportRes.data.doctors || []).find((d: any) => d.investment_id === investmentId);
        if (found) {
          custId = found.customer_id;
          currentInv = {
            id: found.investment_id,
            customer_id: found.customer_id,
            investment_amount: found.investment_amount,
            investment_date: found.investment_date,
            roi_percentage: found.roi_percentage,
            expected_sale: found.expected_sale,
            status: found.status,
            actual_sales: found.actual_sales,
            balance: found.balance,
            achievement_pct: found.achievement_pct,
            created_at: found.investment_date,
            updated_at: found.investment_date,
          };
        }
      }

      if (custId) {
        // Fetch customer details, sales, receipts, and investments
        const [custRes, salesRes, receiptsRes, invsRes] = await Promise.all([
          api.get(`/api/customers/${custId}`),
          api.get(`/api/customers/${custId}/sales`).catch(() => ({ data: [] })),
          api.get(`/api/customers/${custId}/receipts`).catch(() => ({ data: [] })),
          api.get(`/api/customers/${custId}/investments`).catch(() => ({ data: [] })),
        ]);

        setCustomer(custRes.data);
        setSales(Array.isArray(salesRes.data) ? salesRes.data : salesRes.data?.items || []);
        setReceipts(Array.isArray(receiptsRes.data) ? receiptsRes.data : receiptsRes.data?.items || []);

        const invList: DoctorInvestment[] = invsRes.data || [];
        const matched = invList.find((i) => i.id === investmentId) || currentInv;
        setInvestment(matched || null);
      } else {
        toast.error('Could not locate customer for this investment');
      }
    } catch (err) {
      console.error('Failed to load investment detail:', err);
      toast.error('Failed to load investment details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!customer || !investment) return;
    setUpdatingStatus(true);
    try {
      await api.patch(`/api/customers/${customer.id}/investments/${investment.id}`, {
        status: newStatus,
      });
      setInvestment((prev) => prev ? { ...prev, status: newStatus } : null);
      toast.success(`Investment status updated to ${newStatus}`);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      toast.error('Failed to update investment status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Group sales by month for chart
  const monthlySalesChartData = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s) => {
      if (s.invoice_date) {
        const d = new Date(s.invoice_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const total = parseFloat(s.total_amount || 0);
        map.set(key, (map.get(key) || 0) + total);
      }
    });

    const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return entries.map(([month, total]) => ({
      month,
      Sales: total,
    }));
  }, [sales]);

  const totalSalesAmount = useMemo(() => {
    return sales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
  }, [sales]);

  const expectedSale = investment?.expected_sale || 
    (investment && investment.roi_percentage > 0 
      ? investment.investment_amount / (investment.roi_percentage / 100) 
      : 0);

  const achievementPct = expectedSale > 0 
    ? Math.round((totalSalesAmount / expectedSale) * 100) 
    : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
          <p>Loading investment detail...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!investment || !customer) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold">Investment Not Found</h2>
          <p className="text-sm text-muted-foreground">
            The requested investment record could not be found or has been removed.
          </p>
          <Link href="/investments">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Investments
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/investments">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
                <Badge 
                  variant="outline"
                  className={
                    investment.status === 'active'
                      ? 'border-green-300 text-green-700 bg-green-50'
                      : investment.status === 'recovered'
                      ? 'border-blue-300 text-blue-700 bg-blue-50'
                      : 'border-gray-300 text-gray-700 bg-gray-50'
                  }
                >
                  {investment.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Investment Date: {formatDate(investment.investment_date)} • ROI Target: {investment.roi_percentage}%
              </p>
            </div>
          </div>

          {/* Status Actions */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Update Status:</span>
            <Button
              size="sm"
              variant={investment.status === 'active' ? 'default' : 'outline'}
              disabled={updatingStatus || investment.status === 'active'}
              onClick={() => handleStatusChange('active')}
            >
              Active
            </Button>
            <Button
              size="sm"
              variant={investment.status === 'recovered' ? 'default' : 'outline'}
              disabled={updatingStatus || investment.status === 'recovered'}
              onClick={() => handleStatusChange('recovered')}
            >
              Recovered
            </Button>
            <Button
              size="sm"
              variant={investment.status === 'written_off' ? 'default' : 'outline'}
              disabled={updatingStatus || investment.status === 'written_off'}
              onClick={() => handleStatusChange('written_off')}
            >
              Written Off
            </Button>
          </div>
        </div>

        {/* Doctor Summary & KPI Banner */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Investment Principal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(investment.investment_amount)}</div>
              <p className="text-xs text-muted-foreground mt-1">Disbursed Capital</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Target Sales Commitment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatCurrency(expectedSale)}</div>
              <p className="text-xs text-muted-foreground mt-1">Based on {investment.roi_percentage}% ROI</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Actual Sales Realized
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalSalesAmount)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Outstanding: {formatCurrency(Math.max(0, expectedSale - totalSalesAmount))}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Target Achievement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <span className={achievementPct >= 100 ? 'text-emerald-600' : 'text-amber-600'}>
                  {achievementPct}%
                </span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mt-2">
                <div 
                  className="bg-primary h-full rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(achievementPct, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Doctor Profile & Investment Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Doctor Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="font-semibold text-foreground">{customer.name}</p>
              </div>
              {customer.specialty && (
                <div>
                  <p className="text-xs text-muted-foreground">Medical Specialty</p>
                  <p className="font-medium text-foreground">{customer.specialty}</p>
                </div>
              )}
              {customer.area && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Location / Territory</p>
                    <p className="font-medium text-foreground">{customer.area}</p>
                  </div>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium text-foreground">{customer.phone}</p>
                  </div>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium text-foreground">{customer.email}</p>
                  </div>
                </div>
              )}
              <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
                <p>Credit Limit: {formatCurrency(customer.credit_limit || 0)}</p>
                <p>Payment Terms: {customer.payment_terms_days} days</p>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Sales Performance Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Monthly Prescriptions & Sales Performance
              </CardTitle>
              <CardDescription>
                Gross invoice revenue generated from this doctor over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {monthlySalesChartData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-sm">
                  <FileText className="h-8 w-8 mb-2 opacity-40" />
                  No sales invoices recorded yet for this doctor account.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlySalesChartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(val: any) => [formatCurrency(Number(val)), 'Sales']}
                        contentStyle={{ borderRadius: '8px' }}
                      />
                      <Legend />
                      <Bar dataKey="Sales" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Invoices and Recovery Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Recent Sales Invoices</span>
                <Badge variant="outline">{sales.length} Invoices</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sales.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No sales recorded.</p>
              ) : (
                <div className="rounded-md border overflow-x-auto max-h-80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.slice(0, 15).map((inv: any) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                          <TableCell className="text-xs">{formatDate(inv.invoice_date)}</TableCell>
                          <TableCell className="text-right font-medium text-xs">
                            {formatCurrency(inv.total_amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {inv.payment_status || inv.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Receipts / Disbursements Recovery History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Payments & Receipts Realized</span>
                <Badge variant="outline">{receipts.length} Transactions</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {receipts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No receipts recorded.</p>
              ) : (
                <div className="rounded-md border overflow-x-auto max-h-80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipts.slice(0, 15).map((rec: any) => (
                        <TableRow key={rec.id}>
                          <TableCell className="font-mono text-xs">{rec.payment_number || rec.reference_number || 'REC'}</TableCell>
                          <TableCell className="text-xs">{formatDate(rec.payment_date || rec.created_at)}</TableCell>
                          <TableCell className="text-xs capitalize">{rec.payment_method || 'Cash'}</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600 text-xs">
                            {formatCurrency(rec.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
