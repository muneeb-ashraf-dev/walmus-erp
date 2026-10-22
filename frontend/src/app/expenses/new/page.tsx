'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Receipt, Save, Loader2, Pill, 
  DollarSign, Tag, Landmark, FileText
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ExpenseCategory, FinancialAccount, Medicine } from '@/types';
import toast from 'react-hot-toast';

export default function RecordExpensePage() {
  const router = useRouter();

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form inputs
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('0');
  const [description, setDescription] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [medicineId, setMedicineId] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [catRes, accRes, medRes] = await Promise.all([
        api.get('/api/financial/expense-categories').catch(() => ({ data: [] })),
        api.get('/api/financial/accounts').catch(() => ({ data: [] })),
        api.get('/api/medicines?limit=200').catch(() => ({ data: { items: [] } })),
      ]);

      const catList: ExpenseCategory[] = Array.isArray(catRes.data) ? catRes.data : [];
      const accList: FinancialAccount[] = Array.isArray(accRes.data) ? accRes.data : [];
      const medList: Medicine[] = Array.isArray(medRes.data) ? medRes.data : medRes.data?.items || [];

      setCategories(catList);
      setAccounts(accList);
      setMedicines(medList);

      if (catList.length > 0) setCategoryId(catList[0].id);
      if (accList.length > 0) setAccountId(accList[0].id);
    } catch (err) {
      console.error('Failed to load initial data:', err);
      toast.error('Failed to load form options');
    } finally {
      setLoadingInitial(false);
    }
  };

  const amountNum = parseFloat(amount) || 0;
  const taxNum = parseFloat(taxAmount) || 0;
  const totalExpense = amountNum + taxNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId) {
      toast.error('Please select an expense category');
      return;
    }
    if (!accountId) {
      toast.error('Please select a payment account');
      return;
    }
    if (amountNum <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        category_id: categoryId,
        account_id: accountId,
        expense_date: expenseDate,
        amount: amountNum,
        tax_amount: taxNum,
        description: description.trim() || undefined,
        reference_number: referenceNumber.trim() || undefined,
        medicine_id: medicineId ? medicineId : undefined,
      };

      await api.post('/api/financial/expenses', payload);
      toast.success('Expense recorded successfully!');
      router.push('/expenses');
    } catch (err: any) {
      console.error('Failed to record expense:', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || 'Failed to record expense';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/expenses">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Record Operating Expense</h1>
            <p className="text-sm text-muted-foreground">
              Enter operational costs, doctor promotional items, samples, or office overhead
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Expense Voucher Details
              </CardTitle>
              <CardDescription>
                Categorize your expense and choose payment method
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="category">Expense Category *</Label>
                    <Link href="/expenses/categories" className="text-xs text-primary hover:underline">
                      + Manage Categories
                    </Link>
                  </div>
                  <select
                    id="category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Account */}
                <div className="space-y-2">
                  <Label htmlFor="account">Paid From Account *</Label>
                  <select
                    id="account"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Expense Date */}
                <div className="space-y-2">
                  <Label htmlFor="date">Expense Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    required
                  />
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Base Amount (PKR) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    step="any"
                    placeholder="e.g. 5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>

                {/* Tax Amount */}
                <div className="space-y-2">
                  <Label htmlFor="tax">Tax / GST (PKR)</Label>
                  <Input
                    id="tax"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Reference Number */}
                <div className="space-y-2">
                  <Label htmlFor="ref">Receipt / Bill / Invoice #</Label>
                  <Input
                    id="ref"
                    placeholder="e.g. BILL-4412 or Slip #"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                  />
                </div>

                {/* Optional Medicine / Product Tagging */}
                <div className="space-y-2">
                  <Label htmlFor="medicine">Product-Specific Cost (Optional)</Label>
                  <select
                    id="medicine"
                    value={medicineId}
                    onChange={(e) => setMedicineId(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">General Overhead (Not product specific)</option>
                    {medicines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} [{m.product_code}]
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Assign sample giveaways, direct marketing, or transport to a medicine
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="desc">Description / Purpose</Label>
                <Textarea
                  id="desc"
                  placeholder="e.g. Clinic promotional literature, staff petrol allowance, generator diesel..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Total Summary */}
              {amountNum > 0 && (
                <div className="p-3 bg-muted rounded-lg flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Ledger Impact:</span>
                  <span className="font-bold text-base text-primary">
                    {formatCurrency(totalExpense)}
                  </span>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex justify-between border-t px-6 py-4">
              <Link href="/expenses">
                <Button variant="outline" type="button" disabled={submitting}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={submitting || loadingInitial}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save Expense
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
