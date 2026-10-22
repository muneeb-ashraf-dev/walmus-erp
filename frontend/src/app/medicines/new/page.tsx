'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  ArrowLeft, Pill, Save, Loader2, Building2, Scale, 
  DollarSign, PackageCheck, AlertCircle 
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Manufacturer, MedicineUnit } from '@/types';

const medicineSchema = z.object({
  product_code: z
    .string()
    .min(1, 'Product code is required')
    .max(50, 'Max 50 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Only letters, numbers, dashes, and underscores allowed'),
  name: z.string().min(1, 'Medicine name is required').max(200),
  generic_name: z.string().max(200).optional().or(z.literal('')),
  manufacturer_id: z.string().optional().or(z.literal('')),
  strength: z.string().max(100).optional().or(z.literal('')),
  dosage_form: z.string().max(50).optional().or(z.literal('')),
  packing_description: z.string().max(200).optional().or(z.literal('')),
  base_unit_id: z.string().min(1, 'Base unit is required'),
  units_per_pack: z.coerce.number().min(1, 'Must be at least 1').default(1),
  default_purchase_rate: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  default_sale_rate: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  wholesale_rate: z.coerce.number().min(0).optional().or(z.literal('')),
  retail_rate: z.coerce.number().min(0).optional().or(z.literal('')),
  tax_rate: z.coerce.number().min(0).max(100, 'Max 100%').default(0),
  reorder_level: z.coerce.number().min(0).default(0),
  barcode: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

type MedicineFormData = z.infer<typeof medicineSchema>;

const DOSAGE_FORMS = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Suspension',
  'Injection',
  'Infusion',
  'Drops',
  'Ointment',
  'Cream',
  'Gel',
  'Inhaler',
  'Sachet',
  'Suppository',
  'Lotion',
  'Solution',
  'Other',
];

export default function NewMedicinePage() {
  const router = useRouter();
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [units, setUnits] = useState<MedicineUnit[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<MedicineFormData>({
    resolver: zodResolver(medicineSchema),
    defaultValues: {
      product_code: '',
      name: '',
      generic_name: '',
      manufacturer_id: '',
      strength: '',
      dosage_form: '',
      packing_description: '',
      base_unit_id: '',
      units_per_pack: 1,
      default_purchase_rate: 0,
      default_sale_rate: 0,
      wholesale_rate: undefined,
      retail_rate: undefined,
      tax_rate: 0,
      reorder_level: 0,
      barcode: '',
      notes: '',
    },
  });

  useEffect(() => {
    const fetchMetadata = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [manRes, unitsRes] = await Promise.all([
          api.get('/api/medicines/manufacturers', { params: { limit: 100 } }),
          api.get('/api/medicines/units'),
        ]);

        const manData = Array.isArray(manRes.data) ? manRes.data : (manRes.data.items || []);
        const unitData = Array.isArray(unitsRes.data) ? unitsRes.data : (unitsRes.data.items || []);

        setManufacturers(manData.filter((m: Manufacturer) => m.is_active));
        setUnits(unitData);

        // Pre-select base unit if a unit has is_base_unit = true
        const defaultBase = unitData.find((u: MedicineUnit) => u.is_base_unit);
        if (defaultBase) {
          setValue('base_unit_id', defaultBase.id);
        } else if (unitData.length > 0) {
          setValue('base_unit_id', unitData[0].id);
        }
      } catch (err: any) {
        toast.error('Failed to load manufacturers or units');
      } finally {
        setIsLoadingDropdowns(false);
      }
    };

    fetchMetadata();
  }, [setValue]);

  const onSubmit = async (data: MedicineFormData) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, any> = {
        product_code: data.product_code.toUpperCase().trim(),
        name: data.name.trim(),
        generic_name: data.generic_name?.trim() || null,
        manufacturer_id: data.manufacturer_id ? data.manufacturer_id : null,
        strength: data.strength?.trim() || null,
        dosage_form: data.dosage_form || null,
        packing_description: data.packing_description?.trim() || null,
        base_unit_id: data.base_unit_id,
        units_per_pack: Number(data.units_per_pack),
        default_purchase_rate: Number(data.default_purchase_rate),
        default_sale_rate: Number(data.default_sale_rate),
        wholesale_rate: data.wholesale_rate !== undefined && data.wholesale_rate !== '' ? Number(data.wholesale_rate) : null,
        retail_rate: data.retail_rate !== undefined && data.retail_rate !== '' ? Number(data.retail_rate) : null,
        tax_rate: Number(data.tax_rate) || 0,
        reorder_level: Number(data.reorder_level) || 0,
        barcode: data.barcode?.trim() || null,
        notes: data.notes?.trim() || null,
        is_active: true,
      };

      await api.post('/api/medicines', payload);
      toast.success('Medicine created successfully!');
      router.push('/medicines');
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.error?.message || 'Failed to create medicine';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link href="/medicines">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Add New Medicine</h1>
              <p className="text-sm text-muted-foreground">
                Register a new pharmaceutical item with pricing and packaging configurations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/medicines">Cancel</Link>
            </Button>
            <Button 
              type="submit" 
              form="medicine-form" 
              disabled={isSubmitting || isLoadingDropdowns}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Medicine
                </>
              )}
            </Button>
          </div>
        </div>

        {isLoadingDropdowns ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-8 w-8 animate-spin mb-3 text-primary" />
              <p>Loading master configurations (manufacturers & units)...</p>
            </CardContent>
          </Card>
        ) : (
          <form id="medicine-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Card 1: Basic Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Basic Identification</CardTitle>
                </div>
                <CardDescription>
                  Core identification details, brand name, and therapeutic composition
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Product Code *"
                    placeholder="e.g. PAN-500, AUG-625"
                    error={errors.product_code?.message}
                    helperText="Unique uppercase identifier for system tracking"
                    {...register('product_code', {
                      onChange: (e) => {
                        e.target.value = e.target.value.toUpperCase();
                      },
                    })}
                  />
                </div>

                <div>
                  <Input
                    label="Brand / Item Name *"
                    placeholder="e.g. Panadol 500mg Tablet"
                    error={errors.name?.message}
                    {...register('name')}
                  />
                </div>

                <div>
                  <Input
                    label="Generic / Formula Name"
                    placeholder="e.g. Paracetamol, Amoxicillin + Clavulanate"
                    error={errors.generic_name?.message}
                    {...register('generic_name')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Manufacturer / Brand Owner
                  </label>
                  <Controller
                    name="manufacturer_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || 'none'}
                        onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Manufacturer" />
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
                    )}
                  />
                  {manufacturers.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      No manufacturers found.{' '}
                      <Link href="/medicines/manufacturers" className="underline font-medium">
                        Add one here
                      </Link>
                    </p>
                  )}
                </div>

                <div>
                  <Input
                    label="Strength / Potency"
                    placeholder="e.g. 500mg, 10mg/5ml, 2%"
                    error={errors.strength?.message}
                    {...register('strength')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Dosage Form
                  </label>
                  <Controller
                    name="dosage_form"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || 'none'}
                        onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Dosage Form" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not specified</SelectItem>
                          {DOSAGE_FORMS.map((form) => (
                            <SelectItem key={form} value={form}>
                              {form}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="md:col-span-2">
                  <Input
                    label="Barcode / GTIN / UPC"
                    placeholder="Scan or enter barcode"
                    error={errors.barcode?.message}
                    {...register('barcode')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Packaging & Units */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Packaging & Units of Measure</CardTitle>
                </div>
                <CardDescription>
                  Define the base unit and packaging specifications for inventory tracking
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Base Unit *
                  </label>
                  <Controller
                    name="base_unit_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger error={!!errors.base_unit_id}>
                          <SelectValue placeholder="Select Base Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} ({u.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.base_unit_id && (
                    <p className="mt-1.5 text-sm text-destructive">{errors.base_unit_id.message}</p>
                  )}
                  {units.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      No units available.{' '}
                      <Link href="/medicines/units" className="underline font-medium">
                        Configure units
                      </Link>
                    </p>
                  )}
                </div>

                <div>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    label="Units Per Pack *"
                    placeholder="1"
                    error={errors.units_per_pack?.message}
                    helperText="e.g. 10 tablets/strip, 100/box"
                    {...register('units_per_pack')}
                  />
                </div>

                <div>
                  <Input
                    label="Packaging Description"
                    placeholder="e.g. 10 x 10 Blister Pack, 100ml Bottle"
                    error={errors.packing_description?.message}
                    {...register('packing_description')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Pricing & Reorder Control */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Pricing & Inventory Control (PKR)</CardTitle>
                </div>
                <CardDescription>
                  Set standard purchase, wholesale, and retail rates alongside reorder alerts
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    label="Default Purchase Rate (PKR) *"
                    placeholder="0.00"
                    error={errors.default_purchase_rate?.message}
                    helperText="Cost per base unit from supplier"
                    {...register('default_purchase_rate')}
                  />
                </div>

                <div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    label="Default Sale Rate (PKR) *"
                    placeholder="0.00"
                    error={errors.default_sale_rate?.message}
                    helperText="Standard selling price"
                    {...register('default_sale_rate')}
                  />
                </div>

                <div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    label="Wholesale Rate (PKR)"
                    placeholder="0.00"
                    error={errors.wholesale_rate?.message}
                    helperText="Discounted bulk customer rate"
                    {...register('wholesale_rate')}
                  />
                </div>

                <div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    label="Retail Rate (MRP) (PKR)"
                    placeholder="0.00"
                    error={errors.retail_rate?.message}
                    helperText="Maximum Retail Price on pack"
                    {...register('retail_rate')}
                  />
                </div>

                <div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    label="Tax Rate (%)"
                    placeholder="0"
                    error={errors.tax_rate?.message}
                    helperText="GST / Sales Tax percentage"
                    {...register('tax_rate')}
                  />
                </div>

                <div>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    label="Reorder Level (Base Units)"
                    placeholder="0"
                    error={errors.reorder_level?.message}
                    helperText="Trigger alert when stock drops below this"
                    {...register('reorder_level')}
                  />
                </div>

                <div className="sm:col-span-2 md:col-span-3">
                  <Textarea
                    label="Notes / Special Instructions"
                    placeholder="Storage requirements (e.g., keep below 25°C, protect from light), manufacturer batch notes, etc."
                    rows={3}
                    error={errors.notes?.message}
                    {...register('notes')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button asChild variant="outline">
                <Link href="/medicines">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting || isLoadingDropdowns}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Medicine...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Medicine
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
