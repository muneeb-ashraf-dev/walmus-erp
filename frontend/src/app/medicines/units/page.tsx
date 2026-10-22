'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Scale,
  Plus,
  Search,
  RefreshCw,
  Edit,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { MedicineUnit } from '@/types';

const unitSchema = z.object({
  code: z
    .string()
    .min(1, 'Unit code is required')
    .max(20, 'Max 20 characters')
    .regex(/^[A-Z0-9_]+$/, 'Only uppercase letters, numbers, and underscores allowed'),
  name: z.string().min(1, 'Unit name is required').max(50),
  description: z.string().max(200).optional().or(z.literal('')),
  is_base_unit: z.boolean().default(false),
  sort_order: z.coerce.number().int().default(0),
});

type UnitFormData = z.infer<typeof unitSchema>;

export default function MedicineUnitsPage() {
  const [units, setUnits] = useState<MedicineUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<MedicineUnit | null>(null);

  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    setValue: setCreateValue,
    watch: watchCreate,
    formState: { errors: errorsCreate },
  } = useForm<UnitFormData>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      is_base_unit: false,
      sort_order: 0,
    },
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    setValue: setEditValue,
    watch: watchEdit,
    formState: { errors: errorsEdit },
  } = useForm<UnitFormData>({
    resolver: zodResolver(unitSchema),
  });

  const fetchUnits = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/medicines/units');
      const data = Array.isArray(response.data) ? response.data : (response.data.items || []);
      setUnits(data);
    } catch (error: any) {
      toast.error('Failed to load medicine units');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const handleCreateSubmit = async (data: UnitFormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        description: data.description?.trim() || null,
        is_base_unit: data.is_base_unit,
        sort_order: Number(data.sort_order) || 0,
      };

      const response = await api.post('/api/medicines/units', payload);
      setUnits((prev) => [...prev, response.data]);
      toast.success('Unit created successfully!');
      setIsCreateOpen(false);
      resetCreate();
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.error?.message || 'Failed to create unit';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (u: MedicineUnit) => {
    setEditingUnit(u);
    setEditValue('code', u.code);
    setEditValue('name', u.name);
    setEditValue('description', u.description || '');
    setEditValue('is_base_unit', u.is_base_unit);
    setEditValue('sort_order', u.sort_order);
  };

  const handleEditSubmit = async (data: UnitFormData) => {
    if (!editingUnit) return;
    setIsSubmitting(true);
    try {
      const payload = {
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        description: data.description?.trim() || null,
        is_base_unit: data.is_base_unit,
        sort_order: Number(data.sort_order) || 0,
      };

      const response = await api.patch(`/api/medicines/units/${editingUnit.id}`, payload);
      setUnits((prev) =>
        prev.map((item) => (item.id === editingUnit.id ? response.data : item))
      );
      toast.success('Unit updated successfully!');
      setEditingUnit(null);
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.error?.message || 'Failed to update unit';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUnits = units.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.code.toLowerCase().includes(search.toLowerCase()) ||
      (u.description && u.description.toLowerCase().includes(search.toLowerCase()))
  );

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
              <h1 className="text-2xl font-bold tracking-tight">Units of Measure</h1>
              <p className="text-sm text-muted-foreground">
                Configure measurement units for pharmaceutical packaging, inventory counting, and billing
              </p>
            </div>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Unit
          </Button>
        </div>

        {/* Filter bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search units by code or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => fetchUnits()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Units Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Unit Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Base Unit Type</TableHead>
                  <TableHead className="text-center">Sort Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                      Loading units...
                    </TableCell>
                  </TableRow>
                ) : filteredUnits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Scale className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="text-base font-medium">No units found</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {search ? 'Try clearing your search query' : 'Create standard units like TAB, CAP, BTL, BOX'}
                      </p>
                      <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add First Unit
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUnits.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono font-bold text-sm">{u.code}</TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.description || '—'}
                      </TableCell>
                      <TableCell>
                        {u.is_base_unit ? (
                          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                            Base Counting Unit
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Package Unit</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {u.sort_order}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(u)}
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

        {/* Create Unit Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Medicine Unit</DialogTitle>
              <DialogDescription>
                Define a unit of measure for pharmaceutical products (e.g. TAB, BOX, VIAL)
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitCreate(handleCreateSubmit)} className="space-y-4 py-2">
              <Input
                label="Unit Code *"
                placeholder="e.g. TAB, CAP, BTL, STRIP"
                error={errorsCreate.code?.message}
                helperText="Uppercase alphanumeric characters & underscores only"
                {...registerCreate('code', {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase();
                  },
                })}
              />

              <Input
                label="Unit Display Name *"
                placeholder="e.g. Tablet, Capsule, Bottle"
                error={errorsCreate.name?.message}
                {...registerCreate('name')}
              />

              <Input
                label="Description"
                placeholder="e.g. Individual tablet oral dose"
                error={errorsCreate.description?.message}
                {...registerCreate('description')}
              />

              <Input
                type="number"
                label="Sort Order"
                placeholder="0"
                error={errorsCreate.sort_order?.message}
                helperText="Lower numbers appear first in lists"
                {...registerCreate('sort_order')}
              />

              <div className="flex items-center justify-between border p-3 rounded-md">
                <div>
                  <p className="text-sm font-medium">Is Base Unit?</p>
                  <p className="text-xs text-muted-foreground">
                    Mark if this is an indivisible unit (e.g. Tablet, Ampoule) used for internal stock calculations
                  </p>
                </div>
                <Switch
                  checked={watchCreate('is_base_unit')}
                  onCheckedChange={(checked) => setCreateValue('is_base_unit', checked)}
                />
              </div>

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
                    'Add Unit'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Unit Dialog */}
        <Dialog
          open={!!editingUnit}
          onOpenChange={(open) => !open && setEditingUnit(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Unit</DialogTitle>
              <DialogDescription>Modify measurement unit settings</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitEdit(handleEditSubmit)} className="space-y-4 py-2">
              <Input
                label="Unit Code *"
                placeholder="e.g. TAB"
                error={errorsEdit.code?.message}
                {...registerEdit('code', {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase();
                  },
                })}
              />

              <Input
                label="Unit Display Name *"
                placeholder="e.g. Tablet"
                error={errorsEdit.name?.message}
                {...registerEdit('name')}
              />

              <Input
                label="Description"
                error={errorsEdit.description?.message}
                {...registerEdit('description')}
              />

              <Input
                type="number"
                label="Sort Order"
                error={errorsEdit.sort_order?.message}
                {...registerEdit('sort_order')}
              />

              <div className="flex items-center justify-between border p-3 rounded-md">
                <div>
                  <p className="text-sm font-medium">Is Base Unit?</p>
                  <p className="text-xs text-muted-foreground">
                    Base counting unit for inventory
                  </p>
                </div>
                <Switch
                  checked={watchEdit('is_base_unit')}
                  onCheckedChange={(checked) => setEditValue('is_base_unit', checked)}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUnit(null)}
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
