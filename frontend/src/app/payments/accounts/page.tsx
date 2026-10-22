'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Landmark, Plus, ArrowLeft, Wallet, Building2, 
  CheckCircle, Loader2, RefreshCw, AlertCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FinancialAccount, CashBankBalance } from '@/types';
import toast from 'react-hot-toast';

export default function FinancialAccountsPage() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [balance, setBalance] = useState<CashBankBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // New Account form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('asset');
  const [currency, setCurrency] = useState('PKR');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchAccountsData();
  }, []);

  const fetchAccountsData = async () => {
    setLoading(true);
    try {
      const [accRes, balRes] = await Promise.all([
        api.get('/api/financial/accounts'),
        api.get('/api/financial/cash-bank-balance').catch(() => ({ data: null })),
      ]);
      setAccounts(Array.isArray(accRes.data) ? accRes.data : []);
      if (balRes.data) {
        setBalance(balRes.data);
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
      toast.error('Failed to load financial accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error('Account Code and Name are required');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        account_type: accountType,
        currency,
        opening_balance: parseFloat(openingBalance) || 0,
        description: description.trim() || undefined,
        is_active: true,
      };

      await api.post('/api/financial/accounts', payload);
      toast.success('Financial account created successfully!');
      setIsDialogOpen(false);
      // Reset form
      setCode('');
      setName('');
      setDescription('');
      setOpeningBalance('0');
      fetchAccountsData();
    } catch (err: any) {
      console.error('Failed to create account:', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || 'Failed to create account';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/payments">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Financial Accounts & Balances</h1>
              <p className="text-sm text-muted-foreground">
                Manage chart of accounts, cash drawers, and bank ledgers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchAccountsData} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" /> New Account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleCreateAccount}>
                  <DialogHeader>
                    <DialogTitle>Add Financial Account</DialogTitle>
                    <DialogDescription>
                      Create a new bank, cash, receivable, or expense account in the ledger.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="code">Code (Uppercase) *</Label>
                        <Input
                          id="code"
                          placeholder="e.g. BANK_HBL"
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="type">Account Type *</Label>
                        <select
                          id="type"
                          value={accountType}
                          onChange={(e) => setAccountType(e.target.value)}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="asset">Asset (Bank/Cash/Receivable)</option>
                          <option value="liability">Liability (Payable/Tax)</option>
                          <option value="equity">Equity (Capital/Drawings)</option>
                          <option value="revenue">Revenue (Sales)</option>
                          <option value="expense">Expense</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="name">Account Name *</Label>
                      <Input
                        id="name"
                        placeholder="e.g. Habib Bank Limited - Main"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="bal">Opening Balance (PKR)</Label>
                        <Input
                          id="bal"
                          type="number"
                          step="any"
                          value={openingBalance}
                          onChange={(e) => setOpeningBalance(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cur">Currency</Label>
                        <Input
                          id="cur"
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                          maxLength={3}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="desc">Description / Notes</Label>
                      <Input
                        id="desc"
                        placeholder="Optional details, account number, or branch"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      disabled={creating}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={creating}>
                      {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Create Account
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Cash & Bank Balances Overview */}
        {balance && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cash in Hand</CardTitle>
                <Wallet className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(balance.cash_balance)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Active cash register & petty cash drawer
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bank Balance</CardTitle>
                <Building2 className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(balance.bank_balance)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cleared funds in commercial bank accounts
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-primary">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Liquid Capital</CardTitle>
                <Landmark className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(balance.total)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Combined cash and bank liquidity
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Accounts Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chart of Accounts</CardTitle>
            <CardDescription>
              All configured financial accounts used in double-entry journal vouchers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
                <p>Loading accounts...</p>
              </div>
            ) : accounts.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No accounts found. Create your first financial account above.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead className="text-right">Opening Balance</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((acc) => (
                      <TableRow key={acc.id}>
                        <TableCell className="font-mono font-semibold text-xs">
                          {acc.code}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {acc.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {acc.account_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {acc.currency}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs">
                          {formatCurrency(acc.opening_balance)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {acc.description || '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="outline"
                            className={acc.is_active ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-200 text-gray-500'}
                          >
                            {acc.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
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
