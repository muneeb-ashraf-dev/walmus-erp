'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  Edit,
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Manufacturer } from '@/types';

const manufacturerSchema = z.object({
  name: z.string().min(1, 'Manufacturer name is required').max(200),
  contact_person: z.string().max(100).optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  email: z.string().email('Invalid email address').max(100).optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  tax_number: z.string().max(50).optional().or(z.literal('')),
  is_active: z.boolean().default(true),
});

type ManufacturerFormData = z.infer<typeof manufacturerSchema>;

export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null);

  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    formState: { errors: errorsCreate },
  } = useForm<ManufacturerFormData>({
    resolver: zodResolver(manufacturerSchema),
    defaultValues: {
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      tax_number: '',
      is_active: true,
    },
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    setValue: setEditValue,
    watch: watchEdit,
    formState: { errors: errorsEdit },
  } = useForm<ManufacturerFormData>({
    resolver: zodResolver(manufacturerSchema),
  });

  const fetchManufacturers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/medicines/manufacturers', {
        params: {
          search: search || undefined,
          limit: 100,
        },
      });
      const data = Array.isArray(response.data) ? response.data : (response.data.items || []);
      setManufacturers(data);
    } catch (error: any) {
      toast.error('Failed to load manufacturers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchManufacturers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCreateSubmit = async (data: ManufacturerFormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: data.name.trim(),
        contact_person: data.contact_person?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        address: data.address?.trim() || null,
        tax_number: data.tax_number?.trim() || null,
        is_active: true,
      };

      const response = await api.post('/api/medicines/manufacturers', payload);
      setManufacturers((prev) => [...prev, response.data]);
      toast.success('Manufacturer added successfully!');
      setIsCreateOpen(false);
      resetCreate();
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.error?.message || 'Failed to add manufacturer';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (m: Manufacturer) => {
    setEditingManufacturer(m);
    setEditValue('name', m.name);
    setEditValue('contact_person', m.contact_person || '');
    setEditValue('phone', m.phone || '');
    setEditValue('email', m.email || '');
    setEditValue('address', m.address || '');
    setEditValue('tax_number', m.tax_number || '');
    setEditValue('is_active', m.is_active);
  };

  const handleEditSubmit = async (data: ManufacturerFormData) => {
    if (!editingManufacturer) return;
    setIsSubmitting(true);
    try {
      const payload = {
        name: data.name.trim(),
        contact_person: data.contact_person?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        address: data.address?.trim() || null,
        tax_number: data.tax_number?.trim() || null,
        is_active: data.is_active,
      };

      const response = await api.patch(
        `/api/medicines/manufacturers/${editingManufacturer.id}`,
        payload
      );
      setManufacturers((prev) =>
        prev.map((item) => (item.id === editingManufacturer.id ? response.data : item))
      );
      toast.success('Manufacturer updated successfully!');
      setEditingManufacturer(null);
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.error?.message || 'Failed to update manufacturer';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link href="/medicines">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Manufacturers</h1>
              <p className="text-sm text-muted-foreground">
                Manage pharmaceutical companies, producers, and licensing principals
              </p>
            </div>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Manufacturer
          </Button>
        </div>

        {/* Search & Actions Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by company name, contact, phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => fetchManufacturers()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Manufacturers Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                      Loading manufacturers...
                    </TableCell>
                  </TableRow>
                ) : manufacturers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Building2 className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="text-base font-medium">No manufacturers registered</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {search ? 'Try clearing your search query' : 'Add pharmaceutical companies to group your medicines'}
                      </p>
                      <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add First Manufacturer
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  manufacturers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>{m.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{m.contact_person || '—'}</TableCell>
                      <TableCell className="text-sm font-mono">{m.phone || '—'}</TableCell>
                      <TableCell className="text-sm">{m.email || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {m.address || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.is_active ? 'default' : 'secondary'}>
                          {m.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(m)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create Manufacturer Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Register Manufacturer</DialogTitle>
              <DialogDescription>
                Add a new pharmaceutical manufacturer or partner company
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitCreate(handleCreateSubmit)} className="space-y-4 py-2">
              <Input
                label="Company Name *"
                placeholder="e.g. GSK Pakistan, Abbott Laboratories"
                error={errorsCreate.name?.message}
                {...registerCreate('name')}
              />

              <Input
                label="Contact Person"
                placeholder="e.g. Dr. Tariq Mahmood"
                error={errorsCreate.contact_person?.message}
                {...registerCreate('contact_person')}
              />

              <Input
                label="Phone Number"
                placeholder="e.g. 021-111-222-333"
                error={errorsCreate.phone?.message}
                {...registerCreate('phone')}
              />

              <Input
                label="Email Address"
                placeholder="info@company.com"
                type="email"
                error={errorsCreate.email?.message}
                {...registerCreate('email')}
              />

              <Input
                label="Tax / NTN Number"
                placeholder="e.g. 1234567-8"
                error={errorsCreate.tax_number?.message}
                {...registerCreate('tax_number')}
              />

              <Textarea
                label="Office / Factory Address"
                placeholder="Industrial Area, Karachi"
                rows={2}
                error={errorsCreate.address?.message}
                {...registerCreate('address')}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Add Manufacturer'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Manufacturer Dialog */}
        <Dialog
          open={!!editingManufacturer}
          onOpenChange={(open) => !open && setEditingManufacturer(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Manufacturer</DialogTitle>
              <DialogDescription>
                Modify details for {editingManufacturer?.name}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitEdit(handleEditSubmit)} className="space-y-4 py-2">
              <Input
                label="Company Name *"
                placeholder="e.g. GSK Pakistan"
                error={errorsEdit.name?.message}
                {...registerEdit('name')}
              />

              <Input
                label="Contact Person"
                placeholder="e.g. Dr. Tariq Mahmood"
                error={errorsEdit.contact_person?.message}
                {...registerEdit('contact_person')}
              />

              <Input
                label="Phone Number"
                placeholder="e.g. 021-111-222-333"
                error={errorsEdit.phone?.message}
                {...registerEdit('phone')}
              />

              <Input
                label="Email Address"
                placeholder="info@company.com"
                type="email"
                error={errorsEdit.email?.message}
                {...registerEdit('email')}
              />

              <Input
                label="Tax / NTN Number"
                placeholder="e.g. 1234567-8"
                error={errorsEdit.tax_number?.message}
                {...registerEdit('tax_number')}
              />

              <Textarea
                label="Office / Factory Address"
                rows={2}
                error={errorsEdit.address?.message}
                {...registerEdit('address')}
              />

              <div className="flex items-center justify-between border p-3 rounded-md">
                <div>
                  <p className="text-sm font-medium">Active Status</p>
                  <p className="text-xs text-muted-foreground">
                    Inactive manufacturers cannot be linked to new medicines
                  </p>
                </div>
                <Switch
                  checked={watchEdit('is_active') ?? true}
                  onCheckedChange={(checked) => setEditValue('is_active', checked)}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingManufacturer(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
