'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, CheckCircle2, XCircle, Printer, Calendar, 
  Building2, Phone, Mail, MapPin, Clock, ShoppingCart, RefreshCw, FileText
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { PurchaseInvoice } from '@/types';
import { formatCurrency, formatDate, formatDateTime, getStatusColor, getPaymentStatusColor } from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchInvoice = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const response = await api.get(`/api/purchases/${id}`);
      setInvoice(response.data);
    } catch (error: any) {
      toast.error('Failed to load purchase invoice details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const handlePost = async () => {
    try {
      setIsPosting(true);
      await api.post(`/api/purchases/${id}/post`, { amount_paid: 0 });
      toast.success('Purchase invoice posted! Stock and payables updated.');
      setShowPostDialog(false);
      fetchInvoice();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || error?.response?.data?.error?.message || 'Failed to post purchase invoice';
      toast.error(msg);
    } finally {
      setIsPosting(false);
    }
  };

  const handleCancel = async () => {
    if (!invoice) return;
    try {
      setIsCancelling(true);
      if (invoice.status === 'draft') {
        await api.delete(`/api/purchases/${id}`);
        toast.success('Draft purchase deleted');
        router.push('/purchases');
      } else {
        if (!cancelReason.trim()) {
          toast.error('Cancellation reason is required');
          return;
        }
        await api.post(`/api/purchases/${id}/cancel`, null, {
          params: { reason: cancelReason },
        });
        toast.success('Purchase invoice cancelled');
        setShowCancelDialog(false);
        fetchInvoice();
      }
    } catch (error: any) {
      const msg = error?.response?.data?.detail || error?.response?.data?.error?.message || 'Failed to cancel invoice';
      toast.error(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading purchase details...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout>
        <div className="text-center py-16 space-y-4">
          <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-semibold">Purchase invoice not found</h2>
          <Button asChild variant="outline">
            <Link href="/purchases">Back to Purchases</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Navigation & Actions Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href="/purchases">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{invoice.voucher_number}</h1>
                <Badge variant="outline" className={getStatusColor(invoice.status)}>
                  {invoice.status}
                </Badge>
                <Badge variant="outline" className={getPaymentStatusColor(invoice.payment_status)}>
                  {invoice.payment_status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Created on {formatDate(invoice.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>

            {invoice.status === 'draft' && (
              <>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => setShowPostDialog(true)}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Post Purchase
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowCancelDialog(true)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Delete Draft
                </Button>
              </>
            )}

            {invoice.status === 'posted' && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowCancelDialog(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Invoice
              </Button>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Supplier Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" />
                Supplier Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="font-semibold text-base text-foreground">
                {invoice.supplier?.name || '—'}
              </div>
              {invoice.supplier?.contact_person && (
                <div className="text-muted-foreground text-xs">
                  Attn: {invoice.supplier.contact_person}
                </div>
              )}
              {invoice.supplier?.phone && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {invoice.supplier.phone}
                </div>
              )}
              {invoice.supplier?.email && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {invoice.supplier.email}
                </div>
              )}
              {invoice.supplier?.address && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {invoice.supplier.address}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Dates & Reference */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" />
                Voucher & Reference
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supplier Bill #:</span>
                <span className="font-mono font-medium text-foreground">
                  {invoice.supplier_invoice_number || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Date:</span>
                <span className="font-medium text-foreground">{formatDate(invoice.invoice_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Due Date:</span>
                <span className="font-medium text-foreground">
                  {invoice.due_date ? formatDate(invoice.due_date) : 'Immediate / Cash'}
                </span>
              </div>
              {invoice.posted_at && (
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Posted At:</span>
                  <span className="font-mono text-green-600 font-medium">{formatDateTime(invoice.posted_at)}</span>
                </div>
              )}
              {invoice.cancelled_at && (
                <div className="flex justify-between border-t pt-2 text-destructive">
                  <span>Cancelled At:</span>
                  <span className="font-mono">{formatDateTime(invoice.cancelled_at)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment & Balance Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Subtotal:</span>
                <span className="font-mono">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Discount:</span>
                <span className="font-mono text-green-600">-{formatCurrency(invoice.discount_amount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Tax:</span>
                <span className="font-mono">+{formatCurrency(invoice.tax_amount)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-foreground">
                <span>Total Amount:</span>
                <span className="font-mono text-primary">{formatCurrency(invoice.total_amount)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Amount Paid:</span>
                <span className="font-mono">{formatCurrency(invoice.amount_paid)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                <span>Balance Due:</span>
                <span className={`font-mono ${invoice.balance_amount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {formatCurrency(invoice.balance_amount)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notes if any */}
        {invoice.notes && (
          <Card className="bg-muted/10">
            <CardContent className="p-4 text-xs">
              <span className="font-semibold text-foreground">Notes: </span>
              <span className="text-muted-foreground">{invoice.notes}</span>
            </CardContent>
          </Card>
        )}

        {/* Line Items Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Received Medicine Batches</CardTitle>
            <CardDescription>
              {invoice.items?.length || 0} line item(s) included in this purchase
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-8 text-center">#</TableHead>
                    <TableHead>Medicine Name</TableHead>
                    <TableHead>Batch #</TableHead>
                    <TableHead>Mfg Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Disc %</TableHead>
                    <TableHead className="text-right">Tax %</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!invoice.items || invoice.items.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                        No line items recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoice.items.map((it, idx) => (
                      <TableRow key={it.id || idx}>
                        <TableCell className="text-center font-mono text-xs">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {it.medicine?.name || 'Medicine'}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {it.medicine?.product_code || ''}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold">
                          {it.batch_number}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {it.manufacturing_date ? formatDate(it.manufacturing_date) : '—'}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {formatDate(it.expiry_date)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {it.quantity_received} {it.purchase_unit?.name || 'Units'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(it.purchase_rate)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {it.discount_percent ? `${it.discount_percent}%` : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {it.tax_rate ? `${it.tax_rate}%` : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          {formatCurrency(it.line_total)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Post Confirmation Dialog */}
        <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Post Purchase Invoice</DialogTitle>
              <DialogDescription>
                Are you sure you want to post this purchase invoice? This will increase stock in the inventory master and record a payable liability to {invoice.supplier?.name || 'the supplier'}.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPostDialog(false)} disabled={isPosting}>
                Cancel
              </Button>
              <Button onClick={handlePost} disabled={isPosting} className="bg-primary hover:bg-primary/90">
                {isPosting ? 'Posting...' : 'Confirm & Post'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Confirmation Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {invoice.status === 'draft' ? 'Delete Draft Invoice' : 'Cancel Purchase Invoice'}
              </DialogTitle>
              <DialogDescription>
                {invoice.status === 'draft'
                  ? 'Are you sure you want to permanently delete this draft purchase voucher?'
                  : 'Cancelling this invoice will create a reversal transaction.'}
              </DialogDescription>
            </DialogHeader>
            {invoice.status === 'posted' && (
              <div className="py-2">
                <Input
                  placeholder="Cancellation reason (required)..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={isCancelling}>
                Dismiss
              </Button>
              <Button variant="destructive" onClick={handleCancel} disabled={isCancelling}>
                {isCancelling ? 'Processing...' : invoice.status === 'draft' ? 'Delete Draft' : 'Confirm Cancel'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
