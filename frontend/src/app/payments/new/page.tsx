'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, CreditCard, Save, Loader2, ArrowDownLeft, 
  ArrowUpRight, DollarSign, CheckCircle2, Split
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Customer, Supplier, FinancialAccount } from '@/types';
import toast from 'react-hot-toast';

interface OutstandingInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  balance_amount: number;
  allocated: number;
}

export default function RecordPaymentPage() {
  const router = useRouter();

  // Mode: customer receipt or supplier payment
  const [transactionType, setTransactionType] = useState<'customer' | 'supplier'>('customer');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Invoice allocations
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [custRes, suppRes, accRes] = await Promise.all([
        api.get('/api/customers?limit=200').catch(() => ({ data: { items: [] } })),
        api.get('/api/suppliers?limit=200').catch(() => ({ data: { items: [] } })),
        api.get('/api/financial/accounts').catch(() => ({ data: [] })),
      ]);

      const custList: Customer[] = Array.isArray(custRes.data) ? custRes.data : custRes.data?.items || [];
      const suppList: Supplier[] = Array.isArray(suppRes.data) ? suppRes.data : suppRes.data?.items || [];
      const accList: FinancialAccount[] = Array.isArray(accRes.data) ? accRes.data : [];

      setCustomers(custList);
      setSuppliers(suppList);
      setAccounts(accList);

      if (accList.length > 0) {
        setSelectedAccountId(accList[0].id);
      }
      if (custList.length > 0) {
        setSelectedPartyId(custList[0].id);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
      toast.error('Failed to load accounts and parties');
    } finally {
      setLoadingInitial(false);
    }
  };

  // When party or transactionType changes, load outstanding invoices
  useEffect(() => {
    if (!selectedPartyId) {
      setInvoices([]);
      return;
    }
    fetchOutstandingInvoices();
  }, [transactionType, selectedPartyId]);

  const fetchOutstandingInvoices = async () => {
    setLoadingInvoices(true);
    try {
      if (transactionType === 'customer') {
        const res = await api.get(`/api/sales?customer_id=${selectedPartyId}&status=posted&limit=100`);
        const items = res.data.items || [];
        const outstanding = items
          .filter((inv: any) => parseFloat(inv.balance_amount) > 0)
          .map((inv: any) => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            invoice_date: inv.invoice_date,
            total_amount: parseFloat(inv.total_amount),
            balance_amount: parseFloat(inv.balance_amount),
            allocated: 0,
          }));
        setInvoices(outstanding);
      } else {
        const res = await api.get(`/api/purchases?supplier_id=${selectedPartyId}&status=posted&limit=100`);
        const items = res.data.items || [];
        const outstanding = items
          .filter((inv: any) => parseFloat(inv.balance_amount) > 0)
          .map((inv: any) => ({
            id: inv.id,
            invoice_number: inv.voucher_number || inv.supplier_invoice_number || 'INV',
            invoice_date: inv.invoice_date,
            total_amount: parseFloat(inv.total_amount),
            balance_amount: parseFloat(inv.balance_amount),
            allocated: 0,
          }));
        setInvoices(outstanding);
      }
    } catch (err) {
      console.error('Failed to fetch outstanding invoices:', err);
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleTypeSwitch = (type: 'customer' | 'supplier') => {
    setTransactionType(type);
    if (type === 'customer' && customers.length > 0) {
      setSelectedPartyId(customers[0].id);
    } else if (type === 'supplier' && suppliers.length > 0) {
      setSelectedPartyId(suppliers[0].id);
    } else {
      setSelectedPartyId('');
    }
  };

  const handleAutoAllocate = () => {
    const totalAmount = parseFloat(amount) || 0;
    if (totalAmount <= 0) {
      toast.error('Enter a payment amount first');
      return;
    }

    let remaining = totalAmount;
    const updated = invoices.map((inv) => {
      if (remaining <= 0) {
        return { ...inv, allocated: 0 };
      }
      const canAllocate = Math.min(inv.balance_amount, remaining);
      remaining -= canAllocate;
      return { ...inv, allocated: canAllocate };
    });

    setInvoices(updated);
    toast.success('Amount auto-allocated to oldest invoices');
  };

  const handleManualAllocation = (invoiceId: string, val: string) => {
    const allocatedNum = Math.max(0, parseFloat(val) || 0);
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? { ...inv, allocated: Math.min(allocatedNum, inv.balance_amount) }
          : inv
      )
    );
  };

  const totalAllocated = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (inv.allocated || 0), 0);
  }, [invoices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredAmount = parseFloat(amount) || 0;

    if (!selectedPartyId) {
      toast.error('Please select a customer or supplier');
      return;
    }
    if (!selectedAccountId) {
      toast.error('Please select a deposit/withdrawal account');
      return;
    }
    if (enteredAmount <= 0) {
      toast.error('Payment amount must be greater than zero');
      return;
    }

    setSubmitting(true);
    try {
      // Build allocation objects
      const allocations = invoices
        .filter((inv) => inv.allocated > 0)
        .map((inv) => ({
          invoice_type: transactionType === 'customer' ? 'sales' : 'purchase',
          invoice_id: inv.id,
          allocated_amount: inv.allocated,
        }));

      const payload = {
        payment_date: paymentDate,
        account_id: selectedAccountId,
        party_type: transactionType,
        party_id: selectedPartyId,
        payment_method: paymentMethod,
        amount: enteredAmount,
        reference_number: referenceNumber || undefined,
        notes: notes || undefined,
        allocations,
      };

      await api.post('/api/financial/payments', payload);
      toast.success(
        transactionType === 'customer'
          ? 'Customer receipt recorded successfully!'
          : 'Supplier payment recorded successfully!'
      );
      router.push('/payments');
    } catch (err: any) {
      console.error('Failed to create payment:', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || 'Failed to record payment';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center gap-3">
          <Link href="/payments">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Record Financial Transaction</h1>
            <p className="text-sm text-muted-foreground">
              Create customer receipt or supplier voucher with invoice allocation
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Transaction Type Switcher */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleTypeSwitch('customer')}
              className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                transactionType === 'customer'
                  ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-600'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                <ArrowDownLeft className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Customer Receipt</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Money received from a doctor, pharmacy, or clinic customer
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleTypeSwitch('supplier')}
              className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                transactionType === 'supplier'
                  ? 'border-rose-600 bg-rose-50/60 dark:bg-rose-950/30 ring-2 ring-rose-600'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <div className="p-2 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300">
                <ArrowUpRight className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Supplier Payment</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Money paid out to a medicine distributor or manufacturer
                </p>
              </div>
            </button>
          </div>

          {/* Core Payment Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Voucher Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Party Selector */}
                <div className="space-y-2">
                  <Label htmlFor="party">
                    {transactionType === 'customer' ? 'Customer / Doctor *' : 'Supplier / Vendor *'}
                  </Label>
                  <select
                    id="party"
                    value={selectedPartyId}
                    onChange={(e) => setSelectedPartyId(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    {transactionType === 'customer'
                      ? customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.area ? `(${c.area})` : ''}
                          </option>
                        ))
                      : suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                  </select>
                </div>

                {/* Account Selector (Cash / Bank) */}
                <div className="space-y-2">
                  <Label htmlFor="account">Deposit / Payment Account *</Label>
                  <select
                    id="account"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.code}) - {a.account_type.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="date">Transaction Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (PKR) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    step="any"
                    placeholder="e.g. 25000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>

                {/* Method */}
                <div className="space-y-2">
                  <Label htmlFor="method">Payment Method</Label>
                  <select
                    id="method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="online">Online / POS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Reference Number */}
                <div className="space-y-2">
                  <Label htmlFor="ref">Reference / Cheque / Slip #</Label>
                  <Input
                    id="ref"
                    placeholder="e.g. CHQ-98124 or Deposit Slip #"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    placeholder="Optional transaction memo"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Allocation Section */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Split className="h-4 w-4 text-primary" />
                  Invoice Allocations
                </CardTitle>
                <CardDescription>
                  Allocate payment to open invoices to update outstanding receivables / payables
                </CardDescription>
              </div>
              {invoices.length > 0 && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAutoAllocate}
                >
                  Auto-Allocate to Oldest
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loadingInvoices ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2 text-primary" />
                  Loading outstanding invoices...
                </div>
              ) : invoices.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No unpaid or pending invoices found for this party. The payment will be posted directly to ledger.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Invoice Date</TableHead>
                          <TableHead className="text-right">Total (PKR)</TableHead>
                          <TableHead className="text-right">Open Balance</TableHead>
                          <TableHead className="text-right w-44">Allocated (PKR)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                            <TableCell className="text-xs">{formatDate(inv.invoice_date)}</TableCell>
                            <TableCell className="text-right text-xs">{formatCurrency(inv.total_amount)}</TableCell>
                            <TableCell className="text-right text-xs font-semibold text-amber-600">
                              {formatCurrency(inv.balance_amount)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                max={inv.balance_amount}
                                step="any"
                                className="h-8 text-xs text-right font-semibold"
                                value={inv.allocated || ''}
                                placeholder="0"
                                onChange={(e) => handleManualAllocation(inv.id, e.target.value)}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>
                      Allocated: <strong>{formatCurrency(totalAllocated)}</strong> of{' '}
                      <strong>{formatCurrency(parseFloat(amount) || 0)}</strong>
                    </span>
                    {parseFloat(amount) > totalAllocated && (
                      <span className="text-amber-600 font-medium">
                        Unallocated balance: {formatCurrency(parseFloat(amount) - totalAllocated)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t px-6 py-4">
              <Link href="/payments">
                <Button variant="outline" type="button" disabled={submitting}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={submitting || loadingInitial}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save & Post Payment
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  );
}
