'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Boxes, Package, AlertTriangle, ShieldAlert, Clock, 
  Search, Filter, RefreshCw, Eye, ArrowUpDown, SlidersHorizontal, ArrowRight
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MedicineBatch, InventorySummary } from '@/types';
import { 
  formatCurrency, 
  formatDate, 
  getExpiryStatus, 
  getExpiryColor, 
  getExpiryLabel, 
  getStatusColor 
} from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function InventoryPage() {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchSummary = async () => {
    try {
      setIsLoadingSummary(true);
      const res = await api.get('/api/inventory/summary');
      setSummary(res.data);
    } catch (err) {
      toast.error('Failed to load inventory summary');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const fetchBatches = async () => {
    try {
      setIsLoadingBatches(true);
      const params: Record<string, any> = {
        limit,
        offset: (page - 1) * limit,
      };
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const res = await api.get('/api/inventory/batches', { params });
      const data = res.data;
      if (data && Array.isArray(data.items)) {
        setBatches(data.items);
        setTotal(data.total || data.items.length);
      } else if (Array.isArray(data)) {
        setBatches(data);
        setTotal(data.length);
      } else {
        setBatches([]);
        setTotal(0);
      }
    } catch (err) {
      toast.error('Failed to load inventory batches');
    } finally {
      setIsLoadingBatches(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [statusFilter, page]);

  const filteredBatches = batches.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.batch_number.toLowerCase().includes(q) ||
      (b.medicine?.name && b.medicine.name.toLowerCase().includes(q)) ||
      (b.medicine?.product_code && b.medicine.product_code.toLowerCase().includes(q))
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inventory & Batch Management</h1>
            <p className="text-sm text-muted-foreground">
              Monitor active pharmaceutical stock batches, expiration risks, and valuation
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/inventory/expiring">
                <Clock className="mr-2 h-4 w-4 text-amber-600" />
                Expiring Stock Report
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/inventory/adjustments">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Stock Adjustments
              </Link>
            </Button>
          </div>
        </div>

        {/* 6 Key Metrics Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Total Products */}
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total Products</span>
                <Boxes className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold font-mono">
                {isLoadingSummary ? '—' : summary?.total_products || 0}
              </div>
              <p className="text-[11px] text-muted-foreground">Active in catalogue</p>
            </CardContent>
          </Card>

          {/* Active Batches */}
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Active Batches</span>
                <Package className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-blue-600">
                {isLoadingSummary ? '—' : summary?.total_batches || 0}
              </div>
              <p className="text-[11px] text-muted-foreground">Stocked & saleable</p>
            </CardContent>
          </Card>

          {/* Saleable Stock Value */}
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Saleable Value</span>
                <span className="text-xs font-bold text-green-600">PKR</span>
              </div>
              <div className="text-lg font-bold font-mono text-green-600 truncate">
                {isLoadingSummary ? '—' : formatCurrency(summary?.saleable_value || 0)}
              </div>
              <p className="text-[11px] text-muted-foreground">At cost value</p>
            </CardContent>
          </Card>

          {/* Quarantined Value */}
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Quarantined</span>
                <ShieldAlert className="h-4 w-4 text-orange-600" />
              </div>
              <div className="text-lg font-bold font-mono text-orange-600 truncate">
                {isLoadingSummary ? '—' : formatCurrency(summary?.quarantined_value || 0)}
              </div>
              <p className="text-[11px] text-muted-foreground">{summary?.quarantined_quantity || 0} units held</p>
            </CardContent>
          </Card>

          {/* Expired Value */}
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Expired Value</span>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div className="text-lg font-bold font-mono text-destructive truncate">
                {isLoadingSummary ? '—' : formatCurrency(summary?.expired_value || 0)}
              </div>
              <p className="text-[11px] text-muted-foreground">{summary?.expired_quantity || 0} expired units</p>
            </CardContent>
          </Card>

          {/* Low Stock Count */}
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Low Stock</span>
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              </div>
              <div className="text-2xl font-bold font-mono text-amber-600">
                {isLoadingSummary ? '—' : summary?.low_stock_count || 0}
              </div>
              <p className="text-[11px] text-muted-foreground">Below reorder level</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Toolbar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search medicine name, code, batch #..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                {['all', 'active', 'quarantined', 'expired', 'depleted'].map((st) => (
                  <Button
                    key={st}
                    variant={statusFilter === st ? 'default' : 'outline'}
                    size="sm"
                    className="capitalize text-xs h-8"
                    onClick={() => {
                      setStatusFilter(st);
                      setPage(1);
                    }}
                  >
                    {st === 'all' ? 'All Batches' : st}
                  </Button>
                ))}

                <Button variant="ghost" size="sm" onClick={() => fetchBatches()} className="h-8 px-2 ml-auto">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Batches Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead className="text-right">Available Qty</TableHead>
                  <TableHead className="text-right">Cost / Unit</TableHead>
                  <TableHead className="text-right">Stock Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingBatches ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading batch inventory...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Boxes className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="text-base font-medium">No inventory batches found</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {search ? 'Try clearing your search query' : 'Receive purchase orders to populate batch stock'}
                      </p>
                      <Button asChild size="sm">
                        <Link href="/purchases/new">Create Purchase</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBatches.map((batch) => {
                    const expiryStatus = getExpiryStatus(batch.expiry_date);
                    const stockValue = (batch.available_quantity || 0) * (batch.purchase_cost_per_unit || 0);

                    return (
                      <TableRow key={batch.id}>
                        <TableCell>
                          <Link
                            href={`/inventory/batches/${batch.id}`}
                            className="font-medium text-foreground hover:underline text-sm block"
                          >
                            {batch.medicine?.name || 'Medicine'}
                          </Link>
                          <span className="font-mono text-xs text-muted-foreground">
                            {batch.medicine?.product_code || ''}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold">
                          <Link href={`/inventory/batches/${batch.id}`} className="hover:underline">
                            {batch.batch_number}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono">{formatDate(batch.expiry_date)}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getExpiryColor(expiryStatus)}`}>
                              {getExpiryLabel(expiryStatus)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          <span className={batch.available_quantity <= 0 ? 'text-muted-foreground' : 'text-foreground'}>
                            {batch.available_quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {formatCurrency(batch.purchase_cost_per_unit)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium text-foreground">
                          {formatCurrency(stockValue)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(batch.status)}>
                            {batch.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/inventory/batches/${batch.id}`}>
                              <Eye className="mr-1.5 h-3.5 w-3.5" />
                              Audit
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-2">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} batches
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </Button>
              <span className="text-xs font-medium px-2">Page {page}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * limit >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
