'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { DashboardSummary, ExpiryAlertSummary, LowStockItem } from '@/types';

export type NotificationSeverity = 'critical' | 'warning' | 'info';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  href: string;
  severity: NotificationSeverity;
}

const READ_STORAGE_KEY = 'walmus:read-notifications';
const REFRESH_INTERVAL_MS = 60_000;
const MAX_STORED_READ_IDS = 200;

function readStoredIds(): Set<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(READ_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

function writeStoredIds(ids: Set<string>) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      READ_STORAGE_KEY,
      JSON.stringify(Array.from(ids).slice(-MAX_STORED_READ_IDS))
    );
  } catch {
    // Storage can be unavailable in private browsing; notifications still work for the session.
  }
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildNotifications(
  summary: DashboardSummary,
  expiry: ExpiryAlertSummary,
  lowStock: LowStockItem[]
): AppNotification[] {
  const notifications: AppNotification[] = [];
  const tiers = new Map(expiry.alerts.map((alert) => [alert.tier, alert]));

  const expired = tiers.get('expired');
  const expiredCount = summary.expired_batches_count || expired?.batch_count || 0;
  if (expiredCount > 0) {
    const value = summary.expired_batches_value || expired?.total_value || 0;
    notifications.push({
      id: 'expired-batches',
      title: 'Expired stock needs review',
      message: `${pluralize(expiredCount, 'batch', 'batches')} worth ${formatCurrency(value)} are expired and still in stock.`,
      href: '/inventory?status=expired',
      severity: 'critical',
    });
  }

  const critical = tiers.get('critical');
  if (critical && critical.batch_count > 0) {
    notifications.push({
      id: 'expiry-critical',
      title: 'Batches expiring within 7 days',
      message: `${pluralize(critical.batch_count, 'batch', 'batches')} (${pluralize(Math.round(critical.total_quantity), 'unit')}) expire in the next 7 days.`,
      href: '/inventory/expiring',
      severity: 'critical',
    });
  }

  const expiringThirty = tiers.get('expiring_30');
  if (expiringThirty && expiringThirty.batch_count > 0) {
    notifications.push({
      id: 'expiry-30-days',
      title: 'Batches expiring in 8-30 days',
      message: `${pluralize(expiringThirty.batch_count, 'batch', 'batches')} worth ${formatCurrency(expiringThirty.total_value)} should be prioritized for sale.`,
      href: '/inventory/expiring',
      severity: 'warning',
    });
  }

  if (summary.low_stock_count > 0) {
    const examples = lowStock
      .slice(0, 2)
      .map((item) => item.name)
      .join(', ');
    notifications.push({
      id: 'low-stock',
      title: 'Medicines below reorder level',
      message: `${pluralize(summary.low_stock_count, 'medicine')} at or below reorder level${
        examples ? ` - ${examples}${summary.low_stock_count > 2 ? ' and more' : ''}` : ''
      }.`,
      href: '/dashboard#low-stock',
      severity: 'warning',
    });
  }

  if (summary.overdue_receivables > 0) {
    notifications.push({
      id: 'overdue-receivables',
      title: 'Overdue customer payments',
      message: `${formatCurrency(summary.overdue_receivables)} is overdue and needs collection follow-up.`,
      href: '/customers',
      severity: 'warning',
    });
  }

  if (summary.overdue_payables > 0) {
    notifications.push({
      id: 'overdue-payables',
      title: 'Overdue supplier payments',
      message: `${formatCurrency(summary.overdue_payables)} is overdue to suppliers.`,
      href: '/suppliers',
      severity: 'warning',
    });
  }

  return notifications;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (background = false) => {
    if (background) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [summaryResponse, expiryResponse, lowStockResponse] = await Promise.all([
        api.get<DashboardSummary>('/api/dashboard/summary'),
        api.get<ExpiryAlertSummary>('/api/dashboard/expiry-alerts'),
        api.get<LowStockItem[]>('/api/dashboard/low-stock', { params: { limit: 5 } }),
      ]);

      setNotifications(
        buildNotifications(summaryResponse.data, expiryResponse.data, lowStockResponse.data)
      );
      setError(null);
      setLastUpdated(new Date());
    } catch {
      setError('Could not load notifications. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const refresh = useCallback(() => load(true), [load]);

  const markRead = useCallback((id: string) => {
    setReadIds((current) => {
      if (current.has(id)) {
        return current;
      }
      const next = new Set(current);
      next.add(id);
      writeStoredIds(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((current) => {
      const next = new Set(current);
      notifications.forEach((notification) => next.add(notification.id));
      writeStoredIds(next);
      return next;
    });
  }, [notifications]);

  useEffect(() => {
    setReadIds(readStoredIds());
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === READ_STORAGE_KEY) {
        setReadIds(readStoredIds());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    load();

    const interval = window.setInterval(() => load(true), REFRESH_INTERVAL_MS);
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        load(true);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        load(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [load]);

  const visibleNotifications = useMemo(
    () =>
      notifications.map((notification) => ({
        ...notification,
        read: readIds.has(notification.id),
      })),
    [notifications, readIds]
  );

  const unreadCount = useMemo(
    () => visibleNotifications.filter((notification) => !notification.read).length,
    [visibleNotifications]
  );

  return {
    notifications: visibleNotifications,
    unreadCount,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
    markRead,
    markAllRead,
  };
}
