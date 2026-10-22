'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Truck,
  ArrowLeft,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  DollarSign,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  Calendar,
  CheckCircle2,
  Receipt,
  ShoppingCart,
  Clock,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SupplierDetail } from '@/types';
import { formatCurrency, formatDate, getStatusColor, getPaymentStatusColor } from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface PurchaseInvoiceRecord {
  id: string;
  voucher_number: string;
  supplier_invoice_number?: string;
  invoice_date: string;
  received_date?: string;
  due_date?: string;
  status: string;
  total_amount: number;
  amount_paid: number;
  balance_amount: number;
  payment_status: string;
}

interface PaymentRecord {
  id: string;
  payment_number: string;
  payment_date: string;
  account_id: string;
  payment_method: string;
  amount: number;
  reference_number?: string;
  status: string;
}

export default function SupplierDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [purchases, setPurchases] = useState<PurchaseInvoiceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSupplierData = useCallback(async () => {
    if (!id) return;
    try {
      const [supRes, purchasesRes, paymentsRes] = await Promise.all([
        api.get(`/api/suppliers/${id}`),
        api.get(`/api/suppliers/${id}/purchases`, { params: { limit: 100 } }),
        api.get(`/api/suppliers/${id}/payments`, { params: { limit: 100 } }),
      ]);

      setSupplier(supRes.data);
      setPurchases(Array.isArray(purchasesRes.data) ? purchasesRes.data : []);
      setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
    } catch (error: any) {
      toast.error('Failed to load supplier details');
    }
  }, [id]);

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await fetchSupplierData();
      setIsLoading(false);
    };
    loadAll();
  }, [fetchSupplierData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSupplierData();
    setIsRefreshing(false);
    toast.success('Supplier records refreshed');
  };

  const openEditModal = () => {
    if (!supplier) return;
    setEditForm({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      tax_number: supplier.tax_number || '',
      credit_limit: supplier.credit_limit,
      payment_terms_days: supplier.payment_terms_days,
      is_active: supplier.is_active,
      notes: supplier.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    setIsSavingEdit(true);
    try {
      const payload = {
        name: editForm.name?.trim(),
        contact_person: editForm.contact_person?.trim() || null,
        phone: editForm.phone?.trim() || null,
        email: editForm.email?.trim() || null,
        address: editForm.address?.trim() || null,
        tax_number: editForm.tax_number?.trim() || null,
        credit_limit: Number(editForm.credit_limit) || 0,
        payment_terms_days: Number(editForm.payment_terms_days) || 0,
        is_active: editForm.is_active,
        notes: editForm.notes?.trim() || null,
      };

      const response = await api.patch(`/api/suppliers/${id}`, payload);
      setSupplier((prev) => (prev ? { ...prev, ...response.data } : null));
      toast.success('Supplier details updated successfully!');
      setIsEditDialogOpen(false);
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.error?.message || 'Failed to update supplier';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/suppliers/${id}`);
      toast.success('Supplier deleted or deactivated');
      router.push('/suppliers');
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.error?.message || 'Failed to delete supplier';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading supplier profile & financial history...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!supplier) {
    return (
      <DashboardLayout>
        <div className="text-center py-16 space-y-4">
          <Truck className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h2 className="text-xl font-bold">Supplier Not Found</h2>
          <p className="text-sm text-muted-foreground">
            The requested supplier could not be loaded or may have been deleted.
          </p>
          <Button asChild>
            <Link href="/suppliers">Back to Suppliers</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const outstanding = Number(supplier.outstanding_balance) || 0;
  const overdue = Number(supplier.overdue_amount) || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link href="/suppliers">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
                <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
                  {supplier.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {supplier.contact_person && `Rep: ${supplier.contact_person}`}
                {supplier.phone && ` • Tel: ${supplier.phone}`}
                {supplier.tax_number && ` • NTN: ${supplier.tax_number}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={openEditModal}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Balance Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className={outstanding > 0 ? 'border-primary/40' : ''}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Outstanding Balance</p>
                <p className="text-2xl font-bold font-mono text-primary">
                  {formatCurrency(outstanding)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Payable to vendor</p>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className={overdue > 0 ? 'border-destructive/40 bg-destructive/5' : ''}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Overdue Amount</p>
                <p
                  className={`text-2xl font-bold font-mono ${
                    overdue > 0 ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {formatCurrency(overdue)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Past {supplier.payment_terms_days} days terms
                </p>
              </div>
              <div
                className={`p-2.5 rounded-lg ${
                  overdue > 0
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Credit Limit</p>
                <p className="text-2xl font-bold font-mono">
                  {Number(supplier.credit_limit) > 0
                    ? formatCurrency(Number(supplier.credit_limit))
                    : 'No Limit'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Terms: {supplier.payment_terms_days} Days
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
                <CreditCard className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Opening Balance</p>
                <p className="text-2xl font-bold font-mono text-muted-foreground">
                  {formatCurrency(Number(supplier.opening_balance) || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">At onboarding date</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted text-muted-foreground">
                <Calendar className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Supplier Profile Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Supplier Profile & Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block text-xs">Contact Person</span>
              <span className="font-medium text-foreground">{supplier.contact_person || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Phone Number</span>
              <span className="font-medium font-mono text-foreground">{supplier.phone || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Email Address</span>
              <span className="font-medium text-foreground">{supplier.email || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Tax Number (NTN)</span>
              <span className="font-medium font-mono text-foreground">{supplier.tax_number || '—'}</span>
            </div>
            <div className="sm:col-span-2 md:col-span-3">
              <span className="text-muted-foreground block text-xs">Office / Delivery Address</span>
              <span className="font-medium text-foreground">{supplier.address || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Credit Terms</span>
              <span className="font-medium text-foreground">{supplier.payment_terms_days} Days Credit</span>
            </div>
            {supplier.notes && (
              <div className="sm:col-span-2 md:col-span-4 pt-2 border-t">
                <span className="text-muted-foreground block text-xs mb-1">Internal Notes:</span>
                <p className="text-xs bg-muted p-2.5 rounded-md whitespace-pre-wrap">
                  {supplier.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction History Tabs */}
        <Tabs defaultValue="purchases" className="space-y-4">
          <TabsList>
            <TabsTrigger value="purchases" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Purchase Invoices ({purchases.length})
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Payment Vouchers ({payments.length})
            </TabsTrigger>
          </TabsList>

          {/* Purchases Tab */}
          <TabsContent value="purchases" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Purchase Invoices</CardTitle>
                    <CardDescription>
                      All procurement bills, receiving vouchers, and settlement balances
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Voucher #</TableHead>
                      <TableHead>Supplier Inv #</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Amount Paid</TableHead>
                      <TableHead className="text-right">Balance Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                          No purchase invoices recorded for this supplier yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchases.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono font-semibold">
                            {p.voucher_number}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {p.supplier_invoice_number || '—'}
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(p.invoice_date)}</TableCell>
                          <TableCell className="text-sm">
                            {p.due_date ? formatDate(p.due_date) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {formatCurrency(Number(p.total_amount))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {formatCurrency(Number(p.amount_paid))}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-primary">
                            {formatCurrency(Number(p.balance_amount))}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(
                                p.status
                              )}`}
                            >
                              {p.status.toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getPaymentStatusColor(
                                p.payment_status
                              )}`}
                            >
                              {p.payment_status.toUpperCase()}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Payment History</CardTitle>
                    <CardDescription>
                      Payments disbursed to this supplier via cash, bank transfer, or cheque
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment #</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference / Cheque #</TableHead>
                      <TableHead className="text-right">Amount Paid</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          No payment vouchers recorded for this supplier yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((pmt) => (
                        <TableRow key={pmt.id}>
                          <TableCell className="font-mono font-semibold">
                            {pmt.payment_number}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(pmt.payment_date)}
                          </TableCell>
                          <TableCell className="text-sm capitalize">
                            {pmt.payment_method.replace('_', ' ')}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {pmt.reference_number || '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-green-600">
                            {formatCurrency(Number(pmt.amount))}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(
                                pmt.status
                              )}`}
                            >
                              {pmt.status.toUpperCase()}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Supplier Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Supplier Details</DialogTitle>
              <DialogDescription>
                Modify vendor contact credentials and credit limits
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div className="sm:col-span-2">
                <Input
                  label="Supplier Name *"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div>
                <Input
                  label="Contact Person"
                  value={editForm.contact_person || ''}
                  onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                />
              </div>

              <div>
                <Input
                  label="Phone Number"
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>

              <div>
                <Input
                  label="Email Address"
                  type="email"
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>

              <div>
                <Input
                  label="Tax Number / NTN"
                  value={editForm.tax_number || ''}
                  onChange={(e) => setEditForm({ ...editForm, tax_number: e.target.value })}
                />
              </div>

              <div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  label="Credit Limit (PKR)"
                  value={editForm.credit_limit ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, credit_limit: Number(e.target.value) })}
                />
              </div>

              <div>
                <Input
                  type="number"
                  min="0"
                  label="Payment Terms (Days)"
                  value={editForm.payment_terms_days ?? 30}
                  onChange={(e) => setEditForm({ ...editForm, payment_terms_days: Number(e.target.value) })}
                />
              </div>

              <div className="sm:col-span-2">
                <Textarea
                  label="Address"
                  rows={2}
                  value={editForm.address || ''}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2">
                <Textarea
                  label="Notes"
                  rows={2}
                  value={editForm.notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2 flex items-center justify-between border p-3 rounded-md">
                <div>
                  <p className="text-sm font-medium">Active Vendor</p>
                  <p className="text-xs text-muted-foreground">
                    Inactive vendors cannot be selected on new purchase invoices
                  </p>
                </div>
                <Switch
                  checked={editForm.is_active ?? true}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
                {isSavingEdit ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Alert */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete or deactivate <strong>{supplier.name}</strong>.
                If this supplier has associated purchase invoices, payments, or ledger entries,
                the system will mark the supplier as inactive rather than deleting financial history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Supplier'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
