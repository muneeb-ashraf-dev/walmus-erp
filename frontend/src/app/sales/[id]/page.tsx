'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, CheckCircle2, XCircle, Printer, Calendar, 
  User, Phone, MapPin, Clock, FileText, RefreshCw, AlertCircle
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
import { SalesInvoice } from '@/types';
import { formatCurrency, formatDate, formatDateTime, getStatusColor, getPaymentStatusColor } from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SalesDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params?.id as string;
  const autoPrint = searchParams?.get('print') === 'true';

  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
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
      const response = await api.get(`/api/sales/${id}`);
      setInvoice(response.data);
    } catch (error: any) {
      toast.error('Failed to load sales invoice details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  useEffect(() => {
    if (!isLoading && invoice && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, invoice, autoPrint]);

  const handlePost = async () => {
    try {
      setIsPosting(true);
      await api.post(`/api/sales/${id}/post`, { amount_received: 0 });
      toast.success('Sales invoice posted! Stock deducted and receivable recorded.');
      setShowPostDialog(false);
      fetchInvoice();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || error?.response?.data?.error?.message || 'Failed to post sales invoice';
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
        await api.delete(`/api/sales/${id}`);
        toast.success('Draft sales invoice deleted');
        router.push('/sales');
      } else {
        if (!cancelReason.trim()) {
          toast.error('Please specify a cancellation reason');
          return;
        }
        await api.post(`/api/sales/${id}/cancel`, null, {
          params: { reason: cancelReason },
        });
        toast.success('Sales invoice cancelled');
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
          <p className="text-sm text-muted-foreground">Loading sales invoice...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout>
        <div className="text-center py-16 space-y-4">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-semibold">Sales invoice not found</h2>
          <Button asChild variant="outline">
            <Link href="/sales">Back to Sales</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        {/* Screen Only: Top Actions Bar */}
        <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href="/sales">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{invoice.invoice_number}</h1>
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
              Print Invoice
            </Button>

            {invoice.status === 'draft' && (
              <>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => setShowPostDialog(true)}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Post Invoice
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

        {/* Printable Invoice Container */}
        <div className="bg-card text-card-foreground border rounded-lg shadow-sm p-6 sm:p-8 print:p-0 print:border-none print:shadow-none space-y-6">
          {/* Business Header */}
          <div className="border-b pb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-extrabold tracking-tight text-primary">WALMUS PHARMA</span>
                <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold uppercase">
                  Pharmaceutical Distribution
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Licensed Pharmaceutical Distributor & Wholesaler
                <br />
                National Highway / Main Warehouse, Karachi, Pakistan
                <br />
                NTN/STRN: 7492019-3 | DTL Lic: 04-291-002
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <h2 className="text-xl font-bold uppercase tracking-wider text-foreground">
                Sales Tax Invoice
              </h2>
              <div className="font-mono text-sm font-semibold text-primary">
                {invoice.invoice_number}
              </div>
              <div className="text-xs text-muted-foreground">
                Date: <span className="text-foreground font-medium">{formatDate(invoice.invoice_date)}</span>
              </div>
              {invoice.due_date && (
                <div className="text-xs text-muted-foreground">
                  Due Date: <span className="text-foreground font-medium">{formatDate(invoice.due_date)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Customer & Billing Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-muted/20 p-4 rounded-md text-xs">
            <div className="space-y-1.5">
              <span className="font-semibold text-foreground uppercase tracking-wider text-[11px] block text-muted-foreground">
                Billed To (Customer):
              </span>
              <div className="text-sm font-bold text-foreground">
                {invoice.customer?.name || 'Walk-in Customer'}
              </div>
              {invoice.customer?.contact_person && (
                <div className="text-muted-foreground">
                  Contact: {invoice.customer.contact_person}
                </div>
              )}
              {invoice.customer?.phone && (
                <div className="text-muted-foreground">
                  Phone: {invoice.customer.phone}
                </div>
              )}
              {invoice.customer?.address && (
                <div className="text-muted-foreground">
                  Address: {invoice.customer.address}
                </div>
              )}
              {invoice.customer?.tax_number && (
                <div className="text-muted-foreground font-mono">
                  NTN/Tax #: {invoice.customer.tax_number}
                </div>
              )}
            </div>

            <div className="space-y-1.5 sm:text-right">
              <span className="font-semibold text-foreground uppercase tracking-wider text-[11px] block text-muted-foreground">
                Invoice Status:
              </span>
              <div className="flex items-center gap-2 sm:justify-end">
                <Badge variant="outline" className={getStatusColor(invoice.status)}>
                  {invoice.status}
                </Badge>
                <Badge variant="outline" className={getPaymentStatusColor(invoice.payment_status)}>
                  {invoice.payment_status}
                </Badge>
              </div>
              {invoice.posted_at && (
                <div className="text-muted-foreground text-[11px]">
                  Posted: {formatDateTime(invoice.posted_at)}
                </div>
              )}
              {invoice.notes && (
                <div className="text-muted-foreground text-[11px] italic mt-2">
                  Notes: {invoice.notes}
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs">
                  <TableHead className="w-8 text-center font-bold">#</TableHead>
                  <TableHead className="font-bold">Item Description</TableHead>
                  <TableHead className="font-bold">Batch #</TableHead>
                  <TableHead className="font-bold">Expiry Date</TableHead>
                  <TableHead className="text-right font-bold">Quantity</TableHead>
                  <TableHead className="text-right font-bold">Unit Price</TableHead>
                  <TableHead className="text-right font-bold">Disc %</TableHead>
                  <TableHead className="text-right font-bold">Tax %</TableHead>
                  <TableHead className="text-right font-bold">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!invoice.items || invoice.items.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                      No line items
                    </TableCell>
                  </TableRow>
                ) : (
                  invoice.items.map((item, idx) => (
                    <TableRow key={item.id || idx} className="text-xs">
                      <TableCell className="text-center font-mono text-[11px] text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground">
                          {item.medicine?.name || 'Medicine'}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {item.medicine?.product_code || ''}
                          {item.medicine?.packing_description ? ` • ${item.medicine.packing_description}` : ''}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        {item.batch?.batch_number || 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.batch?.expiry_date ? formatDate(item.batch.expiry_date) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {item.quantity_sold} {item.sale_unit?.name || 'Units'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.sale_rate)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {item.discount_percent ? `${item.discount_percent}%` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {item.tax_rate ? `${item.tax_rate}%` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-foreground">
                        {formatCurrency(item.line_total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Totals & Signatures */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start pt-2">
            <div className="space-y-4 text-xs text-muted-foreground">
              <div className="border p-3 rounded space-y-1">
                <span className="font-semibold text-foreground block">Terms & Conditions:</span>
                <p>1. Goods once sold under cold-chain or regulated schedules are not returnable without prior authorization.</p>
                <p>2. Payment is due as per agreed credit terms. Outstanding balances are subject to statutory late interest.</p>
                <p>3. Warranty: We warrant that the medicines sold are manufactured by licensed entities under the Drugs Act 1976.</p>
              </div>

              {/* Signature lines */}
              <div className="pt-8 grid grid-cols-2 gap-4 text-center">
                <div className="border-t border-dashed pt-1">
                  <span>Prepared / Dispatched By</span>
                </div>
                <div className="border-t border-dashed pt-1">
                  <span>Customer Received By & Stamp</span>
                </div>
              </div>
            </div>

            {/* Calculations breakdown */}
            <div className="bg-muted/10 p-4 rounded border space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Subtotal (Gross):</span>
                <span className="font-mono">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Special Discount:</span>
                <span className="font-mono text-green-600">-{formatCurrency(invoice.discount_amount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Sales Tax / Federal Levy:</span>
                <span className="font-mono">+{formatCurrency(invoice.tax_amount)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-base text-foreground">
                <span>Grand Total:</span>
                <span className="font-mono text-primary text-lg">{formatCurrency(invoice.total_amount)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
                <span>Amount Received:</span>
                <span className="font-mono">{formatCurrency(invoice.amount_received)}</span>
              </div>
              <div className="flex justify-between font-semibold text-sm pt-1">
                <span>Balance Due:</span>
                <span className={`font-mono ${invoice.balance_amount > 0 ? 'text-amber-600 font-bold' : 'text-green-600'}`}>
                  {formatCurrency(invoice.balance_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Post Confirmation Dialog */}
        <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Post Sales Invoice</DialogTitle>
              <DialogDescription>
                Are you sure you want to post invoice #{invoice.invoice_number}? This will permanently deduct batch stocks, record Cost of Goods Sold (COGS), and record accounts receivable for {invoice.customer?.name || 'the customer'}.
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
                {invoice.status === 'draft' ? 'Delete Draft Invoice' : 'Cancel Sales Invoice'}
              </DialogTitle>
              <DialogDescription>
                {invoice.status === 'draft'
                  ? 'Are you sure you want to delete this draft invoice?'
                  : 'Cancelling this invoice will create a reversal transaction and restore inventory.'}
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
