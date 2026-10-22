'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Plus, Trash2, Save, Send, AlertCircle, ShoppingCart, Calendar, Building
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Supplier, Medicine } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface PurchaseLineItem {
  id: string; // client temporary ID
  medicine_id: string;
  batch_number: string;
  manufacturing_date: string;
  expiry_date: string;
  quantity_received: number;
  purchase_unit_id?: string | null;
  conversion_factor: number;
  purchase_rate: number;
  discount_percent: number;
  tax_rate: number;
}

export default function NewPurchasePage() {
  const router = useRouter();

  // Reference data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoadingRefData, setIsLoadingRefData] = useState(true);

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Line Items
  const [items, setItems] = useState<PurchaseLineItem[]>([
    {
      id: 'item-1',
      medicine_id: '',
      batch_number: '',
      manufacturing_date: '',
      expiry_date: '',
      quantity_received: 1,
      purchase_rate: 0,
      discount_percent: 0,
      tax_rate: 0,
      conversion_factor: 1,
    },
  ]);

  // Load suppliers & medicines
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoadingRefData(true);
        const [suppliersRes, medicinesRes] = await Promise.all([
          api.get('/api/suppliers', { params: { limit: 200 } }),
          api.get('/api/medicines', { params: { limit: 500 } }),
        ]);

        const supps = suppliersRes.data?.items || suppliersRes.data || [];
        const meds = medicinesRes.data?.items || medicinesRes.data || [];
        setSuppliers(supps);
        setMedicines(meds);
      } catch (err) {
        toast.error('Failed to load suppliers or medicine catalog');
      } finally {
        setIsLoadingRefData(false);
      }
    }
    loadData();
  }, []);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        medicine_id: '',
        batch_number: '',
        manufacturing_date: '',
        expiry_date: '',
        quantity_received: 1,
        purchase_rate: 0,
        discount_percent: 0,
        tax_rate: 0,
        conversion_factor: 1,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error('At least one item is required in the purchase invoice');
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
        purchase_rate: med?.default_purchase_rate || 0,
        tax_rate: med?.tax_rate || 0,
        purchase_unit_id: med?.purchase_unit_id || med?.base_unit_id || null,
        conversion_factor: med?.purchase_conversion_factor || 1,
      };
      return copy;
    });
  };

  const handleItemFieldChange = (
    index: number,
    field: keyof PurchaseLineItem,
    value: any
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: value,
      };
      return copy;
    });
  };

  // Line Calculations
  const calculateLine = (item: PurchaseLineItem) => {
    const rawTotal = (item.quantity_received || 0) * (item.purchase_rate || 0);
    const discAmount = rawTotal * ((item.discount_percent || 0) / 100);
    const taxable = rawTotal - discAmount;
    const taxAmount = taxable * ((item.tax_rate || 0) / 100);
    const lineTotal = taxable + taxAmount;
    return {
      rawTotal,
      discAmount,
      taxAmount,
      lineTotal,
    };
  };

  // Totals
  const subtotal = items.reduce((acc, it) => acc + calculateLine(it).rawTotal, 0);
  const totalDiscount = items.reduce((acc, it) => acc + calculateLine(it).discAmount, 0);
  const totalTax = items.reduce((acc, it) => acc + calculateLine(it).taxAmount, 0);
  const grandTotal = subtotal - totalDiscount + totalTax;

  const validateForm = () => {
    if (!supplierId) {
      toast.error('Please select a supplier');
      return false;
    }
    if (!invoiceDate) {
      toast.error('Please enter invoice date');
      return false;
    }
    if (items.length === 0) {
      toast.error('Please add at least one line item');
      return false;
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.medicine_id) {
        toast.error(`Please select a medicine for item #${i + 1}`);
        return false;
      }
      if (!item.batch_number.trim()) {
        toast.error(`Batch number is required for item #${i + 1}`);
        return false;
      }
      if (!item.expiry_date) {
        toast.error(`Expiry date is required for item #${i + 1}`);
        return false;
      }
      if (item.manufacturing_date && item.expiry_date <= item.manufacturing_date) {
        toast.error(`Expiry date must be after manufacturing date for item #${i + 1}`);
        return false;
      }
      if (item.quantity_received <= 0) {
        toast.error(`Quantity must be greater than zero for item #${i + 1}`);
        return false;
      }
      if (item.purchase_rate < 0) {
        toast.error(`Purchase rate cannot be negative for item #${i + 1}`);
        return false;
      }
    }
    return true;
  };

  const buildPayload = () => {
    return {
      supplier_id: supplierId,
      supplier_invoice_number: supplierInvoiceNumber.trim() || undefined,
      invoice_date: invoiceDate,
      due_date: dueDate || undefined,
      notes: notes.trim() || undefined,
      items: items.map((it) => {
        const calc = calculateLine(it);
        return {
          medicine_id: it.medicine_id,
          batch_number: it.batch_number.trim(),
          manufacturing_date: it.manufacturing_date || undefined,
          expiry_date: it.expiry_date,
          quantity_received: Number(it.quantity_received),
          purchase_unit_id: it.purchase_unit_id || undefined,
          conversion_factor: Number(it.conversion_factor) || 1,
          purchase_rate: Number(it.purchase_rate),
          discount_percent: Number(it.discount_percent) || 0,
          discount_amount: Number(calc.discAmount.toFixed(2)),
          tax_rate: Number(it.tax_rate) || 0,
          tax_amount: Number(calc.taxAmount.toFixed(2)),
          line_total: Number(calc.lineTotal.toFixed(2)),
        };
      }),
    };
  };

  const handleSave = async (autoPost: boolean = false) => {
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      const payload = buildPayload();
      const res = await api.post('/api/purchases', payload);
      const createdInvoice = res.data;

      if (autoPost) {
        await api.post(`/api/purchases/${createdInvoice.id}/post`, { amount_paid: 0 });
        toast.success('Purchase invoice saved and posted successfully!');
      } else {
        toast.success('Draft purchase invoice saved!');
      }

      router.push(`/purchases/${createdInvoice.id}`);
    } catch (error: any) {
      const msg = error?.response?.data?.detail || error?.response?.data?.error?.message || 'Failed to save purchase invoice';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-10">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href="/purchases">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">New Purchase Invoice</h1>
              <p className="text-sm text-muted-foreground">
                Enter supplier invoice details, medicine batches, quantities and costs
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
              Save & Post
            </Button>
          </div>
        </div>

        {/* Invoice Header Details */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Invoice Information</CardTitle>
            <CardDescription>Select the supplier and enter the primary invoice credentials</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Supplier Selector */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-foreground">
                Supplier <span className="text-destructive">*</span>
              </label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${s.phone})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Supplier Inv # */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Supplier Invoice / Bill #
              </label>
              <Input
                placeholder="e.g. INV-9981"
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
              />
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
                Payment Due Date
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5 md:col-span-3">
              <label className="text-xs font-medium text-foreground">
                Internal Remarks / Notes
              </label>
              <Input
                placeholder="Optional notes, delivery vehicle info, terms..."
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
              <CardTitle className="text-base font-semibold">Medicine Line Items</CardTitle>
              <CardDescription>Each item creates or increments inventory batch stock upon posting</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={handleAddItem}>
              <Plus className="mr-2 h-4 w-4" />
              Add Row
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-8 text-center">#</TableHead>
                    <TableHead className="min-w-[200px]">Medicine</TableHead>
                    <TableHead className="min-w-[120px]">Batch #</TableHead>
                    <TableHead className="min-w-[130px]">Mfg Date</TableHead>
                    <TableHead className="min-w-[130px]">Expiry Date</TableHead>
                    <TableHead className="w-24 text-right">Qty</TableHead>
                    <TableHead className="w-28 text-right">Rate (PKR)</TableHead>
                    <TableHead className="w-20 text-right">Disc %</TableHead>
                    <TableHead className="w-20 text-right">Tax %</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => {
                    const calc = calculateLine(item);
                    return (
                      <TableRow key={item.id} className="align-top">
                        <TableCell className="text-center font-mono text-xs pt-4">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <MedicineSearchSelect
                            medicines={medicines}
                            value={item.medicine_id}
                            onValueChange={(val) => handleMedicineChange(idx, val)}
                          />
                        </TableCell>

                        {/* Batch Number */}
                        <TableCell>
                          <Input
                            placeholder="e.g. B-0129"
                            className="h-9 font-mono uppercase"
                            value={item.batch_number}
                            onChange={(e) => handleItemFieldChange(idx, 'batch_number', e.target.value)}
                          />
                        </TableCell>

                        {/* Mfg Date */}
                        <TableCell>
                          <Input
                            type="date"
                            className="h-9 text-xs"
                            value={item.manufacturing_date}
                            onChange={(e) => handleItemFieldChange(idx, 'manufacturing_date', e.target.value)}
                          />
                        </TableCell>

                        {/* Expiry Date */}
                        <TableCell>
                          <Input
                            type="date"
                            className="h-9 text-xs"
                            value={item.expiry_date}
                            onChange={(e) => handleItemFieldChange(idx, 'expiry_date', e.target.value)}
                          />
                        </TableCell>

                        {/* Quantity */}
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            className="h-9 text-right font-mono"
                            value={item.quantity_received}
                            onChange={(e) =>
                              handleItemFieldChange(idx, 'quantity_received', parseFloat(e.target.value) || 0)
                            }
                          />
                        </TableCell>

                        {/* Rate */}
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-9 text-right font-mono"
                            value={item.purchase_rate}
                            onChange={(e) =>
                              handleItemFieldChange(idx, 'purchase_rate', parseFloat(e.target.value) || 0)
                            }
                          />
                        </TableCell>

                        {/* Discount % */}
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            className="h-9 text-right font-mono"
                            value={item.discount_percent}
                            onChange={(e) =>
                              handleItemFieldChange(idx, 'discount_percent', parseFloat(e.target.value) || 0)
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
                              handleItemFieldChange(idx, 'tax_rate', parseFloat(e.target.value) || 0)
                            }
                          />
                        </TableCell>

                        {/* Calculated Line Total */}
                        <TableCell className="text-right font-mono text-sm pt-4 font-semibold text-foreground">
                          {formatCurrency(calc.lineTotal)}
                        </TableCell>

                        {/* Delete row */}
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
                Add Another Medicine Item
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Calculation Summary Footer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <Card className="bg-muted/10 border-dashed">
            <CardContent className="p-4 space-y-2 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground text-sm flex items-center gap-1.5 mb-1">
                <AlertCircle className="h-4 w-4 text-primary" />
                Purchase Posting Rules
              </div>
              <p>• Saving as <strong>Draft</strong> keeps the purchase invoice editable without altering inventory quantities or creating accounting ledger entries.</p>
              <p>• <strong>Posting</strong> this purchase invoice creates active stock batches with FEFO tracking and generates journal credit entries for supplier accounts payable.</p>
              <p>• Make sure the expiry date accurately matches the supplier shipment documentation.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Payment & Totals Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({items.length} items):</span>
                <span className="font-mono font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total Discount:</span>
                <span className="font-mono text-green-600 font-medium">-{formatCurrency(totalDiscount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total Tax:</span>
                <span className="font-mono font-medium">+{formatCurrency(totalTax)}</span>
              </div>
              <div className="border-t pt-2.5 flex justify-between text-base font-bold text-foreground">
                <span>Grand Total:</span>
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
                  {isSubmitting ? 'Posting...' : 'Save & Post Invoice'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
