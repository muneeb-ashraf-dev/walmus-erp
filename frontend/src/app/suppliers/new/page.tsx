'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  ArrowLeft, 
  Truck, 
  Save, 
  Loader2, 
  Building2, 
  DollarSign, 
  FileText,
  CreditCard 
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const supplierSchema = z.object({
  name: z.string().min(1, 'Supplier company name is required').max(200),
  contact_person: z.string().max(100).optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  email: z.string().email('Invalid email address').max(100).optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  tax_number: z.string().max(50).optional().or(z.literal('')),
  credit_limit: z.coerce.number().min(0, 'Credit limit must be 0 or greater').default(0),
  payment_terms_days: z.coerce.number().int().min(0, 'Terms must be 0 or greater').default(30),
  opening_balance: z.coerce.number().default(0),
  notes: z.string().optional().or(z.literal('')),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

export default function NewSupplierPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      tax_number: '',
      credit_limit: 0,
      payment_terms_days: 30,
      opening_balance: 0,
      notes: '',
    },
  });

  const onSubmit = async (data: SupplierFormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: data.name.trim(),
        contact_person: data.contact_person?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        address: data.address?.trim() || null,
        tax_number: data.tax_number?.trim() || null,
        credit_limit: Number(data.credit_limit) || 0,
        payment_terms_days: Number(data.payment_terms_days) || 0,
        opening_balance: Number(data.opening_balance) || 0,
        notes: data.notes?.trim() || null,
        is_active: true,
      };

      await api.post('/api/suppliers', payload);
      toast.success('Supplier created successfully!');
      router.push('/suppliers');
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.error?.message || 'Failed to create supplier';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link href="/suppliers">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Add New Supplier</h1>
              <p className="text-sm text-muted-foreground">
                Register a new pharmaceutical distributor, vendor, or authorized agent
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/suppliers">Cancel</Link>
            </Button>
            <Button type="submit" form="supplier-form" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Supplier
                </>
              )}
            </Button>
          </div>
        </div>

        <form id="supplier-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Card 1: Company Profile */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Company Profile & Contact</CardTitle>
              </div>
              <CardDescription>
                Primary business identification and official communication channels
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Supplier / Distributor Name *"
                  placeholder="e.g. Premier Agencies, Ali Medical Store Wholesale"
                  error={errors.name?.message}
                  {...register('name')}
                />
              </div>

              <div>
                <Input
                  label="Contact Person / Representative"
                  placeholder="e.g. Muhammad Aslam (Sales Rep)"
                  error={errors.contact_person?.message}
                  {...register('contact_person')}
                />
              </div>

              <div>
                <Input
                  label="Phone Number"
                  placeholder="e.g. 0300-1234567, 021-3456789"
                  error={errors.phone?.message}
                  {...register('phone')}
                />
              </div>

              <div>
                <Input
                  label="Email Address"
                  placeholder="orders@supplier.com"
                  type="email"
                  error={errors.email?.message}
                  {...register('email')}
                />
              </div>

              <div>
                <Input
                  label="Tax Number / NTN / STRN"
                  placeholder="e.g. 1234567-8"
                  error={errors.tax_number?.message}
                  helperText="National Tax Number for invoice reporting"
                  {...register('tax_number')}
                />
              </div>

              <div className="md:col-span-2">
                <Textarea
                  label="Registered Business Address"
                  placeholder="Plot #, Street, Commercial Area, City"
                  rows={2}
                  error={errors.address?.message}
                  {...register('address')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Financial Terms & Credit */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Credit Terms & Opening Ledger</CardTitle>
              </div>
              <CardDescription>
                Credit lines, allowed credit periods, and opening balance in Pakistani Rupees (PKR)
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  label="Credit Limit (PKR)"
                  placeholder="0.00"
                  error={errors.credit_limit?.message}
                  helperText="Maximum allowed outstanding (0 = no limit)"
                  {...register('credit_limit')}
                />
              </div>

              <div>
                <Input
                  type="number"
                  min="0"
                  label="Payment Terms (Days) *"
                  placeholder="30"
                  error={errors.payment_terms_days?.message}
                  helperText="Agreed credit period before invoice becomes overdue"
                  {...register('payment_terms_days')}
                />
              </div>

              <div>
                <Input
                  type="number"
                  step="0.01"
                  label="Opening Balance (PKR)"
                  placeholder="0.00"
                  error={errors.opening_balance?.message}
                  helperText="Positive = We owe supplier; Negative = Advance"
                  {...register('opening_balance')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Additional Notes */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Additional Notes</CardTitle>
              </div>
              <CardDescription>
                Internal remarks, payment instructions, delivery days, or discount schedules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="e.g. Delivers on Tuesdays and Fridays. Bank details: Meezan Bank A/C #..."
                rows={3}
                error={errors.notes?.message}
                {...register('notes')}
              />
            </CardContent>
          </Card>

          {/* Bottom Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button asChild variant="outline">
              <Link href="/suppliers">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Supplier...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Supplier
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
