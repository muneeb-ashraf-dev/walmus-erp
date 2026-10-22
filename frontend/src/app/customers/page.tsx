'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Search,
  RefreshCw,
  Phone,
  Building2,
  Stethoscope,
  Building,
  MapPin,
  DollarSign,
  Filter,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Customer } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all');

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/customers', {
        params: {
          search: search || undefined,
          customer_type: customerTypeFilter !== 'all' ? customerTypeFilter : undefined,
          limit: 100,
        },
      });
      const data = Array.isArray(response.data) ? response.data : (response.data.items || []);
      setCustomers(data);
    } catch (error: any) {
      toast.error('Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, customerTypeFilter]);

  const pharmacyCount = customers.filter((c) => c.customer_type === 'pharmacy').length;
  const doctorCount = customers.filter((c) => c.customer_type === 'doctor').length;
  const clinicHospitalCount = customers.filter(
    (c) => c.customer_type === 'hospital' || c.customer_type === 'clinic'
  ).length;

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customers & Doctor Contacts</h1>
            <p className="text-sm text-muted-foreground">
              Manage pharmacies, medical practitioners, clinics, and hospital credit accounts
            </p>
          </div>
          <Button asChild>
            <Link href="/customers/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Customer / Doctor
            </Link>
          </Button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Accounts</p>
                <p className="text-2xl font-bold">{customers.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Across all client sectors</p>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Pharmacies</p>
                <p className="text-2xl font-bold text-emerald-600">{pharmacyCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Retail medicine stores</p>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                <Building2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Doctors & Consultants</p>
                <p className="text-2xl font-bold text-blue-600">{doctorCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Prescribers & investment partners</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
                <Stethoscope className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Clinics & Hospitals</p>
                <p className="text-2xl font-bold text-purple-600">{clinicHospitalCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Institutional accounts</p>
              </div>
              <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600">
                <Building className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 items-center w-full sm:w-auto flex-1">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name, phone, area, specialty..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="w-full sm:w-52">
                  <Select
                    value={customerTypeFilter}
                    onValueChange={(val) => setCustomerTypeFilter(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Customer Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="pharmacy">Pharmacies</SelectItem>
                      <SelectItem value="doctor">Doctors</SelectItem>
                      <SelectItem value="hospital">Hospitals</SelectItem>
                      <SelectItem value="clinic">Clinics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button variant="ghost" size="sm" onClick={() => fetchCustomers()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Customer Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer / Doctor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Area / Territory</TableHead>
                  <TableHead>Phone & Contact</TableHead>
                  <TableHead className="text-right">Opening Balance</TableHead>
                  <TableHead className="text-right">Credit Limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      Loading customer directory...
                    </TableCell>
                  </TableRow>
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Users className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="text-base font-medium">No customers found</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {search || customerTypeFilter !== 'all'
                          ? 'Try adjusting your filters or clearing search query'
                          : 'Register pharmacies, doctors, and healthcare institutions to start billing'}
                      </p>
                      <Button asChild size="sm">
                        <Link href="/customers/new">
                          <Plus className="mr-2 h-4 w-4" />
                          Add First Customer
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/customers/${c.id}`}
                          className="hover:underline text-primary font-semibold block"
                        >
                          {c.name}
                        </Link>
                        {c.specialty && (
                          <span className="text-xs text-muted-foreground block">
                            Specialty: {c.specialty}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{getCustomerTypeBadge(c.customer_type)}</TableCell>
                      <TableCell className="text-sm">
                        {c.area ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {c.area}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-mono text-xs">{c.phone || '—'}</div>
                        {c.contact_person && (
                          <div className="text-xs text-muted-foreground">
                            {c.contact_person}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(Number(c.opening_balance) || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {Number(c.credit_limit) > 0 ? formatCurrency(Number(c.credit_limit)) : 'No limit'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.is_active ? 'default' : 'secondary'}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/customers/${c.id}`}>Details</Link>
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
