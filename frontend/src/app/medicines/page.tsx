'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Pill, Plus, Search, Filter, AlertTriangle, 
  ArrowUpDown, ExternalLink, RefreshCw, Building2, Scale
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
import { Medicine } from '@/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchMedicines = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/medicines', {
        params: {
          search: search || undefined,
          limit: 50,
          offset: (page - 1) * 50,
        },
      });
      const items = Array.isArray(response.data) ? response.data : (response.data.items || []);
      setMedicines(items);
      setTotal(response.data.total ?? items.length);
    } catch (error: any) {
      toast.error('Failed to load medicines');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMedicines();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, page]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Medicine Master</h1>
            <p className="text-sm text-muted-foreground">
              Manage your pharmaceutical catalogue, pricing, and pack configurations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/medicines/manufacturers">
                <Building2 className="mr-2 h-4 w-4" />
                Manufacturers
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/medicines/units">
                <Scale className="mr-2 h-4 w-4" />
                Units
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/medicines/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Medicine
              </Link>
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code, brand name, generic..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => fetchMedicines()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Medicines Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Brand Name</TableHead>
                  <TableHead>Generic / Strength</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Pack Info</TableHead>
                  <TableHead className="text-right">Purchase Rate</TableHead>
                  <TableHead className="text-right">Sale Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      Loading medicines...
                    </TableCell>
                  </TableRow>
                ) : medicines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <Pill className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="text-base font-medium">No medicines found</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {search ? 'Try clearing your search query' : 'Get started by adding your first medicine'}
                      </p>
                      <Button asChild size="sm">
                        <Link href="/medicines/new">Add Medicine</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  medicines.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs font-semibold">{m.product_code}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/medicines/${m.id}`} className="hover:underline text-primary">
                          {m.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{m.generic_name || '—'}</div>
                        {m.strength && <div className="text-xs text-muted-foreground">{m.strength}</div>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.manufacturer?.name || '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {m.units_per_pack} {m.base_unit?.name || 'Units'} / pack
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(m.default_purchase_rate)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium text-green-600">
                        {formatCurrency(m.default_sale_rate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.is_active ? 'default' : 'secondary'}>
                          {m.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/medicines/${m.id}`}>
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
