'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
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
  Building2,
  Stethoscope,
  Building,
  CreditCard,
  Calendar,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Clock,
  CheckCircle2,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { CustomerDetail } from '@/types';
import { formatCurrency, formatDate, getStatusColor, getPaymentStatusColor } from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface SalesInvoiceRecord {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  status: string;
  total_amount: number;
  amount_received: number;
  balance_amount: number;
  payment_status: string;
}

interface ReceiptRecord {
  id: string;
  payment_number: string;
  payment_date: string;
  account_id: string;
  payment_method: string;
  amount: number;
  reference_number?: string;
  status: string;
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [sales, setSales] = useState<SalesInvoiceRecord[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCustomerData = useCallback(async () => {
    if (!id) return;
    try {
      const [custRes, salesRes, receiptsRes] = await Promise.all([
        api.get(`/api/customers/${id}`),
        api.get(`/api/customers/${id}/sales`, { params: { limit: 100 } }),
        api.get(`/api/customers/${id}/receipts`, { params: { limit: 100 } }),
      ]);

      setCustomer(custRes.data);
      setSales(Array.isArray(salesRes.data) ? salesRes.data : []);
      setReceipts(Array.isArray(receiptsRes.data) ? receiptsRes.data : []);
    } catch (error: any) {
      toast.error('Failed to load customer details');
    }
  }, [id]);

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await fetchCustomerData();
      setIsLoading(false);
    };
    loadAll();
  }, [fetchCustomerData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCustomerData();
    setIsRefreshing(false);
    toast.success('Customer ledger refreshed');
  };

  const openEditModal = () => {
    if (!customer) return;
    setEditForm({
      name: customer.name,
      customer_type: customer.customer_type,
      contact_person: customer.contact_person || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      specialty: customer.specialty || '',
      area: customer.area || '',
      tax_number: customer.tax_number || '',
      credit_limit: customer.credit_limit,
      payment_terms_days: customer.payment_terms_days,
      default_sale_rate_type: customer.default_sale_rate_type,
      is_active: customer.is_active,
      notes: customer.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    setIsSavingEdit(true);
    try {
      const payload = {
        name: editForm.name?.trim(),
        customer_type: editForm.customer_type,
        contact_person: editForm.contact_person?.trim() || null,
        phone: editForm.phone?.trim() || null,
        email: editForm.email?.trim() || null,
        address: editForm.address?.trim() || null,
        specialty: editForm.specialty?.trim() || null,
        area: editForm.area?.trim() || null,
        tax_number: editForm.tax_number?.trim() || null,
        credit_limit: Number(editForm.credit_limit) || 0,
        payment_terms_days: Number(editForm.payment_terms_days) || 0,
        default_sale_rate_type: editForm.default_sale_rate_type,
        is_active: editForm.is_active,
        notes: editForm.notes?.trim() || null,
      };

      const response = await api.patch(`/api/customers/${id}`, payload);
      setCustomer((prev) => (prev ? { ...prev, ...response.data } : null));
      toast.success('Customer details updated successfully!');
      setIsEditDialogOpen(false);
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.error?.message || 'Failed to update customer';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/customers/${id}`);
      toast.success('Customer deleted or deactivated');
      router.push('/customers');
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.error?.message || 'Failed to delete customer';
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
          <p className="text-sm text-muted-foreground">Loading customer profile & transaction ledger...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="text-center py-16 space-y-4">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h2 className="text-xl font-bold">Customer Not Found</h2>
          <p className="text-sm text-muted-foreground">
            The requested customer profile could not be loaded or may have been deleted.
          </p>
          <Button asChild>
            <Link href="/customers">Back to Customer Directory</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const outstanding = Number(customer.outstanding_balance) || 0;
  const overdue = Number(customer.overdue_amount) || 0;
  const investments = customer.investments || [];

  const getCustomerTypeBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pharmacy':
        return (
          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
            Pharmacy
          </Badge>
        );
      case 'doctor':
        return (
          <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
            Doctor
          </Badge>
        );
      case 'hospital':
        return (
          <Badge variant="outline" className="text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-950 dark:text-purple-300">
            Hospital
          </Badge>
        );
      case 'clinic':
        return (
          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:text-amber-300">
            Clinic
          </Badge>
        );
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link href="/customers">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
                {getCustomerTypeBadge(customer.customer_type)}
                <Badge variant={customer.is_active ? 'default' : 'secondary'}>
                  {customer.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                {customer.area && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {customer.area}
                  </span>
                )}
                {customer.specialty && <span>• Specialty: {customer.specialty}</span>}
                {customer.phone && <span>• Tel: {customer.phone}</span>}
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

        {/* Balance & Ledger Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className={outstanding > 0 ? 'border-primary/40' : ''}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Outstanding Balance</p>
                <p className="text-2xl font-bold font-mono text-primary">
                  {formatCurrency(outstanding)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Receivable from client</p>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className={overdue > 0 ? 'border-destructive/40 bg-destructive/5' : ''}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Overdue Balance</p>
                <p
                  className={`text-2xl font-bold font-mono ${
                    overdue > 0 ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {formatCurrency(overdue)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Exceeded {customer.payment_terms_days} days terms
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
                  {Number(customer.credit_limit) > 0
                    ? formatCurrency(Number(customer.credit_limit))
                    : 'No Limit'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Terms: {customer.payment_terms_days} Days
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
                <p className="text-xs font-medium text-muted-foreground">Pricing Tier</p>
                <p className="text-2xl font-bold capitalize">
                  {customer.default_sale_rate_type}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Opening: {formatCurrency(Number(customer.opening_balance) || 0)}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Profile Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Customer Information & Billing Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block text-xs">Contact Person</span>
              <span className="font-medium text-foreground">{customer.contact_person || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Phone Number</span>
              <span className="font-medium font-mono text-foreground">{customer.phone || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Email Address</span>
              <span className="font-medium text-foreground">{customer.email || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Tax / NTN / CNIC</span>
              <span className="font-medium font-mono text-foreground">{customer.tax_number || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Area / Territory</span>
              <span className="font-medium text-foreground">{customer.area || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Rate Tier Assigned</span>
              <span className="font-medium text-foreground capitalize">{customer.default_sale_rate_type} Rate</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground block text-xs">Physical Address</span>
              <span className="font-medium text-foreground">{customer.address || '—'}</span>
            </div>
            {customer.notes && (
              <div className="sm:col-span-2 md:col-span-4 pt-2 border-t">
                <span className="text-muted-foreground block text-xs mb-1">Internal Notes:</span>
                <p className="text-xs bg-muted p-2.5 rounded-md whitespace-pre-wrap">
                  {customer.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction History Tabs */}
        <Tabs defaultValue="sales" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sales" className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Sales Invoices ({sales.length})
            </TabsTrigger>
            <TabsTrigger value="receipts" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Payment Receipts ({receipts.length})
            </TabsTrigger>
            {(customer.customer_type === 'doctor' || investments.length > 0) && (
              <TabsTrigger value="investments" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Doctor Investments ({investments.length})
              </TabsTrigger>
            )}
          </TabsList>

          {/* Sales Tab */}
          <TabsContent value="sales" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Sales Invoices</CardTitle>
                    <CardDescription>
                      Medicine sales bills, outstanding balances, and payment statuses
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Amount Received</TableHead>
                      <TableHead className="text-right">Balance Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                          No sales invoices recorded for this customer yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sales.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono font-semibold">
                            {s.invoice_number}
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(s.invoice_date)}</TableCell>
                          <TableCell className="text-sm">
                            {s.due_date ? formatDate(s.due_date) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {formatCurrency(Number(s.total_amount))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {formatCurrency(Number(s.amount_received))}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-primary">
                            {formatCurrency(Number(s.balance_amount))}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(
                                s.status
                              )}`}
                            >
                              {s.status.toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getPaymentStatusColor(
                                s.payment_status
                              )}`}
                            >
                              {s.payment_status.toUpperCase()}
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

          {/* Receipts Tab */}
          <TabsContent value="receipts" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Payment Receipts</CardTitle>
                    <CardDescription>
                      Payments collected from this customer toward outstanding invoices
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Reference / Cheque #</TableHead>
                      <TableHead className="text-right">Amount Received</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          No payment receipts recorded for this customer yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      receipts.map((rcpt) => (
                        <TableRow key={rcpt.id}>
                          <TableCell className="font-mono font-semibold">
                            {rcpt.payment_number}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(rcpt.payment_date)}
                          </TableCell>
                          <TableCell className="text-sm capitalize">
                            {rcpt.payment_method.replace('_', ' ')}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {rcpt.reference_number || '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-green-600">
                            {formatCurrency(Number(rcpt.amount))}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(
                                rcpt.status
                              )}`}
                            >
                              {rcpt.status.toUpperCase()}
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

          {/* Doctor Investments Tab */}
          {(customer.customer_type === 'doctor' || investments.length > 0) && (
            <TabsContent value="investments" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Doctor Business Investments & ROI</CardTitle>
                  <CardDescription>
                    Capital investments with expected prescription return on investment
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Investment Date</TableHead>
                        <TableHead className="text-right">Investment Amount</TableHead>
                        <TableHead className="text-center">ROI Target (%)</TableHead>
                        <TableHead className="text-right">Expected Sales</TableHead>
                        <TableHead className="text-right">Actual Sales</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {investments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                            No investment records registered for this doctor.
                          </TableCell>
                        </TableRow>
                      ) : (
                        investments.map((inv: any) => (
                          <TableRow key={inv.id}>
                            <TableCell className="text-sm">
                              {inv.investment_date ? formatDate(inv.investment_date) : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {formatCurrency(Number(inv.investment_amount))}
                            </TableCell>
                            <TableCell className="text-center font-mono font-medium">
                              {inv.roi_percentage}%
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {inv.expected_sale ? formatCurrency(Number(inv.expected_sale)) : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-emerald-600 font-medium">
                              {inv.actual_sales ? formatCurrency(Number(inv.actual_sales)) : '0.00'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={inv.status === 'active' ? 'default' : 'secondary'}>
                                {inv.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Edit Customer Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Customer Profile</DialogTitle>
              <DialogDescription>
                Modify client credentials, pricing tier, and credit terms
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Customer Type *
                </label>
                <Select
                  value={editForm.customer_type || 'pharmacy'}
                  onValueChange={(val) => setEditForm({ ...editForm, customer_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Customer Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pharmacy">Pharmacy</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="hospital">Hospital</SelectItem>
                    <SelectItem value="clinic">Clinic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Input
                  label="Name *"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              {editForm.customer_type === 'doctor' ? (
                <div>
                  <Input
                    label="Specialty"
                    value={editForm.specialty || ''}
                    onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                  />
                </div>
              ) : (
                <div>
                  <Input
                    label="Contact Person"
                    value={editForm.contact_person || ''}
                    onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                  />
                </div>
              )}

              <div>
                <Input
                  label="Area / Territory"
                  value={editForm.area || ''}
                  onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
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
                  label="Tax / NTN / CNIC"
                  value={editForm.tax_number || ''}
                  onChange={(e) => setEditForm({ ...editForm, tax_number: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Default Pricing Tier
                </label>
                <Select
                  value={editForm.default_sale_rate_type || 'retail'}
                  onValueChange={(val) =>
                    setEditForm({ ...editForm, default_sale_rate_type: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pricing Tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail Rate (MRP)</SelectItem>
                    <SelectItem value="wholesale">Wholesale Rate</SelectItem>
                    <SelectItem value="distributor">Distributor Rate</SelectItem>
                  </SelectContent>
                </Select>
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
                  <p className="text-sm font-medium">Active Account</p>
                  <p className="text-xs text-muted-foreground">
                    Inactive accounts cannot be selected on new sales invoices
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
                This will delete or deactivate <strong>{customer.name}</strong>.
                If this customer has historical invoices, receipts, or ledger entries,
                the system will mark the customer as inactive to preserve accounting audit trails.
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
                  'Delete Customer'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
