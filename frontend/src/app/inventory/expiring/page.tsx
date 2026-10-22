'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, AlertTriangle, Clock, ShieldAlert, 
  Search, RefreshCw, Eye, ArrowUpDown, Filter, AlertCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ExpiringBatchItem, ExpiredBatchItem } from '@/types';
import { formatCurrency, formatDate, getExpiryColor } from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ExpiringStockPage() {
  const [activeTab, setActiveTab] = useState<'critical' | '30days' | '90days' | 'expired'>('critical');
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchStock = async (tab: string) => {
    setIsLoading(true);
    try {
      if (tab === 'expired') {
        const res = await api.get('/api/inventory/expired');
        setItems(res.data || []);
      } else if (tab === 'critical') {
        const res = await api.get('/api/inventory/expiring', { params: { days: 7 } });
        setItems(res.data || []);
      } else if (tab === '30days') {
        const res = await api.get('/api/inventory/expiring', { params: { days: 30 } });
        // filter 8 - 30 days
        const filtered = (res.data || []).filter((b: ExpiringBatchItem) => b.days_to_expiry > 7);
        setItems(filtered);
      } else if (tab === '90days') {
        const res = await api.get('/api/inventory/expiring', { params: { days: 90 } });
        // filter 31 - 90 days
        const filtered = (res.data || []).filter((b: ExpiringBatchItem) => b.days_to_expiry > 30);
        setItems(filtered);
      }
    } catch (err: any) {
      toast.error('Failed to load expiry inventory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStock(activeTab);
  }, [activeTab]);

  const filteredItems = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.medicine_name.toLowerCase().includes(q) ||
      item.product_code.toLowerCase().includes(q) ||
      item.batch_number.toLowerCase().includes(q)
    );
  });

  const totalValueAtRisk = filteredItems.reduce((acc, it) => acc + (it.stock_value || 0), 0);
  const totalUnits = filteredItems.reduce((acc, it) => acc + (it.available_quantity || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href="/inventory">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Expiring & Expired Stock Report</h1>
              <p className="text-sm text-muted-foreground">
                First-Expiry-First-Out (FEFO) audit to minimize pharmaceutical write-offs
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => fetchStock(activeTab)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Metric Alert Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Batches in Current View</span>
              <div className="text-2xl font-bold font-mono">{filteredItems.length}</div>
              <p className="text-[11px] text-muted-foreground">Individual lot identifiers</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Total Units At Risk</span>
              <div className="text-2xl font-bold font-mono text-orange-600">{totalUnits}</div>
              <p className="text-[11px] text-muted-foreground">Immediate disposal / sales priority</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-destructive">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Value At Risk (At Cost)</span>
              <div className="text-2xl font-bold font-mono text-destructive truncate">
                {formatCurrency(totalValueAtRisk)}
              </div>
              <p className="text-[11px] text-muted-foreground">Potential financial write-off value</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs & Search */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Tabs
              value={activeTab}
              onValueChange={(val: any) => setActiveTab(val)}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid grid-cols-4 w-full sm:w-auto">
                <TabsTrigger value="critical" className="text-xs">
                  ≤ 7 days
                </TabsTrigger>
                <TabsTrigger value="30days" className="text-xs">
                  8 - 30 days
                </TabsTrigger>
                <TabsTrigger value="90days" className="text-xs">
                  31 - 90 days
                </TabsTrigger>
                <TabsTrigger value="expired" className="text-xs text-destructive">
                  Expired
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search medicine, batch..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Batches Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Medicine Name</TableHead>
                    <TableHead>Batch #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>
                      {activeTab === 'expired' ? 'Days Expired' : 'Days Until Expiry'}
                    </TableHead>
                    <TableHead className="text-right">Available Qty</TableHead>
                    <TableHead className="text-right">Cost / Unit</TableHead>
                    <TableHead className="text-right">Stock Value</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Loading expiry audit...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12">
                        <Clock className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                        <p className="text-base font-medium">No batches matching this expiry window</p>
                        <p className="text-sm text-muted-foreground">
                          All stocks in this category are healthy or already disposed of.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => {
                      const isExpired = activeTab === 'expired';
                      const daysText = isExpired
                        ? `${item.days_expired} days ago`
                        : `${item.days_to_expiry} days`;

                      return (
                        <TableRow key={item.batch_id} className="text-xs">
                          <TableCell>
                            <Link
                              href={`/inventory/batches/${item.batch_id}`}
                              className="font-medium text-foreground hover:underline block text-sm"
                            >
                              {item.medicine_name}
                            </Link>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {item.product_code}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono font-bold text-foreground">
                            {item.batch_number}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.supplier_name || '—'}
                          </TableCell>
                          <TableCell className="font-mono font-medium">
                            {formatDate(item.expiry_date)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                isExpired
                                  ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40'
                                  : activeTab === 'critical'
                                  ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40'
                                  : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40'
                              }
                            >
                              {daysText}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-sm">
                            {item.available_quantity}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {formatCurrency(item.purchase_cost_per_unit)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-destructive">
                            {formatCurrency(item.stock_value)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="ghost" size="sm" className="h-8">
                              <Link href={`/inventory/batches/${item.batch_id}`}>
                                <Eye className="h-3.5 w-3.5 mr-1" />
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
        </div>
      </div>
    </DashboardLayout>
  );
}
