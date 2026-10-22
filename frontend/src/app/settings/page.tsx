'use client';

import { useEffect, useState } from 'react';
import { 
  Settings, Building2, FileText, Save, 
  Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { OwnerSettings } from '@/types';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingOwner, setSavingOwner] = useState(false);

  // Business profile & preferences state
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [purchasePrefix, setPurchasePrefix] = useState('PUR');
  const [invoiceFormat, setInvoiceFormat] = useState('{PREFIX}-{YEAR}-{SEQ:06d}');
  const [purchaseFormat, setPurchaseFormat] = useState('{PREFIX}-{YEAR}-{SEQ:06d}');
  const [fyStartMonth, setFyStartMonth] = useState('7');
  const [paymentTermsDays, setPaymentTermsDays] = useState('30');
  const [defaultTaxRate, setDefaultTaxRate] = useState('0');
  const [openingCash, setOpeningCash] = useState('0');
  const [openingBank, setOpeningBank] = useState('0');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/settings/owner');
      const s: OwnerSettings = res.data;
      if (s) {
        setBusinessName(s.business_name || '');
        setBusinessAddress(s.business_address || '');
        setPhone(s.phone || '');
        setEmail(s.email || '');
        setTaxNumber(s.tax_number || '');
        setCurrency(s.currency || 'PKR');
        setInvoicePrefix(s.invoice_prefix || 'INV');
        setPurchasePrefix(s.purchase_prefix || 'PUR');
        setInvoiceFormat(s.invoice_number_format || '{PREFIX}-{YEAR}-{SEQ:06d}');
        setPurchaseFormat(s.purchase_number_format || '{PREFIX}-{YEAR}-{SEQ:06d}');
        setFyStartMonth(String(s.financial_year_start_month ?? 7));
        setPaymentTermsDays(String(s.default_payment_terms_days ?? 30));
        setDefaultTaxRate(String(s.default_tax_rate ?? 0));
        setOpeningCash(String(s.opening_cash_balance ?? 0));
        setOpeningBank(String(s.opening_bank_balance ?? 0));
      }
    } catch (err) {
      console.error('Failed to load owner settings:', err);
      toast.error('Failed to load owner settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOwnerSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      toast.error('Business name is required');
      return;
    }

    setSavingOwner(true);
    try {
      const payload = {
        business_name: businessName.trim(),
        business_address: businessAddress.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        tax_number: taxNumber.trim() || undefined,
        currency: currency.trim().toUpperCase(),
        invoice_prefix: invoicePrefix.trim().toUpperCase(),
        purchase_prefix: purchasePrefix.trim().toUpperCase(),
        invoice_number_format: invoiceFormat.trim(),
        purchase_number_format: purchaseFormat.trim(),
        financial_year_start_month: parseInt(fyStartMonth, 10) || 7,
        default_payment_terms_days: parseInt(paymentTermsDays, 10) || 30,
        default_tax_rate: parseFloat(defaultTaxRate) || 0,
        opening_cash_balance: parseFloat(openingCash) || 0,
        opening_bank_balance: parseFloat(openingBank) || 0,
      };

      await api.patch('/api/settings/owner', payload);
      toast.success('Owner settings updated successfully!');
    } catch (err: any) {
      console.error('Failed to update settings:', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || 'Failed to update settings';
      toast.error(msg);
    } finally {
      setSavingOwner(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System & Business Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure business identity, tax numbers, and invoice sequence formatting
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
            <p>Loading system configuration...</p>
          </div>
        ) : (
          <Tabs defaultValue="business" className="w-full">
            <TabsList className="grid grid-cols-2 max-w-sm">
              <TabsTrigger value="business">Business Profile</TabsTrigger>
              <TabsTrigger value="invoicing">Invoicing & Financial</TabsTrigger>
            </TabsList>

            {/* TAB 1: Business Profile */}
            <TabsContent value="business" className="mt-4">
              <form onSubmit={handleSaveOwnerSettings}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      Business Details
                    </CardTitle>
                    <CardDescription>
                      These details appear on sales tax invoices, purchase orders, and official vouchers
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="biz_name">Business / Company Name *</Label>
                      <Input
                        id="biz_name"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Walmus Pharmaceuticals"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="biz_addr">Physical Office / Warehouse Address</Label>
                      <Textarea
                        id="biz_addr"
                        rows={2}
                        value={businessAddress}
                        onChange={(e) => setBusinessAddress(e.target.value)}
                        placeholder="Street, Industrial Area, City, Pakistan"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone / WhatsApp</Label>
                        <Input
                          id="phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+92 300 1234567"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Official Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="info@walmuspharma.com"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tax">NTN / STRN / Tax Registration #</Label>
                        <Input
                          id="tax"
                          value={taxNumber}
                          onChange={(e) => setTaxNumber(e.target.value)}
                          placeholder="e.g. 1234567-8"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="curr">Base Operating Currency</Label>
                        <Input
                          id="curr"
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                          placeholder="PKR"
                          maxLength={3}
                          required
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end border-t px-6 py-4">
                    <Button type="submit" disabled={savingOwner}>
                      {savingOwner && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Save className="mr-2 h-4 w-4" /> Save Business Profile
                    </Button>
                  </CardFooter>
                </Card>
              </form>
            </TabsContent>

            {/* TAB 2: Invoicing & Financial Preferences */}
            <TabsContent value="invoicing" className="mt-4">
              <form onSubmit={handleSaveOwnerSettings}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Sequence Numbers & Financial Settings
                    </CardTitle>
                    <CardDescription>
                      Configure fiscal calendar, prefix formats, and default rates
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="inv_prefix">Sales Invoice Prefix</Label>
                        <Input
                          id="inv_prefix"
                          value={invoicePrefix}
                          onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                          placeholder="INV"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pur_prefix">Purchase Voucher Prefix</Label>
                        <Input
                          id="pur_prefix"
                          value={purchasePrefix}
                          onChange={(e) => setPurchasePrefix(e.target.value.toUpperCase())}
                          placeholder="PUR"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="inv_fmt">Invoice Format Template</Label>
                        <Input
                          id="inv_fmt"
                          value={invoiceFormat}
                          onChange={(e) => setInvoiceFormat(e.target.value)}
                        />
                        <p className="text-[11px] text-muted-foreground">Default: {'{PREFIX}-{YEAR}-{SEQ:06d}'}</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pur_fmt">Purchase Format Template</Label>
                        <Input
                          id="pur_fmt"
                          value={purchaseFormat}
                          onChange={(e) => setPurchaseFormat(e.target.value)}
                        />
                        <p className="text-[11px] text-muted-foreground">Default: {'{PREFIX}-{YEAR}-{SEQ:06d}'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t">
                      <div className="space-y-2">
                        <Label htmlFor="fy_start">Financial Year Start Month</Label>
                        <select
                          id="fy_start"
                          value={fyStartMonth}
                          onChange={(e) => setFyStartMonth(e.target.value)}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="1">1 (January)</option>
                          <option value="7">7 (July - Standard PK FY)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="terms">Default Payment Terms (Days)</Label>
                        <Input
                          id="terms"
                          type="number"
                          min="0"
                          value={paymentTermsDays}
                          onChange={(e) => setPaymentTermsDays(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tax_rate">Default GST / Tax Rate (%)</Label>
                        <Input
                          id="tax_rate"
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={defaultTaxRate}
                          onChange={(e) => setDefaultTaxRate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                      <div className="space-y-2">
                        <Label htmlFor="op_cash">Opening Cash Drawer Balance (PKR)</Label>
                        <Input
                          id="op_cash"
                          type="number"
                          step="any"
                          value={openingCash}
                          onChange={(e) => setOpeningCash(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="op_bank">Opening Bank Balance (PKR)</Label>
                        <Input
                          id="op_bank"
                          type="number"
                          step="any"
                          value={openingBank}
                          onChange={(e) => setOpeningBank(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end border-t px-6 py-4">
                    <Button type="submit" disabled={savingOwner}>
                      {savingOwner && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Save className="mr-2 h-4 w-4" /> Save Financial Preferences
                    </Button>
                  </CardFooter>
                </Card>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
