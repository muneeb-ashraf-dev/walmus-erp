'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Info,
  RefreshCw,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  useNotifications,
  type NotificationSeverity,
} from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';

const severityMeta: Record<
  NotificationSeverity,
  {
    icon: ComponentType<{ className?: string }>;
    label: string;
    iconClassName: string;
    badgeClassName: string;
  }
> = {
  critical: {
    icon: AlertTriangle,
    label: 'Action required',
    iconClassName: 'bg-destructive/10 text-destructive',
    badgeClassName: 'border-destructive/20 bg-destructive/10 text-destructive',
  },
  warning: {
    icon: AlertCircle,
    label: 'Warning',
    iconClassName:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    badgeClassName:
      'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  info: {
    icon: Info,
    label: 'Info',
    iconClassName:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    badgeClassName:
      'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();

  const updatedLabel = lastUpdated
    ? `Updated ${lastUpdated.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'Connecting to live alerts';

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            <p className="text-muted-foreground">
              Live stock, expiry, and payment alerts that need your attention.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark all read
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <AlertCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium">
                  {unreadCount > 0
                    ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                    : 'No unread notifications'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {notifications.length} active alert
                  {notifications.length === 1 ? '' : 's'} · {updatedLabel}
                </p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">
                Back to dashboard
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {isLoading && notifications.length === 0 && (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <Card key={item}>
                <CardContent className="flex gap-4 p-4">
                  <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && error && notifications.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center px-6 py-12 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <h2 className="mt-4 font-semibold">Unable to load notifications</h2>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => void refresh()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && notifications.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center px-6 py-16 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <h2 className="mt-4 text-lg font-semibold">All caught up</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                There are no expired batches, expiring stock, low stock items, or
                overdue payments right now.
              </p>
            </CardContent>
          </Card>
        )}

        {notifications.length > 0 && (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const meta = severityMeta[notification.severity];
              const Icon = meta.icon;

              return (
                <Card
                  key={notification.id}
                  className={cn(
                    'transition-colors',
                    !notification.read && 'border-primary/30 bg-accent/20'
                  )}
                >
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                        meta.iconClassName
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium">{notification.title}</h2>
                        <Badge
                          variant="outline"
                          className={meta.badgeClassName}
                        >
                          {meta.label}
                        </Badge>
                        {!notification.read && (
                          <Badge className="bg-primary text-primary-foreground">
                            Unread
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {notification.message}
                      </p>
                    </div>

                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="shrink-0 self-start"
                    >
                      <Link
                        href={notification.href}
                        onClick={() => markRead(notification.id)}
                      >
                        View details
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
