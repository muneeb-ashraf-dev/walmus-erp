'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Receipt, Plus, Tag, Calendar, Search, Filter, 
  Loader2, DollarSign, ArrowDownRight, RefreshCw, AlertCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Expense, ExpenseCategory, FinancialAccount } from '@/types';
import toast from 'react-hot-toast';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [expRes, catRes, accRes] = await Promise.all([
        api.get('/api/financial/expenses?limit=200'),
        api.get('/api/financial/expense-categories').catch(() => ({ data: [] })),
        api.get('/api/financial/accounts').catch(() => ({ data: [] })),
      ]);

      setExpenses(Array.isArray(expRes.data) ? expRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setAccounts(Array.isArray(accRes.data) ? accRes.data : []);
    } catch (err) {
      console.error('Failed to load expenses data:', err);
      toast.error('Failed to load expenses list');
    } finally {
      setLoading(false);
    }
  };

  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [accounts]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      // Category filter
      const matchesCategory = selectedCategory === 'all' || e.category_id === selectedCategory;

      // Date range filter
      const expDate = e.expense_date;
      const matchesDateFrom = !dateFrom || expDate >= dateFrom;
      const matchesDateTo = !dateTo || expDate <= dateTo;

      // Search filter
      const catName = e.category?.name || categoryMap.get(e.category_id) || '';
      const accName = e.account?.name || accountMap.get(e.account_id) || '';
      const desc = e.description || '';
      const expNum = e.expense_number || '';
      const ref = e.reference_number || '';

      const matchesSearch =
        expNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
        catName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        accName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ref.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesCategory && matchesDateFrom && matchesDateTo && matchesSearch;
    });
  }, [expenses, selectedCategory, dateFrom, dateTo, searchTerm, categoryMap, accountMap]);

  // Aggregate monthly total
  const currentMonthTotal = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return expenses
      .filter((e) => {
        const d = new Date(e.expense_date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      })
      .reduce((sum, e) => sum + parseFloat(String(e.amount || 0)), 0);
  }, [expenses]);

  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + parseFloat(String(e.amount || 0)), 0);
  }, [filteredExpenses]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Operating Expenses</h1>
            <p className="text-sm text-muted-foreground">
              Track administrative costs, promotional spending, clinic sample allowances, and overhead
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/expenses/categories">
              <Button variant="outline">
                <Tag className="mr-2 h-4 w-4" /> Categories
              </Button>
            </Link>
            <Link href="/expenses/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Record Expense
              </Button>
            </Link>
          </div>
        </div>

        {/* Expense KPI Metrics */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month&apos;s Expenses</CardTitle>
              <Receipt className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(currentMonthTotal)}</div>
              <p className="text-xs text-muted-foreground mt-1">Current calendar month total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Filtered Selection Total</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {formatCurrency(filteredTotal)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {filteredExpenses.length} matching voucher records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expense Categories</CardTitle>
              <Tag className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{categories.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active departmental classifications</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Search text */}
              <div className="relative sm:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search voucher, memo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Category selector */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <Input
                  type="date"
                  placeholder="Date From"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              {/* Date To */}
              <div className="flex gap-2">
                <Input
                  type="date"
                  placeholder="Date To"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
                {(dateFrom || dateTo || selectedCategory !== 'all' || searchTerm) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 text-xs px-2"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                      setSelectedCategory('all');
                      setSearchTerm('');
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Vouchers</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
                <p>Loading expense vouchers...</p>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Receipt className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-semibold">No expenses found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
                  {searchTerm || selectedCategory !== 'all' || dateFrom || dateTo
                    ? 'No expenses match the selected filters.'
                    : 'Record your operating expenses like rent, salaries, utilities, samples, or travel.'}
                </p>
                <Link href="/expenses/new">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Record Expense
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Voucher #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Paid From Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Ref #</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Amount (PKR)</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((exp) => {
                      const categoryName = exp.category?.name || categoryMap.get(exp.category_id) || 'General';
                      const accountName = exp.account?.name || accountMap.get(exp.account_id) || 'Cash / Bank';

                      return (
                        <TableRow key={exp.id}>
                          <TableCell className="font-mono font-medium text-xs">
                            {exp.expense_number}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {formatDate(exp.expense_date)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {categoryName}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {accountName}
                          </TableCell>
                          <TableCell className="text-xs max-w-xs truncate">
                            {exp.description || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {exp.reference_number || '—'}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {exp.tax_amount > 0 ? formatCurrency(exp.tax_amount) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm">
                            {formatCurrency(exp.amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="capitalize text-[11px]">
                              {exp.status || 'posted'}
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
