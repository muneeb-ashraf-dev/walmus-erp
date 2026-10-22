'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ShoppingCart, Plus, Search, Filter, RefreshCw, 
  Eye, CheckCircle2, XCircle, ArrowUpDown, Clock
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent } from '@/components/ui/card';
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
import { PurchaseInvoice } from '@/types';
import { formatCurrency, formatDate, getStatusColor, getPaymentStatusColor } from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function PurchasesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Action Dialog state
  const [postingId, setPostingId] = useState<string | null>(null);
  const [cancellingInvoice, setCancellingInvoice] = useState<PurchaseInvoice | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPurchases = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {
        limit,
        offset: (page - 1) * limit,
        sort_by: 'invoice_date',
        sort_order: 'desc',
      };
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await api.get('/api/purchases', { params });
      const data = response.data;
      if (data && Array.isArray(data.items)) {
        setInvoices(data.items);
        setTotal(data.total || data.items.length);
      } else if (Array.isArray(data)) {
        setInvoices(data);
        setTotal(data.length);
      } else {
        setInvoices([]);
        setTotal(0);
      }
    } catch (error: any) {
      toast.error('Failed to load purchase invoices');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [statusFilter, page]);

  const handlePostInvoice = async (id: string) => {
    try {
      setIsSubmitting(true);
      await api.post(`/api/purchases/${id}/post`, { amount_paid: 0 });
      toast.success('Purchase invoice posted successfully');
      setPostingId(null);
      fetchPurchases();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || error?.response?.data?.error?.message || 'Failed to post purchase invoice';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!cancellingInvoice) return;
    try {
      setIsSubmitting(true);
      if (cancellingInvoice.status === 'draft') {
        await api.delete(`/api/purchases/${cancellingInvoice.id}`);
        toast.success('Draft purchase deleted');
      } else {
        if (!cancelReason.trim()) {
          toast.error('Please provide a reason for cancellation');
          return;
        }
        await api.post(`/api/purchases/${cancellingInvoice.id}/cancel`, null, {
          params: { reason: cancelReason },
        });
        toast.success('Purchase invoice cancelled');
      }
      setCancellingInvoice(null);
      setCancelReason('');
      fetchPurchases();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || error?.response?.data?.error?.message || 'Failed to cancel invoice';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      inv.voucher_number.toLowerCase().includes(q) ||
      (inv.supplier_invoice_number && inv.supplier_invoice_number.toLowerCase().includes(q)) ||
      (inv.supplier?.name && inv.supplier.name.toLowerCase().includes(q))
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Purchase Invoices</h1>
            <p className="text-sm text-muted-foreground">
              Manage incoming stock shipments, supplier billing, and batch receipts
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/purchases/new">
              <Plus className="mr-2 h-4 w-4" />
              New Purchase
            </Link>
          </Button>
        </div>

        {/* Filters Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search voucher, invoice #, supplier..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Status Tabs/Buttons */}
              <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                {['all', 'draft', 'posted', 'cancelled'].map((st) => (
                  <Button
                    key={st}
                    variant={statusFilter === st ? 'default' : 'outline'}
                    size="sm"
                    className="capitalize text-xs h-8"
                    onClick={() => {
                      setStatusFilter(st);
                      setPage(1);
                    }}
                  >
                    {st === 'all' ? 'All Invoices' : st}
                  </Button>
                ))}

                <Button variant="ghost" size="sm" onClick={() => fetchPurchases()} className="h-8 px-2 ml-auto">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher #</TableHead>
                  <TableHead>Supplier Inv #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading purchase invoices...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <ShoppingCart className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="text-base font-medium">No purchase invoices found</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {search ? 'Try clearing your search query' : 'Record your first supplier purchase invoice'}
                      </p>
                      <Button asChild size="sm">
                        <Link href="/purchases/new">Create Purchase Invoice</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        <Link href={`/purchases/${inv.id}`} className="text-primary hover:underline">
                          {inv.voucher_number}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {inv.supplier_invoice_number || '—'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {inv.supplier?.name || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(inv.invoice_date)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {formatCurrency(inv.total_amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <span className={inv.balance_amount > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                          {formatCurrency(inv.balance_amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(inv.status)}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getPaymentStatusColor(inv.payment_status)}>
                          {inv.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="View Details">
                            <Link href={`/purchases/${inv.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>

                          {inv.status === 'draft' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Post Purchase"
                                onClick={() => setPostingId(inv.id)}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                title="Cancel / Delete Draft"
                                onClick={() => setCancellingInvoice(inv)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}

                          {inv.status === 'posted' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              title="Cancel Invoice"
                              onClick={() => setCancellingInvoice(inv)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination controls */}
        {total > limit && (
          <div className="flex items-center justify-between px-2">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </Button>
              <span className="text-xs font-medium px-2">Page {page}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * limit >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Post Confirmation Dialog */}
        <Dialog open={!!postingId} onOpenChange={(open) => !open && setPostingId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Post Purchase Invoice</DialogTitle>
              <DialogDescription>
                Posting this invoice will automatically add received batch stock into inventory and record accounts payable to the supplier. This action cannot be undone directly.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPostingId(null)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={() => postingId && handlePostInvoice(postingId)} disabled={isSubmitting}>
                {isSubmitting ? 'Posting...' : 'Confirm & Post'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Dialog */}
        <Dialog open={!!cancellingInvoice} onOpenChange={(open) => !open && setCancellingInvoice(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {cancellingInvoice?.status === 'draft' ? 'Delete Draft Invoice' : 'Cancel Purchase Invoice'}
              </DialogTitle>
              <DialogDescription>
                {cancellingInvoice?.status === 'draft'
                  ? 'Are you sure you want to permanently delete this draft purchase invoice?'
                  : 'Please state the reason for cancelling this posted purchase invoice. A reversal entry will be recorded.'}
              </DialogDescription>
            </DialogHeader>
            {cancellingInvoice?.status === 'posted' && (
              <div className="py-2">
                <Input
                  placeholder="Reason for cancellation (required)..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancellingInvoice(null)} disabled={isSubmitting}>
                Dismiss
              </Button>
              <Button variant="destructive" onClick={handleCancelInvoice} disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : cancellingInvoice?.status === 'draft' ? 'Delete' : 'Confirm Cancel'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
