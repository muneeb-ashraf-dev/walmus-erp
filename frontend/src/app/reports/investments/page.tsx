'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Stethoscope, ArrowLeft, RefreshCw, Loader2, Search, 
  DollarSign, Target, TrendingUp, Award, Eye, ArrowUpRight
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
import { DoctorInvestmentReportResponse, DoctorInvestmentReportItem } from '@/types';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';

export default function DoctorInvestmentsReportPage() {
  const today = new Date();
  const defaultTo = today.toISOString().split('T')[0];
  const defaultFrom = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DoctorInvestmentReportResponse | null>(null);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/reports/doctor-investments?date_from=${dateFrom}&date_to=${dateTo}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load doctor investment report:', err);
      toast.error('Failed to load doctor ROI report');
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = useMemo(() => {
    if (!data?.doctors) return [];
    return data.doctors.filter((doc) => {
      const term = searchTerm.toLowerCase();
      return (
        doc.doctor_name.toLowerCase().includes(term) ||
        (doc.specialty && doc.specialty.toLowerCase().includes(term)) ||
        (doc.area && doc.area.toLowerCase().includes(term))
      );
    });
  }, [data, searchTerm]);

  // Overall statistics
  const totalInvested = data?.total_investment || 0;
  const totalExpected = data?.total_expected || 0;
  const totalActual = data?.total_actual || 0;
  const totalBalance = data?.total_balance || 0;
  const overallAchievement = totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 0;

  // Chart data: Top 10 doctors by expected target
  const chartData = (data?.doctors || [])
    .slice(0, 10)
    .map((doc) => ({
      name: doc.doctor_name.length > 15 ? doc.doctor_name.substring(0, 13) + '..' : doc.doctor_name,
      Target: doc.expected_sale,
      Actual: doc.actual_sales,
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
              <h1 className="text-2xl font-bold tracking-tight">Doctor ROI & Target Performance</h1>
              <p className="text-sm text-muted-foreground">
                Commitment tracking, target vs actual revenue generation, and recovery status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Link href="/investments/new">
              <Button size="sm">
                + New Investment
              </Button>
            </Link>
          </div>
        </div>

        {/* Date Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
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
                <Button size="sm" onClick={fetchReport} disabled={loading} className="h-9">
                  Filter Report
                </Button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search doctor, specialty..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Total Capital Invested
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalInvested)}</div>
              <p className="text-xs text-muted-foreground mt-1">Disbursed to doctor accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Committed Sales Target
              </CardTitle>
              <Target className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">{formatCurrency(totalExpected)}</div>
              <p className="text-xs text-muted-foreground mt-1">Gross prescription expectations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Actual Sales Realized
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalActual)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Outstanding: {formatCurrency(totalBalance)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Overall Achievement
              </CardTitle>
              <Award className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <span className={overallAchievement >= 100 ? 'text-emerald-600' : 'text-amber-600'}>
                  {overallAchievement}%
                </span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mt-2">
                <div 
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(overallAchievement, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Comparison Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Target vs Actual Prescriptions by Doctor</CardTitle>
              <CardDescription>
                Top doctor commitments vs verified sales invoices in the selected date period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip 
                      formatter={(val: any) => [formatCurrency(Number(val)), '']}
                      contentStyle={{ borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="Target" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Actual" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Doctor ROI Ledger Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Doctor Performance Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
                <p>Loading performance data...</p>
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {searchTerm ? 'No doctors match your search query.' : 'No active doctor investments recorded.'}
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor Name</TableHead>
                      <TableHead>Specialty</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead className="text-right">Invested</TableHead>
                      <TableHead className="text-center">ROI %</TableHead>
                      <TableHead className="text-right">Committed Target</TableHead>
                      <TableHead className="text-right">Actual Sales</TableHead>
                      <TableHead className="text-center">Achievement %</TableHead>
                      <TableHead className="text-right">Remaining Balance</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDoctors.map((doc) => (
                      <TableRow key={doc.investment_id}>
                        <TableCell className="font-semibold text-xs text-primary">
                          <Link 
                            href={`/investments/${doc.investment_id}?customer_id=${doc.customer_id}`}
                            className="hover:underline flex items-center gap-1.5"
                          >
                            <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                            {doc.doctor_name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs">{doc.specialty || 'General'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{doc.area || '—'}</TableCell>
                        <TableCell className="text-xs">{formatDate(doc.investment_date)}</TableCell>
                        <TableCell className="text-right text-xs font-mono font-medium">{formatCurrency(doc.investment_amount)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {doc.roi_percentage}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono text-muted-foreground">{formatCurrency(doc.expected_sale)}</TableCell>
                        <TableCell className="text-right text-xs font-mono font-semibold text-emerald-600">{formatCurrency(doc.actual_sales)}</TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="secondary"
                            className={
                              doc.achievement_pct >= 100
                                ? 'bg-emerald-100 text-emerald-800'
                                : doc.achievement_pct >= 50
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }
                          >
                            {doc.achievement_pct}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono font-medium text-amber-700">
                          {formatCurrency(doc.balance)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/investments/${doc.investment_id}?customer_id=${doc.customer_id}`}>
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                              <Eye className="h-3.5 w-3.5 mr-1" /> View
                            </Button>
                          </Link>
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
    </DashboardLayout>
  );
}
