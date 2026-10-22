'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Pill,
  Edit,
  Trash2,
  Loader2,
  Building2,
  Scale,
  DollarSign,
  AlertTriangle,
  Calendar,
  Layers,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Archive
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Medicine, MedicineBatch, Manufacturer, MedicineUnit } from '@/types';
import { 
  formatCurrency, 
  formatDate, 
  getExpiryStatus, 
  getExpiryColor, 
  getExpiryLabel, 
  getStatusColor 
} from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function MedicineDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [units, setUnits] = useState<MedicineUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit Dialog State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Medicine>>({});

  // Delete Alert State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMedicineData = useCallback(async () => {
    if (!id) return;
    try {
      const [medRes, batchesRes] = await Promise.all([
        api.get(`/api/medicines/${id}`),
        api.get(`/api/medicines/${id}/batches`),
      ]);

      setMedicine(medRes.data);
      setBatches(batchesRes.data || []);
    } catch (error: any) {
      toast.error('Failed to load medicine details');
    }
  }, [id]);

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await fetchMedicineData();
      try {
        const [manRes, unitRes] = await Promise.all([
          api.get('/api/medicines/manufacturers', { params: { limit: 100 } }),
          api.get('/api/medicines/units'),
        ]);
        setManufacturers(Array.isArray(manRes.data) ? manRes.data : (manRes.data.items || []));
        setUnits(Array.isArray(unitRes.data) ? unitRes.data : (unitRes.data.items || []));
      } catch (err) {
        // non-blocking
      } finally {
        setIsLoading(false);
      }
    };

    loadAll();
  }, [fetchMedicineData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchMedicineData();
    setIsRefreshing(false);
    toast.success('Medicine data refreshed');
  };

  const openEditModal = () => {
    if (!medicine) return;
    setEditForm({
      name: medicine.name,
      generic_name: medicine.generic_name || '',
      product_code: medicine.product_code,
      strength: medicine.strength || '',
      dosage_form: medicine.dosage_form || '',
      packing_description: medicine.packing_description || '',
      manufacturer_id: medicine.manufacturer_id || '',
      units_per_pack: medicine.units_per_pack,
      default_purchase_rate: medicine.default_purchase_rate,
      default_sale_rate: medicine.default_sale_rate,
      wholesale_rate: medicine.wholesale_rate,
      retail_rate: medicine.retail_rate,
      tax_rate: medicine.tax_rate,
      reorder_level: medicine.reorder_level,
      barcode: medicine.barcode || '',
      notes: medicine.notes || '',
      is_active: medicine.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    setIsSavingEdit(true);
    try {
      const payload: Record<string, any> = {
        name: editForm.name?.trim(),
        generic_name: editForm.generic_name?.trim() || null,
        product_code: editForm.product_code?.trim().toUpperCase(),
        strength: editForm.strength?.trim() || null,
        dosage_form: editForm.dosage_form || null,
        packing_description: editForm.packing_description?.trim() || null,
        manufacturer_id: editForm.manufacturer_id || null,
        units_per_pack: Number(editForm.units_per_pack) || 1,
        default_purchase_rate: Number(editForm.default_purchase_rate) || 0,
        default_sale_rate: Number(editForm.default_sale_rate) || 0,
        wholesale_rate: editForm.wholesale_rate !== undefined && editForm.wholesale_rate !== null ? Number(editForm.wholesale_rate) : null,
        retail_rate: editForm.retail_rate !== undefined && editForm.retail_rate !== null ? Number(editForm.retail_rate) : null,
        tax_rate: Number(editForm.tax_rate) || 0,
        reorder_level: Number(editForm.reorder_level) || 0,
        barcode: editForm.barcode?.trim() || null,
        notes: editForm.notes?.trim() || null,
        is_active: editForm.is_active,
      };

      const response = await api.patch(`/api/medicines/${id}`, payload);
      setMedicine(response.data);
      toast.success('Medicine updated successfully!');
      setIsEditDialogOpen(false);
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.error?.message || 'Failed to update medicine';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/medicines/${id}`);
      toast.success('Medicine deleted or deactivated');
      router.push('/medicines');
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.error?.message || 'Failed to delete medicine';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading medicine profile...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!medicine) {
    return (
      <DashboardLayout>
        <div className="text-center py-16 space-y-4">
          <Pill className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h2 className="text-xl font-bold">Medicine Not Found</h2>
          <p className="text-sm text-muted-foreground">
            The requested medicine could not be loaded or may have been deleted.
          </p>
          <Button asChild>
            <Link href="/medicines">Back to Catalogue</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const totalStockInBaseUnits = batches.reduce((sum, b) => sum + (Number(b.available_quantity) || 0), 0);
  const totalStockValue = batches.reduce(
    (sum, b) => sum + (Number(b.available_quantity) || 0) * (Number(b.purchase_cost_per_unit) || 0),
    0
  );
  const grossMargin =
    medicine.default_sale_rate > 0
      ? (((medicine.default_sale_rate - medicine.default_purchase_rate) / medicine.default_sale_rate) * 100).toFixed(1)
      : '0.0';

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Top Navigation & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link href="/medicines">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{medicine.name}</h1>
                <Badge variant={medicine.is_active ? 'default' : 'secondary'}>
                  {medicine.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground font-mono">
                Code: {medicine.product_code}
                {medicine.generic_name && ` • Generic: ${medicine.generic_name}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={openEditModal}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Available Stock</p>
                <p className="text-2xl font-bold">
                  {totalStockInBaseUnits.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    {medicine.base_unit?.name || 'Units'}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pack of {medicine.units_per_pack}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Inventory Valuation</p>
                <p className="text-2xl font-bold font-mono text-primary">
                  {formatCurrency(totalStockValue)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  At purchase cost basis
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-green-500/10 text-green-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active Batches</p>
                <p className="text-2xl font-bold">{batches.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reorder level: {medicine.reorder_level} units
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
                <Calendar className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Standard Margin</p>
                <p className="text-2xl font-bold text-emerald-600">{grossMargin}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sale {formatCurrency(medicine.default_sale_rate)}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Details and Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Medicine Specifications */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Medicine Specifications</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Brand Name</span>
                <span className="font-medium text-foreground">{medicine.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Generic Name</span>
                <span className="font-medium text-foreground">{medicine.generic_name || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Manufacturer</span>
                <span className="font-medium text-foreground">
                  {medicine.manufacturer?.name || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Strength</span>
                <span className="font-medium text-foreground">{medicine.strength || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Dosage Form</span>
                <span className="font-medium text-foreground">{medicine.dosage_form || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Packaging</span>
                <span className="font-medium text-foreground">
                  {medicine.packing_description || `${medicine.units_per_pack} per pack`}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Base Unit</span>
                <span className="font-medium text-foreground">
                  {medicine.base_unit?.name || 'Unit'} ({medicine.base_unit?.code || '—'})
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Barcode</span>
                <span className="font-mono text-foreground">{medicine.barcode || '—'}</span>
              </div>
              {medicine.notes && (
                <div className="pt-1">
                  <span className="text-muted-foreground block mb-1">Notes:</span>
                  <p className="text-xs bg-muted p-2.5 rounded-md whitespace-pre-wrap">
                    {medicine.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Pricing Structure */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Pricing & Rate Structure</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Default Purchase Rate</span>
                <span className="font-mono font-semibold text-foreground">
                  {formatCurrency(medicine.default_purchase_rate)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Default Sale Rate</span>
                <span className="font-mono font-semibold text-green-600">
                  {formatCurrency(medicine.default_sale_rate)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Wholesale Rate</span>
                <span className="font-mono text-foreground">
                  {medicine.wholesale_rate ? formatCurrency(medicine.wholesale_rate) : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Retail Rate (MRP)</span>
                <span className="font-mono text-foreground">
                  {medicine.retail_rate ? formatCurrency(medicine.retail_rate) : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Sales Tax Rate</span>
                <span className="font-mono text-foreground">{medicine.tax_rate}%</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Reorder Threshold</span>
                <span className="font-medium text-foreground">
                  {medicine.reorder_level} {medicine.base_unit?.name || 'units'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Profit per Base Unit</span>
                <span className="font-mono font-medium text-emerald-600">
                  {formatCurrency(medicine.default_sale_rate - medicine.default_purchase_rate)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Batches Table Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Archive className="h-5 w-5 text-primary" />
                  Inventory Batches & Expiry Tracker
                </CardTitle>
                <CardDescription>
                  Tracking available quantities, lot numbers, and expiry alerts
                </CardDescription>
              </div>
              <Badge variant="outline" className="w-fit">
                {batches.length} Batch{batches.length !== 1 ? 'es' : ''} on record
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Expiry Status</TableHead>
                  <TableHead className="text-right">Available Qty</TableHead>
                  <TableHead className="text-right">Received Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      No stock batches available for this medicine yet. Batches are created automatically upon receiving purchase invoices.
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((b) => {
                    const expiryState = getExpiryStatus(b.expiry_date);
                    const expiryBadgeColor = getExpiryColor(expiryState);
                    const expiryLabel = getExpiryLabel(expiryState);
                    const batchVal = Number(b.available_quantity) * Number(b.purchase_cost_per_unit);

                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono font-semibold">{b.batch_number}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatDate(b.expiry_date)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${expiryBadgeColor}`}
                          >
                            {expiryLabel}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {Number(b.available_quantity).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {Number(b.received_quantity).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(Number(b.purchase_cost_per_unit))}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(batchVal)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {b.location || 'Main Store'}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(
                              b.status
                            )}`}
                          >
                            {b.status.toUpperCase()}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Medicine Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Medicine</DialogTitle>
              <DialogDescription>
                Update pharmaceutical specifications, catalog details, and standard rates
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div className="sm:col-span-2">
                <Input
                  label="Brand Name *"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div>
                <Input
                  label="Product Code *"
                  value={editForm.product_code || ''}
                  onChange={(e) => setEditForm({ ...editForm, product_code: e.target.value.toUpperCase() })}
                />
              </div>

              <div>
                <Input
                  label="Generic Name"
                  value={editForm.generic_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, generic_name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Manufacturer
                </label>
                <Select
                  value={editForm.manufacturer_id || 'none'}
                  onValueChange={(val) =>
                    setEditForm({ ...editForm, manufacturer_id: val === 'none' ? '' : val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select manufacturer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / Generic</SelectItem>
                    {manufacturers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Input
                  label="Strength"
                  value={editForm.strength || ''}
                  onChange={(e) => setEditForm({ ...editForm, strength: e.target.value })}
                />
              </div>

              <div>
                <Input
                  label="Dosage Form"
                  placeholder="Tablet, Capsule, Syrup, etc."
                  value={editForm.dosage_form || ''}
                  onChange={(e) => setEditForm({ ...editForm, dosage_form: e.target.value })}
                />
              </div>

              <div>
                <Input
                  type="number"
                  min="1"
                  label="Units Per Pack"
                  value={editForm.units_per_pack || 1}
                  onChange={(e) => setEditForm({ ...editForm, units_per_pack: Number(e.target.value) })}
                />
              </div>

              <div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  label="Default Purchase Rate (PKR)"
                  value={editForm.default_purchase_rate ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, default_purchase_rate: Number(e.target.value) })}
                />
              </div>

              <div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  label="Default Sale Rate (PKR)"
                  value={editForm.default_sale_rate ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, default_sale_rate: Number(e.target.value) })}
                />
              </div>

              <div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  label="Wholesale Rate (PKR)"
                  value={editForm.wholesale_rate ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, wholesale_rate: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              </div>

              <div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  label="Retail Rate (MRP) (PKR)"
                  value={editForm.retail_rate ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, retail_rate: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              </div>

              <div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  label="Tax Rate (%)"
                  value={editForm.tax_rate ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, tax_rate: Number(e.target.value) })}
                />
              </div>

              <div>
                <Input
                  type="number"
                  min="0"
                  label="Reorder Level"
                  value={editForm.reorder_level ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, reorder_level: Number(e.target.value) })}
                />
              </div>

              <div className="sm:col-span-2">
                <Input
                  label="Barcode"
                  value={editForm.barcode || ''}
                  onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2">
                <Textarea
                  label="Notes"
                  rows={2}
                  value={editForm.notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2 flex items-center justify-between border p-3 rounded-md">
                <div>
                  <p className="text-sm font-medium">Active Status</p>
                  <p className="text-xs text-muted-foreground">
                    Inactive medicines are hidden from new sales and purchase bills
                  </p>
                </div>
                <Switch
                  checked={editForm.is_active ?? true}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
                {isSavingEdit ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Alert */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete or deactivate <strong>{medicine.name}</strong> ({medicine.product_code}).
                If this medicine has historical purchase or sales records, the system will mark it as inactive to preserve financial audits.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Medicine'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
