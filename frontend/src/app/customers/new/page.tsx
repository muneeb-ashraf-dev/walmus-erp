'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  ArrowLeft, 
  Users, 
  Save, 
  Loader2, 
  Building2, 
  Stethoscope, 
  CreditCard, 
  MapPin, 
  FileText 
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const customerSchema = z.object({
  name: z.string().min(1, 'Customer / Clinic name is required').max(200),
  customer_type: z.enum(['pharmacy', 'doctor', 'hospital', 'clinic'], {
    required_error: 'Customer type is required',
  }),
  contact_person: z.string().max(100).optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  email: z.string().email('Invalid email address').max(100).optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  specialty: z.string().max(50).optional().or(z.literal('')),
  area: z.string().max(100).optional().or(z.literal('')),
  tax_number: z.string().max(50).optional().or(z.literal('')),
  credit_limit: z.coerce.number().min(0, 'Credit limit must be 0 or greater').default(0),
  payment_terms_days: z.coerce.number().int().min(0, 'Terms must be 0 or greater').default(30),
  opening_balance: z.coerce.number().default(0),
  default_sale_rate_type: z.enum(['retail', 'wholesale', 'distributor']).default('retail'),
  notes: z.string().optional().or(z.literal('')),
});

type CustomerFormData = z.infer<typeof customerSchema>;

const MEDICAL_SPECIALTIES = [
  'General Physician',
  'Cardiologist',
  'Pediatrician',
  'Gynecologist & Obstetrician',
  'Orthopedic Surgeon',
  'Dermatologist',
  'Neurologist',
  'Gastroenterologist',
  'Pulmonologist',
  'ENT Specialist',
  'Ophthalmologist',
  'Urologist',
  'Endocrinologist',
  'Psychiatrist',
  'Dentist',
  'Other Specialist',
];

export default function NewCustomerPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      customer_type: 'pharmacy',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      specialty: '',
      area: '',
      tax_number: '',
      credit_limit: 0,
      payment_terms_days: 30,
      opening_balance: 0,
      default_sale_rate_type: 'retail',
      notes: '',
    },
  });

  const selectedCustomerType = watch('customer_type');

  const onSubmit = async (data: CustomerFormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: data.name.trim(),
        customer_type: data.customer_type,
        contact_person: data.contact_person?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        address: data.address?.trim() || null,
        specialty: data.specialty?.trim() || null,
        area: data.area?.trim() || null,
        tax_number: data.tax_number?.trim() || null,
        credit_limit: Number(data.credit_limit) || 0,
        payment_terms_days: Number(data.payment_terms_days) || 0,
        opening_balance: Number(data.opening_balance) || 0,
        default_sale_rate_type: data.default_sale_rate_type,
        notes: data.notes?.trim() || null,
        is_active: true,
      };

      await api.post('/api/customers', payload);
      toast.success('Customer profile registered successfully!');
      router.push('/customers');
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.error?.message || 'Failed to create customer';
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
              <Link href="/customers">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Add Customer / Doctor</h1>
              <p className="text-sm text-muted-foreground">
                Register a new pharmacy, healthcare provider, or hospital billing account
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/customers">Cancel</Link>
            </Button>
            <Button type="submit" form="customer-form" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Customer
                </>
              )}
            </Button>
          </div>
        </div>

        <form id="customer-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Card 1: Account Classification & Identification */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Classification & Identification</CardTitle>
              </div>
              <CardDescription>
                Define account type, area coverage, and contact credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Customer Type *
                </label>
                <Controller
                  name="customer_type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pharmacy">Pharmacy / Chemist Store</SelectItem>
                        <SelectItem value="doctor">Medical Doctor / Prescriber</SelectItem>
                        <SelectItem value="hospital">Hospital / Medical Center</SelectItem>
                        <SelectItem value="clinic">Clinic / Outpatient Center</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Input
                  label={
                    selectedCustomerType === 'doctor'
                      ? 'Doctor Full Name (with Title) *'
                      : 'Business / Establishment Name *'
                  }
                  placeholder={
                    selectedCustomerType === 'doctor'
                      ? 'e.g. Dr. Muhammad Farooq'
                      : 'e.g. Al-Shifa Pharmacy & Medicos'
                  }
                  error={errors.name?.message}
                  {...register('name')}
                />
              </div>

              {selectedCustomerType === 'doctor' ? (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Medical Specialty
                  </label>
                  <Controller
                    name="specialty"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || 'none'}
                        onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Specialty" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">General Practice</SelectItem>
                          {MEDICAL_SPECIALTIES.map((spec) => (
                            <SelectItem key={spec} value={spec}>
                              {spec}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              ) : (
                <div>
                  <Input
                    label="Contact Person / Manager"
                    placeholder="e.g. Salman Ahmed (Pharmacist Incharge)"
                    error={errors.contact_person?.message}
                    {...register('contact_person')}
                  />
                </div>
              )}

              <div>
                <Input
                  label="Area / Territory / Market"
                  placeholder="e.g. Saddar Market, DHA Phase 5, Nazimabad"
                  error={errors.area?.message}
                  helperText="Used for delivery route and sales rep allocation"
                  {...register('area')}
                />
              </div>

              <div>
                <Input
                  label="Primary Phone / Mobile"
                  placeholder="e.g. 0321-9876543, 021-3580000"
                  error={errors.phone?.message}
                  {...register('phone')}
                />
              </div>

              <div>
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="contact@pharmacy.com"
                  error={errors.email?.message}
                  {...register('email')}
                />
              </div>

              <div>
                <Input
                  label="Tax Number (NTN / CNIC)"
                  placeholder="e.g. 1234567-8 or 42101-1234567-1"
                  error={errors.tax_number?.message}
                  {...register('tax_number')}
                />
              </div>

              <div className="md:col-span-2">
                <Textarea
                  label="Full Physical Address"
                  placeholder="Shop #, Street, Near landmark, City"
                  rows={2}
                  error={errors.address?.message}
                  {...register('address')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Billing & Credit Terms */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Billing Policies & Credit Terms</CardTitle>
              </div>
              <CardDescription>
                Assign default pricing tier (retail, wholesale, distributor) and credit ceiling
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Default Pricing Tier *
                </label>
                <Controller
                  name="default_sale_rate_type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pricing Tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="retail">Retail Rate (MRP)</SelectItem>
                        <SelectItem value="wholesale">Wholesale Rate</SelectItem>
                        <SelectItem value="distributor">Distributor Rate</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  label="Credit Limit (PKR)"
                  placeholder="0.00"
                  error={errors.credit_limit?.message}
                  helperText="0 = Unlimited credit"
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
                  helperText="Allowed grace days before overdue"
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
                  helperText="Positive = Customer owes us"
                  {...register('opening_balance')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Notes & Instructions */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Internal Notes</CardTitle>
              </div>
              <CardDescription>
                Special discount notes, license numbers (Form 9 / DTL), delivery instructions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="e.g. Drug Sale License # DTL-12345. Preferred delivery time between 2 PM - 5 PM."
                rows={3}
                error={errors.notes?.message}
                {...register('notes')}
              />
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button asChild variant="outline">
              <Link href="/customers">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Customer...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Customer
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
