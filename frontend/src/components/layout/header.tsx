'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCheck,
  ChevronRight,
  Info,
  Moon,
  RefreshCw,
  Settings,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useTheme } from 'next-themes';
import {
  useNotifications,
  type NotificationSeverity,
} from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';

const severityMeta: Record<
  NotificationSeverity,
  { icon: ComponentType<{ className?: string }>; className: string }
> = {
  critical: {
    icon: AlertTriangle,
    className: 'bg-destructive/10 text-destructive',
  },
  warning: {
    icon: AlertCircle,
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  info: {
    icon: Info,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

export function Header() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    error,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <div className="flex h-full w-full items-center justify-between gap-4">
        {/* Left side - Page title would go here */}
        <div className="flex-1" />

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Toggle theme">
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Settings className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6" />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9"
                aria-label={
                  unreadCount > 0
                    ? `Notifications, ${unreadCount} unread`
                    : 'Notifications'
                }
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[22rem] p-0">
              <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                <div className="min-w-0">
                  <h4 className="font-semibold">Notifications</h4>
                  <p className="text-xs text-muted-foreground">
                    {unreadCount > 0
                      ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}`
                      : 'Live inventory and expiry alerts'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={markAllRead}
                    disabled={unreadCount === 0}
                    title="Mark all notifications as read"
                    aria-label="Mark all notifications as read"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => void refresh()}
                    disabled={isRefreshing}
                    title="Refresh notifications"
                    aria-label="Refresh notifications"
                  >
                    <RefreshCw
                      className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
                    />
                  </Button>
                </div>
              </div>

              <div className="max-h-[22rem] overflow-y-auto p-1">
                {isLoading && notifications.length === 0 && (
                  <div className="space-y-1">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="flex gap-3 p-3">
                        <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                          <div className="h-3 w-full animate-pulse rounded bg-muted" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isLoading && error && notifications.length === 0 && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-destructive">{error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => void refresh()}
                    >
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                      Retry
                    </Button>
                  </div>
                )}

                {!isLoading && !error && notifications.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <CheckCheck className="mx-auto h-8 w-8 text-green-600" />
                    <p className="mt-2 text-sm font-medium">All caught up</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      There are no stock or expiry alerts right now.
                    </p>
                  </div>
                )}

                {notifications.map((notification) => {
                  const meta = severityMeta[notification.severity];
                  const Icon = meta.icon;

                  return (
                    <DropdownMenuItem
                      key={notification.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 p-3',
                        !notification.read && 'bg-accent/60'
                      )}
                      onSelect={() => {
                        markRead(notification.id);
                        router.push(notification.href);
                      }}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          meta.className
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium">
                            {notification.title}
                          </span>
                          {!notification.read && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                          {notification.message}
                        </span>
                        <span className="mt-1 block text-[11px] font-medium text-primary">
                          View details
                        </span>
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </div>

              <DropdownMenuSeparator className="m-0" />
              <DropdownMenuItem
                className="cursor-pointer justify-center gap-1 rounded-none p-3 text-sm font-medium text-primary"
                onSelect={() => router.push('/notifications')}
              >
                View all notifications
                <ChevronRight className="h-4 w-4" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6" />

          {/* Quick Settings Link */}
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline text-sm font-medium">Settings</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
