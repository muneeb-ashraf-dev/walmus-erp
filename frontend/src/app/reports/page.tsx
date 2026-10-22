'use client';

import Link from 'next/link';
import { 
  FileText, TrendingUp, ShoppingBag, ShoppingCart, 
  BarChart3, Package, Users, Calendar, ArrowRight,
  ShieldCheck, DollarSign, Stethoscope, FileSpreadsheet
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const reportModules = [
  {
    title: 'Sales Reports',
    href: '/reports/sales',
    description: 'Detailed analysis of gross revenue, discounts, sales trends by day/month/year, and breakdowns by product and customer.',
    icon: ShoppingBag,
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
    badge: 'Revenue & Trend',
  },
  {
    title: 'Purchase Reports',
    href: '/reports/purchases',
    description: 'Inward procurement analytics, supplier invoice volumes, purchase discounts, and vendor spend breakdown.',
    icon: ShoppingCart,
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    badge: 'Procurement',
  },
  {
    title: 'Profit & Loss (P&L)',
    href: '/reports/profit',
    description: 'Comprehensive financial statement: Gross Revenue, Discounts, Net Sales, COGS, Gross Margin %, Operating Expenses, and Net Profit.',
    icon: BarChart3,
    color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800',
    badge: 'Financial Statement',
  },
  {
    title: 'Inventory Valuation',
    href: '/reports/inventory',
    description: 'Current stock holding valuation calculated at Weighted Average Cost (WAC) per medicine with batch counts and quantities.',
    icon: Package,
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    badge: 'Stock Holding (WAC)',
  },
  {
    title: 'Doctor Investments & ROI',
    href: '/reports/investments',
    description: 'Doctor portfolio tracking, investment commitments, target vs actual revenue generation, and sales recovery progress.',
    icon: Stethoscope,
    color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
    badge: 'Doctor Commitments',
  },
  {
    title: 'Monthly Business Summary',
    href: '/reports/monthly',
    description: 'Consolidated executive monthly workbook mirroring the pharmacy ERP financial workflow: sales, COGS, expenses, net margins.',
    icon: FileSpreadsheet,
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
    badge: 'Executive Summary',
  },
];

export default function ReportsHubPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial & Operational Reports</h1>
          <p className="text-sm text-muted-foreground">
            Access statutory reports, sales analytics, inventory valuation, doctor ROI, and executive summaries
          </p>
        </div>

        {/* Report Cards Grid */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {reportModules.map((item) => {
            const Icon = item.icon;
            return (
              <Card 
                key={item.href}
                className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/50 flex flex-col justify-between"
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2.5 rounded-lg border ${item.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {item.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    {item.title}
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed line-clamp-3">
                    {item.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href={item.href} className="w-full">
                    <Button variant="outline" className="w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      <span>Open Report</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
