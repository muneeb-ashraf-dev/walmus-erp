'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Plus, Trash2, Save, Send, AlertTriangle, 
  Layers, User, Calendar, Info, RefreshCw
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MedicineSearchSelect } from '@/components/medicines/medicine-search-select';
import { Customer, Medicine, AvailableBatch } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface SalesLineItem {
  id: string; // client temporary ID
  medicine_id: string;
  batch_id: string;
  quantity_sold: number;
  sale_rate: number;
  discount_percent: number;
  tax_rate: number;
  sale_unit_id?: string | null;
  conversion_factor: number;
  available_batches: AvailableBatch[];
  isLoadingBatches?: boolean;
}

export default function NewSalesInvoicePage() {
  const router = useRouter();

  // References
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoadingRef, setIsLoadingRef] = useState(true);

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Items
  const [items, setItems] = useState<SalesLineItem[]>([
    {
      id: 'item-1',
      medicine_id: '',
      batch_id: '',
      quantity_sold: 1,
      sale_rate: 0,
      discount_percent: 0,
      tax_rate: 0,
      conversion_factor: 1,
      available_batches: [],
    },
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoadingRef(true);
        const [custRes, medRes] = await Promise.all([
          api.get('/api/customers', { params: { limit: 200 } }),
          api.get('/api/medicines', { params: { limit: 500 } }),
        ]);
        setCustomers(custRes.data?.items || custRes.data || []);
        setMedicines(medRes.data?.items || medRes.data || []);
      } catch (err) {
        toast.error('Failed to load customers or medicine list');
      } finally {
        setIsLoadingRef(false);
      }
    }
    loadData();
  }, []);

  const fetchBatchesForLine = async (index: number, medId: string, qty: number) => {
    if (!medId) return;
    try {
      setItems((prev) => {
        const copy = [...prev];
        copy[index] = { ...copy[index], isLoadingBatches: true };
        return copy;
      });

      const res = await api.get('/api/sales/batches/available', {
        params: {
          medicine_id: medId,
          qty_needed: Math.max(qty, 1),
          sale_date: invoiceDate,
        },
      });

      const batches: AvailableBatch[] = res.data || [];

      setItems((prev) => {
        const copy = [...prev];
        const currentItem = copy[index];
        // FEFO allocation: if no batch selected, select the first one (earliest expiry)
        let selectedBatchId = currentItem.batch_id;
        if (!selectedBatchId || !batches.some((b) => b.batch_id === selectedBatchId)) {
          selectedBatchId = batches.length > 0 ? batches[0].batch_id : '';
        }

        copy[index] = {
          ...currentItem,
          available_batches: batches,
          batch_id: selectedBatchId,
          isLoadingBatches: false,
        };
        return copy;
      });
    } catch (err: any) {
      toast.error('Failed to fetch available batches for medicine');
      setItems((prev) => {
        const copy = [...prev];
        copy[index] = { ...copy[index], isLoadingBatches: false, available_batches: [] };
        return copy;
      });
    }
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        medicine_id: '',
        batch_id: '',
        quantity_sold: 1,
        sale_rate: 0,
        discount_percent: 0,
        tax_rate: 0,
        conversion_factor: 1,
        available_batches: [],
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error('At least one line item is required');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMedicineChange = (index: number, medId: string) => {
    const med = medicines.find((m) => m.id === medId);
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        medicine_id: medId,
        sale_rate: med?.default_sale_rate || 0,
        tax_rate: med?.tax_rate || 0,
        sale_unit_id: med?.sale_unit_id || med?.base_unit_id || null,
        conversion_factor: med?.sale_conversion_factor || 1,
        batch_id: '',
        available_batches: [],
      };
      return copy;
    });

    fetchBatchesForLine(index, medId, items[index]?.quantity_sold || 1);
  };

  const handleFieldChange = (index: number, field: keyof SalesLineItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });

    if (field === 'quantity_sold') {
      const medId = items[index]?.medicine_id;
      if (medId) {
        fetchBatchesForLine(index, medId, value);
      }
    }
  };

  // Calculations
  const calculateLine = (item: SalesLineItem) => {
    const rawTotal = (item.quantity_sold || 0) * (item.sale_rate || 0);
    const discAmount = rawTotal * ((item.discount_percent || 0) / 100);
    const taxable = rawTotal - discAmount;
    const taxAmount = taxable * ((item.tax_rate || 0) / 100);
    const lineTotal = taxable + taxAmount;
    return { rawTotal, discAmount, taxAmount, lineTotal };
  };

  const subtotal = items.reduce((acc, it) => acc + calculateLine(it).rawTotal, 0);
  const totalDiscount = items.reduce((acc, it) => acc + calculateLine(it).discAmount, 0);
  const totalTax = items.reduce((acc, it) => acc + calculateLine(it).taxAmount, 0);
  const grandTotal = subtotal - totalDiscount + totalTax;

  const validate = () => {
    if (!customerId) {
      toast.error('Please select a customer');
      return false;
    }
    if (!invoiceDate) {
      toast.error('Please specify the invoice date');
      return false;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.medicine_id) {
        toast.error(`Please select a medicine for line #${i + 1}`);
        return false;
      }
      if (!it.batch_id) {
        toast.error(`Please allocate an active batch for line #${i + 1}`);
        return false;
      }
      if (it.quantity_sold <= 0) {
        toast.error(`Quantity sold must be > 0 for line #${i + 1}`);
        return false;
      }
      const selectedBatch = it.available_batches.find((b) => b.batch_id === it.batch_id);
      if (selectedBatch && it.quantity_sold > selectedBatch.available_quantity) {
        toast.error(
          `Line #${i + 1}: Requested quantity (${it.quantity_sold}) exceeds batch stock (${selectedBatch.available_quantity})`
        );
        return false;
      }
    }
    return true;
  };

  const buildPayload = () => {
    return {
      customer_id: customerId,
      invoice_date: invoiceDate,
      due_date: dueDate || undefined,
      notes: notes.trim() || undefined,
      items: items.map((it) => {
        const calc = calculateLine(it);
        return {
          medicine_id: it.medicine_id,
          batch_id: it.batch_id,
          quantity_sold: Number(it.quantity_sold),
          sale_rate: Number(it.sale_rate),
          discount_percent: Number(it.discount_percent) || 0,
          discount_amount: Number(calc.discAmount.toFixed(2)),
          tax_rate: Number(it.tax_rate) || 0,
          tax_amount: Number(calc.taxAmount.toFixed(2)),
          line_total: Number(calc.lineTotal.toFixed(2)),
          conversion_factor: Number(it.conversion_factor) || 1,
          sale_unit_id: it.sale_unit_id || undefined,
        };
      }),
    };
  };

  const handleSave = async (autoPost: boolean = false) => {
    if (!validate()) return;
    try {
      setIsSubmitting(true);
      const payload = buildPayload();
      const res = await api.post('/api/sales', payload);
      const createdInvoice = res.data;

      if (autoPost) {
        await api.post(`/api/sales/${createdInvoice.id}/post`, { amount_received: 0 });
        toast.success('Sales invoice saved and posted successfully!');
      } else {
        toast.success('Draft sales invoice created');
      }

      router.push(`/sales/${createdInvoice.id}`);
    } catch (error: any) {
      const msg = error?.response?.data?.detail || error?.response?.data?.error?.message || 'Failed to save sales invoice';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-10">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href="/sales">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">New Sales Invoice</h1>
              <p className="text-sm text-muted-foreground">
                First-Expiry-First-Out (FEFO) batch allocation and customer dispatch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={isSubmitting}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
            >
              <Send className="mr-2 h-4 w-4" />
              Post Invoice
            </Button>
          </div>
        </div>

        {/* Invoice Header Details */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Customer & Billing Details</CardTitle>
            <CardDescription>Select customer, dates, and optional dispatch remarks</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Customer */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-foreground">
                Customer <span className="text-destructive">*</span>
              </label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer / pharmacy / clinic..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.area ? `— ${c.area}` : ''} {c.phone ? `(${c.phone})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Invoice Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Invoice Date <span className="text-destructive">*</span>
              </label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Due Date
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5 md:col-span-4">
              <label className="text-xs font-medium text-foreground">
                Invoice Notes / Delivery Instructions
              </label>
              <Input
                placeholder="Optional customer reference or delivery remarks..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Sales Items & FEFO Batches</CardTitle>
              <CardDescription>
                Batches are prioritized by earliest expiration date to comply with GDP guidelines
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={handleAddItem}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-8 text-center">#</TableHead>
                    <TableHead className="min-w-[220px]">Medicine</TableHead>
                    <TableHead className="min-w-[240px]">Batch (FEFO Order)</TableHead>
                    <TableHead className="w-24 text-right">Qty</TableHead>
                    <TableHead className="w-28 text-right">Sale Rate</TableHead>
                    <TableHead className="w-20 text-right">Disc %</TableHead>
                    <TableHead className="w-20 text-right">Tax %</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => {
                    const calc = calculateLine(item);
                    const selectedBatch = item.available_batches.find((b) => b.batch_id === item.batch_id);
                    const isExceedingStock = selectedBatch && item.quantity_sold > selectedBatch.available_quantity;

                    return (
                      <TableRow key={item.id} className="align-top">
                        <TableCell className="text-center font-mono text-xs pt-4">
                          {idx + 1}
                        </TableCell>

                        {/* Medicine Selector */}
                        <TableCell>
                          <MedicineSearchSelect
                            medicines={medicines}
                            value={item.medicine_id}
                            onValueChange={(val) => handleMedicineChange(idx, val)}
                          />
                        </TableCell>

                        {/* Batch Selector (FEFO) */}
                        <TableCell>
                          {item.isLoadingBatches ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground h-9 px-2">
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              Loading FEFO batches...
                            </div>
                          ) : !item.medicine_id ? (
                            <div className="text-xs text-muted-foreground h-9 flex items-center px-2">
                              Select medicine first
                            </div>
                          ) : item.available_batches.length === 0 ? (
                            <div className="text-xs text-destructive h-9 flex items-center px-2 font-medium">
                              No active batches in stock
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Select
                                value={item.batch_id}
                                onValueChange={(val) => handleFieldChange(idx, 'batch_id', val)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select batch..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                  {item.available_batches.map((b, bIdx) => (
                                    <SelectItem key={b.batch_id} value={b.batch_id}>
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="font-mono font-bold">{b.batch_number}</span>
                                        <span>• Exp: {formatDate(b.expiry_date)}</span>
                                        <span className="text-muted-foreground">({b.available_quantity} avail)</span>
                                        {bIdx === 0 && (
                                          <span className="bg-primary/10 text-primary text-[10px] px-1 rounded font-semibold">
                                            FEFO 1st
                                          </span>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {isExceedingStock && (
                                <div className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                                  <AlertTriangle className="h-3 w-3" />
                                  Max avail: {selectedBatch?.available_quantity}
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>

                        {/* Qty */}
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            className="h-9 text-right font-mono"
                            value={item.quantity_sold}
                            onChange={(e) =>
                              handleFieldChange(idx, 'quantity_sold', parseFloat(e.target.value) || 0)
                            }
                          />
                        </TableCell>

                        {/* Sale Rate */}
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-9 text-right font-mono"
                            value={item.sale_rate}
                            onChange={(e) =>
                              handleFieldChange(idx, 'sale_rate', parseFloat(e.target.value) || 0)
                            }
                          />
                        </TableCell>

                        {/* Disc % */}
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            className="h-9 text-right font-mono"
                            value={item.discount_percent}
                            onChange={(e) =>
                              handleFieldChange(idx, 'discount_percent', parseFloat(e.target.value) || 0)
                            }
                          />
                        </TableCell>

                        {/* Tax % */}
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            className="h-9 text-right font-mono"
                            value={item.tax_rate}
                            onChange={(e) =>
                              handleFieldChange(idx, 'tax_rate', parseFloat(e.target.value) || 0)
                            }
                          />
                        </TableCell>

                        {/* Total */}
                        <TableCell className="text-right font-mono text-sm pt-4 font-semibold text-foreground">
                          {formatCurrency(calc.lineTotal)}
                        </TableCell>

                        {/* Remove */}
                        <TableCell className="pt-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="p-3 border-t bg-muted/20">
              <Button size="sm" variant="ghost" onClick={handleAddItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Another Item
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Totals & Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <Card className="bg-muted/10 border-dashed">
            <CardContent className="p-4 space-y-2 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground text-sm flex items-center gap-1.5 mb-1">
                <Info className="h-4 w-4 text-primary" />
                FEFO & Stock Rules
              </div>
              <p>• <strong>FEFO Allocation</strong>: Earliest expiring batches are automatically prioritized to prevent wastage and ensure regulatory compliance.</p>
              <p>• Posting immediately decrements batch stock, generates COGS journal entries, and increases the customer receivable ledger balance.</p>
              <p>• Save Draft if physical goods dispatch is pending verification.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Invoice Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({items.length} items):</span>
                <span className="font-mono font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Discount:</span>
                <span className="font-mono text-green-600 font-medium">-{formatCurrency(totalDiscount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax:</span>
                <span className="font-mono font-medium">+{formatCurrency(totalTax)}</span>
              </div>
              <div className="border-t pt-2.5 flex justify-between text-base font-bold text-foreground">
                <span>Total Amount:</span>
                <span className="font-mono text-primary text-lg">{formatCurrency(grandTotal)}</span>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleSave(false)}
                  disabled={isSubmitting}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Draft
                </Button>
                <Button
                  onClick={() => handleSave(true)}
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {isSubmitting ? 'Posting...' : 'Post Sales Invoice'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
