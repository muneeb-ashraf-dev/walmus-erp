'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Stethoscope, Calculator, Save, Loader2, Info } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Customer } from '@/types';
import toast from 'react-hot-toast';

export default function NewInvestmentPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [customerId, setCustomerId] = useState('');
  const [investmentAmount, setInvestmentAmount] = useState<string>('');
  const [investmentDate, setInvestmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [roiPercentage, setRoiPercentage] = useState<string>('20');
  const [notes, setNotes] = useState('');

  // Auto-calculated expected sales: amount / (roi / 100)
  const amountNum = parseFloat(investmentAmount) || 0;
  const roiNum = parseFloat(roiPercentage) || 0;
  const calculatedExpectedSale = roiNum > 0 ? amountNum / (roiNum / 100) : 0;

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/api/customers?limit=200');
      const list: Customer[] = res.data.items || [];
      // Filter or sort so doctor / hospital customers come first
      const sorted = [...list].sort((a, b) => {
        const isDocA = a.customer_type === 'doctor' || a.customer_type === 'hospital';
        const isDocB = b.customer_type === 'doctor' || b.customer_type === 'hospital';
        if (isDocA && !isDocB) return -1;
        if (!isDocA && isDocB) return 1;
        return a.name.localeCompare(b.name);
      });
      setCustomers(sorted);
      if (sorted.length > 0) {
        setCustomerId(sorted[0].id);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
      toast.error('Failed to load customers list');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      toast.error('Please select a doctor or customer');
      return;
    }
    if (amountNum <= 0) {
      toast.error('Please enter a valid investment amount');
      return;
    }
    if (roiNum <= 0 || roiNum > 100) {
      toast.error('ROI percentage must be between 1 and 100');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        investment_amount: amountNum,
        investment_date: investmentDate,
        roi_percentage: roiNum,
        notes: notes || undefined,
        status: 'active',
      };

      await api.post(`/api/customers/${customerId}/investments`, payload);
      toast.success('Doctor investment registered successfully!');
      router.push('/investments');
    } catch (err: any) {
      console.error('Failed to create investment:', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || 'Failed to create investment';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center gap-3">
          <Link href="/investments">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Record Doctor Investment</h1>
            <p className="text-sm text-muted-foreground">
              Register marketing/sales investment and calculate target commitment
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Investment Parameters
              </CardTitle>
              <CardDescription>
                Define doctor, capital amount, and expected sales return percentage
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Customer / Doctor Selector */}
              <div className="space-y-2">
                <Label htmlFor="customer">Doctor / Healthcare Customer *</Label>
                {loadingCustomers ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading doctor accounts...
                  </div>
                ) : (
                  <select
                    id="customer"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.specialty ? `(${c.specialty})` : ''} - {c.customer_type.toUpperCase()} {c.area ? `[${c.area}]` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {selectedCustomer && (
                  <p className="text-xs text-muted-foreground">
                    Selected: <span className="font-medium text-foreground">{selectedCustomer.name}</span>
                    {selectedCustomer.area && ` • Area: ${selectedCustomer.area}`}
                    {selectedCustomer.specialty && ` • Specialty: ${selectedCustomer.specialty}`}
                  </p>
                )}
              </div>

              {/* Investment Date & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Investment Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={investmentDate}
                    onChange={(e) => setInvestmentDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Investment Amount (PKR) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    step="any"
                    placeholder="e.g. 50000"
                    value={investmentAmount}
                    onChange={(e) => setInvestmentAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* ROI & Target Calculations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="roi">Expected ROI Percentage (%) *</Label>
                  <Input
                    id="roi"
                    type="number"
                    min="1"
                    max="100"
                    step="0.1"
                    placeholder="e.g. 20"
                    value={roiPercentage}
                    onChange={(e) => setRoiPercentage(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Standard pharmaceutical target recovery margin (e.g. 20% ROI)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Calculated Sales Commitment</Label>
                  <div className="h-10 px-3 py-2 rounded-md bg-muted flex items-center justify-between font-mono font-semibold text-primary">
                    <span>{formatCurrency(calculatedExpectedSale)}</span>
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formula: Investment ÷ (ROI% ÷ 100)
                  </p>
                </div>
              </div>

              {/* Calculation Summary Box */}
              {amountNum > 0 && roiNum > 0 && (
                <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 p-4 border-blue-200 dark:border-blue-800 text-sm">
                  <div className="flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-300">Agreement Summary</p>
                      <p className="text-blue-800 dark:text-blue-400 text-xs mt-1 leading-relaxed">
                        By disbursing <strong>{formatCurrency(amountNum)}</strong> at a <strong>{roiNum}%</strong> margin commitment, 
                        the expected generated gross medicine sales needed from this doctor to satisfy the target is{' '}
                        <strong>{formatCurrency(calculatedExpectedSale)}</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes / Agreement terms */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes / Agreement Details</Label>
                <Textarea
                  id="notes"
                  placeholder="Optional details regarding clinic visits, prescription commitments, or disbursement method..."
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>

            <CardFooter className="flex justify-between border-t px-6 py-4">
              <Link href="/investments">
                <Button variant="outline" type="button" disabled={submitting}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={submitting || loadingCustomers}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save Investment
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  );
}
