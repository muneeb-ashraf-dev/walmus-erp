'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Tag, Plus, ArrowLeft, Loader2, RefreshCw, 
  CheckCircle, ListFilter
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
import { ExpenseCategory } from '@/types';
import toast from 'react-hot-toast';

export default function ExpenseCategoriesPage() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('0');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/financial/expense-categories');
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load expense categories:', err);
      toast.error('Failed to load expense categories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error('Code and Name are required');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        sort_order: parseInt(sortOrder, 10) || 0,
        is_active: true,
      };

      await api.post('/api/financial/expense-categories', payload);
      toast.success('Expense category added!');
      setIsDialogOpen(false);
      setCode('');
      setName('');
      setDescription('');
      setSortOrder('0');
      fetchCategories();
    } catch (err: any) {
      console.error('Failed to create category:', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || 'Failed to create category';
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
            <Link href="/expenses">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Expense Categories</h1>
              <p className="text-sm text-muted-foreground">
                Classify marketing, doctor samples, fuel, utilities, and administrative outlays
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchCategories} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" /> New Category
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleCreate}>
                  <DialogHeader>
                    <DialogTitle>Add Expense Category</DialogTitle>
                    <DialogDescription>
                      Create a standard classification code for recurring operating expenses.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="cat_code">Code (Uppercase) *</Label>
                        <Input
                          id="cat_code"
                          placeholder="e.g. SAMPLES"
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="sort">Sort Order</Label>
                        <Input
                          id="sort"
                          type="number"
                          value={sortOrder}
                          onChange={(e) => setSortOrder(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="cat_name">Category Name *</Label>
                      <Input
                        id="cat_name"
                        placeholder="e.g. Doctor Promotional Samples"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="cat_desc">Description</Label>
                      <Input
                        id="cat_desc"
                        placeholder="Optional remarks on acceptable expenses"
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
                      Save Category
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Categories Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Expense Categories</CardTitle>
            <CardDescription>
              Configured categories used across expense vouchers and profit & loss breakdowns
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
                <p>Loading categories...</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No expense categories found. Add your first category above.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Sort</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Category Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((cat) => (
                      <TableRow key={cat.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {cat.sort_order}
                        </TableCell>
                        <TableCell className="font-mono font-semibold text-xs">
                          {cat.code}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {cat.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-sm truncate">
                          {cat.description || '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="outline" 
                            className={cat.is_active ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-200 text-gray-500'}
                          >
                            {cat.is_active ? 'Active' : 'Inactive'}
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
