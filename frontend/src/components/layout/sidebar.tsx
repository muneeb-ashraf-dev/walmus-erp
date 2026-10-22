'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LayoutDashboard,
  Pill,
  Package,
  ShoppingCart,
  ShoppingBag,
  Truck,
  Users,
  TrendingUp,
  CreditCard,
  Receipt,
  FileText,
  Database,
  FileSpreadsheet
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Medicines', href: '/medicines', icon: Pill },
  { name: 'Inventory & Batches', href: '/inventory', icon: Package },
  { name: 'Purchases', href: '/purchases', icon: ShoppingCart },
  { name: 'Sales & Invoices', href: '/sales', icon: ShoppingBag },
  { name: 'Suppliers', href: '/suppliers', icon: Truck },
  { name: 'Customers & Contacts', href: '/customers', icon: Users },
  { name: 'Doctor Investments', href: '/investments', icon: TrendingUp },
  { name: 'Payments & Accounts', href: '/payments', icon: CreditCard },
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Import & Export', href: '/import-export', icon: FileSpreadsheet },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Backup & Recovery', href: '/backup', icon: Database },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-200 flex flex-col',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header / Logo */}
      <div className={cn('flex h-16 items-center justify-between px-4 border-b shrink-0', collapsed && 'justify-center px-2')}>
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Pill className="h-7 w-7 text-primary" />
            <span className="font-bold text-base tracking-tight">Walmus Pharma</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn('h-8 w-8', collapsed && 'mx-auto')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto scrollbar-thin" aria-label="Main navigation">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.name : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer Branding & Settings */}
      <div className={cn('p-2 border-t shrink-0', collapsed && 'p-1')}>
        <Link href="/settings">
          <Button variant="ghost" className={cn('w-full justify-start gap-3 px-2', collapsed && 'justify-center px-0')}>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary font-bold">W</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-sm font-semibold truncate">Walmus Pharma</p>
                <p className="text-xs text-muted-foreground truncate">Settings</p>
              </div>
            )}
          </Button>
        </Link>
      </div>
    </aside>
  );
}