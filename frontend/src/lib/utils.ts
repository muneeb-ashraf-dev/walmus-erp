import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'PKR'): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number, decimals = 2): string {
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(d);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getExpiryStatus(expiryDate: string | Date): 'expired' | 'critical' | 'warning' | 'caution' | 'ok' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expired';
  if (diffDays <= 7) return 'critical';
  if (diffDays <= 30) return 'warning';
  if (diffDays <= 90) return 'caution';
  return 'ok';
}

export function getExpiryColor(status: string): string {
  switch (status) {
    case 'expired':
      return 'text-destructive bg-destructive/10 border-destructive/20';
    case 'critical':
      return 'text-orange-600 bg-orange-100 border-orange-200 dark:text-orange-400 dark:bg-orange-900/30 dark:border-orange-800';
    case 'warning':
      return 'text-amber-600 bg-amber-100 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800';
    case 'caution':
      return 'text-blue-600 bg-blue-100 border-blue-200 dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800';
    default:
      return 'text-green-600 bg-green-100 border-green-200 dark:text-green-400 dark:bg-green-900/30 dark:border-green-800';
  }
}

export function getExpiryLabel(status: string): string {
  switch (status) {
    case 'expired':
      return 'Expired';
    case 'critical':
      return '≤ 7 days';
    case 'warning':
      return '8-30 days';
    case 'caution':
      return '31-90 days';
    default:
      return 'OK';
  }
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'posted':
      return 'text-green-600 bg-green-100 border-green-200';
    case 'draft':
      return 'text-gray-600 bg-gray-100 border-gray-200';
    case 'cancelled':
      return 'text-destructive bg-destructive/10 border-destructive/20';
    case 'paid':
      return 'text-green-600 bg-green-100 border-green-200';
    case 'partial':
      return 'text-amber-600 bg-amber-100 border-amber-200';
    case 'unpaid':
      return 'text-red-600 bg-red-100 border-red-200';
    case 'overdue':
      return 'text-destructive bg-destructive/10 border-destructive/20';
    case 'active':
      return 'text-green-600 bg-green-100 border-green-200';
    case 'quarantined':
      return 'text-orange-600 bg-orange-100 border-orange-200';
    case 'depleted':
      return 'text-gray-600 bg-gray-100 border-gray-200';
    default:
      return 'text-gray-600 bg-gray-100 border-gray-200';
  }
}

export function getPaymentStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'text-green-600 bg-green-100 border-green-200';
    case 'partial':
      return 'text-amber-600 bg-amber-100 border-amber-200';
    case 'unpaid':
      return 'text-red-600 bg-red-100 border-red-200';
    case 'overdue':
      return 'text-destructive bg-destructive/10 border-destructive/20';
    default:
      return 'text-gray-600 bg-gray-100 border-gray-200';
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}