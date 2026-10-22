'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Truck,
  Plus,
  Search,
  RefreshCw,
  Phone,
  Mail,
  CreditCard,
  Building2,
  Calendar,
  ExternalLink,
  DollarSign,
  Users,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Supplier } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/suppliers', {
        params: {
          search: search || undefined,
          limit: 100,
        },
      });
      const data = Array.isArray(response.data) ? response.data : (response.data.items || []);
      setSuppliers(data);
    } catch (error: any) {
      toast.error('Failed to load suppliers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuppliers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const activeCount = suppliers.filter((s) => s.is_active).length;
  const totalOpeningBalance = suppliers.reduce((sum, s) => sum + (Number(s.opening_balance) || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Suppliers & Vendors</h1>
            <p className="text-sm text-muted-foreground">
              Manage pharmaceutical distributors, credit accounts, and purchase terms
            </p>
          </div>
          <Button asChild>
            <Link href="/suppliers/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Supplier
            </Link>
          </Button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Suppliers</p>
                <p className="text-2xl font-bold">{suppliers.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeCount} active in supply chain
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <Truck className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active Vendors</p>
                <p className="text-2xl font-bold text-green-600">{activeCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Authorized for procurement
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-green-500/10 text-green-600">
                <Building2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Opening Balances</p>
                <p className="text-2xl font-bold font-mono text-primary">
                  {formatCurrency(totalOpeningBalance)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sum of vendor ledger starts
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Actions Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by vendor name, contact person, phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => fetchSuppliers()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Suppliers Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Phone & Email</TableHead>
                  <TableHead className="text-right">Opening Balance</TableHead>
                  <TableHead className="text-right">Credit Limit</TableHead>
                  <TableHead>Payment Terms</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      Loading suppliers...
                    </TableCell>
                  </TableRow>
                ) : suppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Truck className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="text-base font-medium">No suppliers found</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {search ? 'Try clearing your search query' : 'Register your first pharmaceutical supplier or distributor'}
                      </p>
                      <Button asChild size="sm">
                        <Link href="/suppliers/new">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Supplier
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/suppliers/${s.id}`}
                          className="hover:underline text-primary font-semibold block"
                        >
                          {s.name}
                        </Link>
                        {s.tax_number && (
                          <span className="text-xs text-muted-foreground font-mono">
                            NTN: {s.tax_number}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.contact_person || '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-mono text-xs">{s.phone || '—'}</div>
                        {s.email && (
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {s.email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(Number(s.opening_balance) || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {Number(s.credit_limit) > 0 ? formatCurrency(Number(s.credit_limit)) : 'No limit'}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {s.payment_terms_days} Days
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.is_active ? 'default' : 'secondary'}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/suppliers/${s.id}`}>
                            Details
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
