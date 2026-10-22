'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  CreditCard, Plus, Landmark, ArrowDownLeft, ArrowUpRight, 
  Search, Filter, Loader2, Calendar, FileText
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Payment, FinancialAccount, Customer, Supplier } from '@/types';
import toast from 'react-hot-toast';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'customer' | 'supplier'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [payRes, accRes, custRes, suppRes] = await Promise.all([
        api.get('/api/financial/payments?limit=200'),
        api.get('/api/financial/accounts').catch(() => ({ data: [] })),
        api.get('/api/customers?limit=200').catch(() => ({ data: { items: [] } })),
        api.get('/api/suppliers?limit=200').catch(() => ({ data: { items: [] } })),
      ]);

      setPayments(Array.isArray(payRes.data) ? payRes.data : []);
      setAccounts(Array.isArray(accRes.data) ? accRes.data : []);
      setCustomers(Array.isArray(custRes.data) ? custRes.data : custRes.data?.items || []);
      setSuppliers(Array.isArray(suppRes.data) ? suppRes.data : suppRes.data?.items || []);
    } catch (err) {
      console.error('Failed to load payments:', err);
      toast.error('Failed to load payments data');
    } finally {
      setLoading(false);
    }
  };

  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((a) => map.set(a.id, `${a.name} (${a.code})`));
    return map;
  }, [accounts]);

  const partyMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c) => map.set(c.id, c.name));
    suppliers.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [customers, suppliers]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesTab = 
        activeTab === 'all' || 
        (activeTab === 'customer' && p.party_type === 'customer') ||
        (activeTab === 'supplier' && p.party_type === 'supplier');

      const partyName = partyMap.get(p.party_id) || '';
      const accName = accountMap.get(p.account_id) || '';
      const matchesSearch = 
        p.payment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.reference_number && p.reference_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        accName.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesTab && matchesSearch;
    });
  }, [payments, activeTab, searchTerm, partyMap, accountMap]);

  // Aggregate stats
  const totalReceipts = useMemo(() => {
    return payments
      .filter((p) => p.party_type === 'customer')
      .reduce((sum, p) => sum + parseFloat(String(p.amount || 0)), 0);
  }, [payments]);

  const totalDisbursements = useMemo(() => {
    return payments
      .filter((p) => p.party_type === 'supplier')
      .reduce((sum, p) => sum + parseFloat(String(p.amount || 0)), 0);
  }, [payments]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payments & Receipts Hub</h1>
            <p className="text-sm text-muted-foreground">
              Manage incoming collections from customers and outgoing disbursements to suppliers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/payments/accounts">
              <Button variant="outline">
                <Landmark className="mr-2 h-4 w-4" /> Bank Accounts
              </Button>
            </Link>
            <Link href="/payments/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Record Payment / Receipt
              </Button>
            </Link>
          </div>
        </div>

        {/* Summary Stat Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customer Collections</CardTitle>
              <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(totalReceipts)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Inflow from customer invoices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Supplier Payments</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-rose-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600">
                {formatCurrency(totalDisbursements)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Outflow against purchase invoices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Cashflow Movement</CardTitle>
              <CreditCard className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalReceipts - totalDisbursements >= 0 ? 'text-primary' : 'text-rose-600'}`}>
                {formatCurrency(totalReceipts - totalDisbursements)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Collections minus supplier disbursements</p>
            </CardContent>
          </Card>
        </div>

        {/* Tab Selection & Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as any)}
                className="w-full sm:w-auto"
              >
                <TabsList>
                  <TabsTrigger value="all">All Payments ({payments.length})</TabsTrigger>
                  <TabsTrigger value="customer">Customer Receipts</TabsTrigger>
                  <TabsTrigger value="supplier">Supplier Payments</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search voucher, party, account..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
                <p>Loading transactions...</p>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CreditCard className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-semibold">No payments recorded</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
                  {searchTerm 
                    ? 'No transactions match your search filter.' 
                    : 'Record your first receipt or vendor payment to maintain cash books.'}
                </p>
                <Link href="/payments/new">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Record Payment
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Party Name</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount (PKR)</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((p) => {
                      const isReceipt = p.party_type === 'customer';
                      const partyName = partyMap.get(p.party_id) || 'Unknown Party';
                      const accountName = accountMap.get(p.account_id) || 'Financial Account';

                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono font-medium text-xs">
                            {p.payment_number}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {formatDate(p.payment_date)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                isReceipt
                                  ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                                  : 'border-rose-300 text-rose-700 bg-rose-50'
                              }
                            >
                              {isReceipt ? (
                                <ArrowDownLeft className="mr-1 h-3 w-3 inline" />
                              ) : (
                                <ArrowUpRight className="mr-1 h-3 w-3 inline" />
                              )}
                              {isReceipt ? 'Receipt' : 'Payment'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {partyName}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {accountName}
                          </TableCell>
                          <TableCell className="text-xs capitalize">
                            {p.payment_method.replace('_', ' ')}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {p.reference_number || '—'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            <span className={isReceipt ? 'text-emerald-600' : 'text-rose-600'}>
                              {formatCurrency(p.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="capitalize text-[11px]">
                              {p.status || 'posted'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
