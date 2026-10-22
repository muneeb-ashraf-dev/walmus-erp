'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Package, Calendar, Clock, History, 
  Building2, Pill, RefreshCw, AlertCircle, ArrowUpRight, ArrowDownRight, Tag
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  formatCurrency, 
  formatDate, 
  formatDateTime, 
  getExpiryStatus, 
  getExpiryColor, 
  getExpiryLabel, 
  getStatusColor 
} from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface MovementRecord {
  id: string;
  movement_date: string;
  reason: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reference_type?: string;
  reference_id?: string;
}

interface BatchDetailData {
  id: string;
  medicine_id: string;
  batch_number: string;
  manufacturing_date?: string;
  expiry_date: string;
  supplier_id?: string;
  purchase_invoice_id?: string;
  received_quantity: number;
  available_quantity: number;
  purchase_cost_per_unit: number;
  status: string;
  location: string;
  notes?: string;
  created_at: string;
  medicine?: {
    name: string;
    product_code: string;
    generic_name?: string;
    strength?: string;
    packing_description?: string;
    manufacturer?: { name: string };
  };
  supplier?: {
    name: string;
    phone?: string;
  };
  purchase_invoice?: {
    voucher_number: string;
    invoice_date: string;
  };
  movements: MovementRecord[];
}

export default function BatchDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [batch, setBatch] = useState<BatchDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBatchDetail = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const res = await api.get(`/api/inventory/batches/${id}`);
      setBatch(res.data);
    } catch (err: any) {
      toast.error('Failed to load batch audit details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatchDetail();
  }, [id]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading batch history & audit trail...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!batch) {
    return (
      <DashboardLayout>
        <div className="text-center py-16 space-y-4">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-semibold">Batch not found</h2>
          <Button asChild variant="outline">
            <Link href="/inventory">Back to Inventory</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const expiryStatus = getExpiryStatus(batch.expiry_date);
  const stockValue = Number(batch.available_quantity) * Number(batch.purchase_cost_per_unit);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Navigation Top */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href="/inventory">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Batch #{batch.batch_number}</h1>
                <Badge variant="outline" className={getStatusColor(batch.status)}>
                  {batch.status}
                </Badge>
                <Badge variant="outline" className={getExpiryColor(expiryStatus)}>
                  {getExpiryLabel(expiryStatus)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Storage Location: <span className="font-semibold text-foreground">{batch.location || 'MAIN WAREHOUSE'}</span>
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => fetchBatchDetail()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Trail
          </Button>
        </div>

        {/* 3 Detail Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Medicine Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <Pill className="h-4 w-4 text-primary" />
                Medicine Catalogue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="font-bold text-base text-foreground">
                {batch.medicine?.name || 'Medicine'}
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                Code: {batch.medicine?.product_code || '—'}
              </div>
              {batch.medicine?.generic_name && (
                <div className="text-xs text-muted-foreground">
                  Generic: <span className="text-foreground">{batch.medicine.generic_name}</span>
                </div>
              )}
              {batch.medicine?.strength && (
                <div className="text-xs text-muted-foreground">
                  Strength: <span className="text-foreground">{batch.medicine.strength}</span>
                </div>
              )}
              {batch.medicine?.manufacturer?.name && (
                <div className="text-xs text-muted-foreground">
                  Manufacturer: <span className="text-foreground">{batch.medicine.manufacturer.name}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Batch Specifications */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" />
                Batch Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expiry Date:</span>
                <span className="font-mono font-bold text-foreground">{formatDate(batch.expiry_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mfg Date:</span>
                <span className="text-foreground">
                  {batch.manufacturing_date ? formatDate(batch.manufacturing_date) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supplier:</span>
                <span className="text-foreground font-medium">{batch.supplier?.name || 'Direct Import'}</span>
              </div>
              {batch.purchase_invoice && (
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Purchase Voucher:</span>
                  <Link href={`/purchases/${batch.purchase_invoice_id}`} className="font-mono text-primary hover:underline">
                    {batch.purchase_invoice.voucher_number}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quantities & Value */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-primary" />
                Stock & Valuation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Received Quantity:</span>
                <span className="font-mono font-medium text-foreground">{batch.received_quantity} units</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Available Quantity:</span>
                <span className="font-mono text-primary text-base font-bold">{batch.available_quantity} units</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Purchase Cost / Unit:</span>
                <span className="font-mono">{formatCurrency(batch.purchase_cost_per_unit)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-sm">
                <span>Total Stock Value:</span>
                <span className="font-mono text-green-600">{formatCurrency(stockValue)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Movement History Audit Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Stock Movement History Audit Log
            </CardTitle>
            <CardDescription>
              Chronological log of all transactions impacting this specific batch
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 text-xs">
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Quantity Change</TableHead>
                    <TableHead className="text-right">Before</TableHead>
                    <TableHead className="text-right">After</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!batch.movements || batch.movements.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                        No movement audit records found for this batch
                      </TableCell>
                    </TableRow>
                  ) : (
                    batch.movements.map((m) => {
                      const isPositive = Number(m.quantity_change) > 0;
                      return (
                        <TableRow key={m.id} className="text-xs">
                          <TableCell className="font-mono text-muted-foreground">
                            {formatDateTime(m.movement_date)}
                          </TableCell>
                          <TableCell className="capitalize font-medium text-foreground">
                            {m.reason.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            <span className={`inline-flex items-center gap-0.5 ${isPositive ? 'text-green-600' : 'text-destructive'}`}>
                              {isPositive ? (
                                <ArrowUpRight className="h-3 w-3" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3" />
                              )}
                              {isPositive ? `+${m.quantity_change}` : m.quantity_change}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {m.quantity_before}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-foreground">
                            {m.quantity_after}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {m.reference_type ? (
                              <span className="uppercase text-[11px] bg-muted px-1.5 py-0.5 rounded">
                                {m.reference_type}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
