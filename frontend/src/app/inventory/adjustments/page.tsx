'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Plus, SlidersHorizontal, Trash2, CheckCircle2, 
  History, RefreshCw, AlertCircle, Calendar, ArrowUpRight, ArrowDownRight
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Medicine, MedicineBatch, StockAdjustment } from '@/types';
import { formatCurrency, formatDate, formatDateTime, getStatusColor } from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface AdjustmentItemRow {
  medicine_id: string;
  batch_id: string;
  quantity_change: number;
  unit_cost: number;
  notes: string;
  available_batches: MedicineBatch[];
}

export default function StockAdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // References for dialog
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog Form fields
  const [adjustmentDate, setAdjustmentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [mainReason, setMainReason] = useState('Physical Stock Audit / Discrepancy');
  const [dialogNotes, setDialogNotes] = useState('');
  const [autoPost, setAutoPost] = useState(true);
  const [items, setItems] = useState<AdjustmentItemRow[]>([
    {
      medicine_id: '',
      batch_id: '',
      quantity_change: 0,
      unit_cost: 0,
      notes: '',
      available_batches: [],
    },
  ]);

  // Posting an existing draft adjustment
  const [postingId, setPostingId] = useState<string | null>(null);

  const fetchAdjustments = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/inventory/adjustments');
      setAdjustments(res.data || []);
    } catch (err: any) {
      toast.error('Failed to load stock adjustments');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMedicines = async () => {
    try {
      const res = await api.get('/api/medicines', { params: { limit: 500 } });
      setMedicines(res.data?.items || res.data || []);
    } catch (err) {
      toast.error('Failed to load medicines');
    }
  };

  useEffect(() => {
    fetchAdjustments();
    loadMedicines();
  }, []);

  const handleOpenDialog = () => {
    setAdjustmentDate(new Date().toISOString().split('T')[0]);
    setMainReason('Physical Stock Audit / Discrepancy');
    setDialogNotes('');
    setAutoPost(true);
    setItems([
      {
        medicine_id: '',
        batch_id: '',
        quantity_change: 0,
        unit_cost: 0,
        notes: '',
        available_batches: [],
      },
    ]);
    setIsDialogOpen(true);
  };

  const handleMedicineSelect = async (index: number, medId: string) => {
    try {
      const res = await api.get('/api/inventory/batches', {
        params: { medicine_id: medId, limit: 100 },
      });
      const batches: MedicineBatch[] = res.data?.items || res.data || [];

      setItems((prev) => {
        const copy = [...prev];
        const defaultBatch = batches.length > 0 ? batches[0] : null;
        copy[index] = {
          ...copy[index],
          medicine_id: medId,
          batch_id: defaultBatch ? defaultBatch.id : '',
          unit_cost: defaultBatch ? defaultBatch.purchase_cost_per_unit : 0,
          available_batches: batches,
        };
        return copy;
      });
    } catch (err) {
      toast.error('Failed to load batches for medicine');
    }
  };

  const handleBatchSelect = (index: number, batchId: string) => {
    setItems((prev) => {
      const copy = [...prev];
      const selected = copy[index].available_batches.find((b) => b.id === batchId);
      copy[index] = {
        ...copy[index],
        batch_id: batchId,
        unit_cost: selected ? selected.purchase_cost_per_unit : 0,
      };
      return copy;
    });
  };

  const handleRowChange = (index: number, field: keyof AdjustmentItemRow, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        medicine_id: '',
        batch_id: '',
        quantity_change: 0,
        unit_cost: 0,
        notes: '',
        available_batches: [],
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length <= 1) {
      toast.error('At least one item is required in the adjustment');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitAdjustment = async () => {
    if (!mainReason.trim()) {
      toast.error('Please specify an adjustment reason');
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.medicine_id) {
        toast.error(`Please select a medicine for item #${i + 1}`);
        return;
      }
      if (!it.batch_id) {
        toast.error(`Please select an existing batch for item #${i + 1}`);
        return;
      }
      if (it.quantity_change === 0) {
        toast.error(`Quantity change cannot be zero for item #${i + 1}`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const payload = {
        adjustment_date: adjustmentDate,
        reason: mainReason,
        notes: dialogNotes || undefined,
        items: items.map((it) => ({
          medicine_id: it.medicine_id,
          batch_id: it.batch_id,
          quantity_change: Number(it.quantity_change),
          unit_cost: Number(it.unit_cost) || 0,
          notes: it.notes || undefined,
        })),
      };

      const res = await api.post('/api/inventory/adjustments', payload);
      const createdAdj = res.data;

      if (autoPost) {
        await api.post(`/api/inventory/adjustments/${createdAdj.id}/post`);
        toast.success('Stock adjustment created and applied successfully!');
      } else {
        toast.success('Draft stock adjustment created!');
      }

      setIsDialogOpen(false);
      fetchAdjustments();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error?.message || 'Failed to submit adjustment';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostAdjustment = async (id: string) => {
    try {
      setIsSubmitting(true);
      await api.post(`/api/inventory/adjustments/${id}/post`);
      toast.success('Stock adjustment posted and applied to batches!');
      setPostingId(null);
      fetchAdjustments();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error?.message || 'Failed to post adjustment';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12 max-w-6xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href="/inventory">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Stock Adjustments</h1>
              <p className="text-sm text-muted-foreground">
                Manual stock increases, damage write-downs, sample allocations, and audit balances
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchAdjustments()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={handleOpenDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New Adjustment
            </Button>
          </div>
        </div>

        {/* Adjustments History Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Stock Adjustment Records
            </CardTitle>
            <CardDescription>
              Past stock reconciliation vouchers and audit movements
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Voucher #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Items Count</TableHead>
                  <TableHead className="text-right">Value Change</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Posted At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading adjustment records...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : adjustments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <SlidersHorizontal className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="text-base font-medium">No stock adjustments recorded</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Perform a stock adjustment to correct physical counts or record expired write-downs
                      </p>
                      <Button size="sm" onClick={handleOpenDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Adjustment
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  adjustments.map((adj) => {
                    const isPositive = Number(adj.total_value_change) > 0;
                    return (
                      <TableRow key={adj.id}>
                        <TableCell className="font-mono text-xs font-semibold text-foreground">
                          {adj.adjustment_number}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(adj.adjustment_date)}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {adj.reason}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {adj.total_items}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          <span className={isPositive ? 'text-green-600' : 'text-destructive'}>
                            {isPositive ? `+${formatCurrency(adj.total_value_change)}` : formatCurrency(adj.total_value_change)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(adj.status)}>
                            {adj.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {adj.posted_at ? formatDateTime(adj.posted_at) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {adj.status === 'draft' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-200 hover:bg-green-50 h-8"
                              onClick={() => setPostingId(adj.id)}
                            >
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                              Apply & Post
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground font-medium">Applied</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create Adjustment Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Stock Adjustment</DialogTitle>
              <DialogDescription>
                Adjust batch quantities up or down to synchronize actual physical warehouse counts
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Adjustment Date <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="date"
                    value={adjustmentDate}
                    onChange={(e) => setAdjustmentDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Reason / Category <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Physical inventory variance, Damage, Sampling..."
                    value={mainReason}
                    onChange={(e) => setMainReason(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-medium text-foreground">
                    General Remarks / Notes
                  </label>
                  <Input
                    placeholder="Optional notes or audit reference code..."
                    value={dialogNotes}
                    onChange={(e) => setDialogNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="border rounded-md p-3 space-y-3 bg-muted/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Batches To Adjust
                  </span>
                  <Button size="sm" variant="outline" onClick={handleAddRow} className="h-7 text-xs">
                    <Plus className="mr-1.5 h-3 w-3" />
                    Add Batch
                  </Button>
                </div>

                <div className="space-y-3">
                  {items.map((row, idx) => {
                    const selectedBatch = row.available_batches.find((b) => b.id === row.batch_id);
                    const currentStock = selectedBatch ? selectedBatch.available_quantity : 0;
                    const newStock = currentStock + (row.quantity_change || 0);

                    return (
                      <div
                        key={idx}
                        className="bg-card p-3 rounded-md border grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                      >
                        {/* Medicine */}
                        <div className="md:col-span-4 space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Medicine</label>
                          <Select
                            value={row.medicine_id}
                            onValueChange={(val) => handleMedicineSelect(idx, val)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select medicine..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {medicines.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name} ({m.product_code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Batch Selector */}
                        <div className="md:col-span-3 space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            Batch {selectedBatch ? `(${currentStock} in stock)` : ''}
                          </label>
                          <Select
                            value={row.batch_id}
                            onValueChange={(val) => handleBatchSelect(idx, val)}
                            disabled={!row.medicine_id || row.available_batches.length === 0}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder={row.medicine_id ? 'Select batch...' : 'Select medicine first'} />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {row.available_batches.map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.batch_number} (Exp: {formatDate(b.expiry_date)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Quantity Change (+ or -) */}
                        <div className="md:col-span-2 space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            Change (+ / -)
                          </label>
                          <Input
                            type="number"
                            step="1"
                            className="h-9 font-mono text-right"
                            placeholder="e.g. -5 or 10"
                            value={row.quantity_change}
                            onChange={(e) =>
                              handleRowChange(idx, 'quantity_change', parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>

                        {/* Calculated New Stock Result */}
                        <div className="md:col-span-2 space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            New Stock Level
                          </label>
                          <div
                            className={`h-9 px-3 rounded border flex items-center font-mono text-xs font-bold ${
                              newStock < 0 ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-muted/40 text-foreground'
                            }`}
                          >
                            {newStock} units
                          </div>
                        </div>

                        {/* Delete row */}
                        <div className="md:col-span-1 flex justify-end pb-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRemoveRow(idx)}
                            disabled={items.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Auto Post Checkbox */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="autopost-check"
                  checked={autoPost}
                  onChange={(e) => setAutoPost(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="autopost-check" className="text-xs text-foreground cursor-pointer font-medium">
                  Immediately apply stock changes to inventory master (Auto-post)
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmitAdjustment} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : autoPost ? 'Apply & Post Adjustment' : 'Save as Draft'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Post Confirmation Dialog */}
        <Dialog open={!!postingId} onOpenChange={(open) => !open && setPostingId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply Stock Adjustment</DialogTitle>
              <DialogDescription>
                Posting this adjustment will alter active batch balances and generate inventory movement audit trails immediately.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPostingId(null)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={() => postingId && handlePostAdjustment(postingId)} disabled={isSubmitting}>
                {isSubmitting ? 'Applying...' : 'Confirm & Apply'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
