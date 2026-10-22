'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Package, ArrowLeft, RefreshCw, Loader2, Search, 
  DollarSign, Boxes, Layers, Pill, ArrowUpRight
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { InventoryValuationResponse, InventoryValuationItem } from '@/types';
import toast from 'react-hot-toast';

export default function InventoryValuationReportPage() {
  const [data, setData] = useState<InventoryValuationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchValuation();
  }, []);

  const fetchValuation = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/reports/inventory-valuation');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load inventory valuation:', err);
      toast.error('Failed to load inventory valuation report');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => {
      const term = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(term) ||
        item.product_code.toLowerCase().includes(term) ||
        (item.generic_name && item.generic_name.toLowerCase().includes(term))
      );
    });
  }, [data, searchTerm]);

  const totalBatches = useMemo(() => {
    return (data?.items || []).reduce((sum, item) => sum + item.batch_count, 0);
  }, [data]);

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
              <h1 className="text-2xl font-bold tracking-tight">Inventory Valuation (WAC)</h1>
              <p className="text-sm text-muted-foreground">
                Current stock holding valued at Weighted Average Cost per medicine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchValuation} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh Valuation
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Total Inventory Value
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(data?.grand_total_value || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Weighted purchase cost of active stock</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Total Units on Hand
              </CardTitle>
              <Boxes className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {(data?.grand_total_quantity || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Base physical units available</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Active Medicines
              </CardTitle>
              <Pill className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {(data?.items || []).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">SKUs with positive stock balances</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Active Batches
              </CardTitle>
              <Layers className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{totalBatches}</div>
              <p className="text-xs text-muted-foreground mt-1">Unexpired batches currently in warehouse</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search code, medicine name, generic formula..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="text-xs text-muted-foreground self-end sm:self-auto">
                Showing <strong>{filteredItems.length}</strong> of{' '}
                <strong>{(data?.items || []).length}</strong> stocked products
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valuation Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product Valuation Ledger</CardTitle>
            <CardDescription>
              Unit valuation based on Weighted Average Cost of all batches currently held
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
                <p>Calculating inventory valuation...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {searchTerm ? 'No products match your search.' : 'No active inventory stock held currently.'}
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Code</TableHead>
                      <TableHead>Medicine Name</TableHead>
                      <TableHead>Generic Name</TableHead>
                      <TableHead className="text-center">Batches</TableHead>
                      <TableHead className="text-right">Available Qty</TableHead>
                      <TableHead className="text-right">WAC Cost / Unit</TableHead>
                      <TableHead className="text-right">Total Valuation (PKR)</TableHead>
                      <TableHead className="text-right">% Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const avgUnitCost = item.total_quantity > 0 ? item.total_value / item.total_quantity : 0;
                      const sharePct = data?.grand_total_value && data.grand_total_value > 0
                        ? ((item.total_value / data.grand_total_value) * 100).toFixed(1)
                        : '0.0';

                      return (
                        <TableRow key={item.medicine_id}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {item.product_code}
                          </TableCell>
                          <TableCell className="font-medium text-xs">
                            {item.name}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.generic_name || '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-[11px] font-mono">
                              {item.batch_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-medium">
                            {item.total_quantity.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono text-muted-foreground">
                            {formatCurrency(avgUnitCost)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-bold text-primary">
                            {formatCurrency(item.total_value)}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground font-mono">
                            {sharePct}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
