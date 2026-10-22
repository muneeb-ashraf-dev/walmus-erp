'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, Plus, Search, Filter, Stethoscope, 
  DollarSign, Target, Award, AlertCircle, ArrowUpRight, Loader2, Eye
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DoctorInvestmentReportItem, DoctorInvestmentReportResponse } from '@/types';
import toast from 'react-hot-toast';

export default function DoctorInvestmentsPage() {
  const [data, setData] = useState<DoctorInvestmentReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchInvestments();
  }, []);

  const fetchInvestments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/reports/doctor-investments');
      setData(res.data);
    } catch (err) {
      console.error('Error fetching investments:', err);
      toast.error('Failed to load doctor investments');
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = (data?.doctors || []).filter((doc) => {
    const matchesSearch = 
      doc.doctor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.specialty && doc.specialty.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.area && doc.area.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || doc.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const totalInvested = data?.total_investment || 0;
  const totalActualSales = data?.total_actual || 0;
  const totalExpectedSales = data?.total_expected || 0;
  const totalOutstanding = data?.total_balance || 0;
  const activeCount = (data?.doctors || []).filter(d => d.status === 'active').length;
  const avgAchievement = totalExpectedSales > 0 ? Math.round((totalActualSales / totalExpectedSales) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Doctor Investments & ROI</h1>
            <p className="text-sm text-muted-foreground">
              Track doctor commitments, sales performance, target achievements, and ROI recovery
            </p>
          </div>
          <Link href="/investments/new">
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Add Investment
            </Button>
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalInvested)}</div>
              <p className="text-xs text-muted-foreground mt-1">Capital invested with doctors</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Actual Sales</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalActualSales)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Generated against expected {formatCurrency(totalExpectedSales)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Target Balance Outstanding</CardTitle>
              <Target className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalOutstanding)}</div>
              <p className="text-xs text-muted-foreground mt-1">Remaining sales commitment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Portfolios</CardTitle>
              <Stethoscope className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Avg. Achievement: <span className="font-semibold text-primary">{avgAchievement}%</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Target Achievement Overview Progress */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Portfolio Target Achievement</CardTitle>
                <CardDescription>Overall progress against doctor revenue commitment</CardDescription>
              </div>
              <Badge variant="outline" className="text-sm font-semibold">
                {avgAchievement}% Achieved
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-secondary h-3 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(avgAchievement, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Actual: {formatCurrency(totalActualSales)}</span>
              <span>Target: {formatCurrency(totalExpectedSales)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Filter and Search Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search doctor, specialty, area..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="recovered">Recovered</option>
                  <option value="written_off">Written Off</option>
                </select>
                <Button variant="outline" size="sm" onClick={fetchInvestments} disabled={loading}>
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Investments Table */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Investments Directory</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
                <p>Loading investment records...</p>
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Stethoscope className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <h3 className="text-base font-semibold">No investments found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
                  {searchTerm ? 'No doctors match your search query.' : 'Record your first doctor investment to start tracking sales targets and ROI.'}
                </p>
                <Link href="/investments/new">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Add Investment
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor Name</TableHead>
                      <TableHead>Specialty & Area</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Invested</TableHead>
                      <TableHead className="text-center">ROI %</TableHead>
                      <TableHead className="text-right">Expected Sales</TableHead>
                      <TableHead className="text-right">Actual Sales</TableHead>
                      <TableHead className="text-center">Achievement</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDoctors.map((doc) => (
                      <TableRow key={doc.investment_id}>
                        <TableCell className="font-medium">
                          <Link 
                            href={`/investments/${doc.investment_id}?customer_id=${doc.customer_id}`}
                            className="hover:underline text-primary flex items-center gap-1.5"
                          >
                            <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                            {doc.doctor_name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <span className="font-medium">{doc.specialty || 'General'}</span>
                            {doc.area && <span className="text-muted-foreground block">{doc.area}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatDate(doc.investment_date)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(doc.investment_amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono text-xs">
                            {doc.roi_percentage}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(doc.expected_sale)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          {formatCurrency(doc.actual_sales)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="secondary"
                            className={
                              doc.achievement_pct >= 100 
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                                : doc.achievement_pct >= 50
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }
                          >
                            {doc.achievement_pct}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="outline"
                            className={
                              doc.status === 'active' 
                                ? 'border-green-300 text-green-700 bg-green-50'
                                : doc.status === 'recovered'
                                ? 'border-blue-300 text-blue-700 bg-blue-50'
                                : 'border-gray-300 text-gray-700 bg-gray-50'
                            }
                          >
                            {doc.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/investments/${doc.investment_id}?customer_id=${doc.customer_id}`}>
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              <Eye className="h-4 w-4 mr-1" /> View
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
