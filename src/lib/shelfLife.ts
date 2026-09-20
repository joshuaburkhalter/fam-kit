import type { PantryLocation, FreshnessStatus } from '../types';

export function getDaysUntilExpiry(expiresAt: string): number {
  if (!expiresAt) return 999;
  const now = new Date();
  // Strip time part for standard day difference
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const exp = new Date(expiresAt);
  const target = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());

  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getFreshnessStatus(expiresAt: string): FreshnessStatus {
  const days = getDaysUntilExpiry(expiresAt);
  if (days < 0) return 'expired';
  if (days <= 3) return 'expiring_soon';
  return 'fresh';
}

export interface FreshnessBadgeInfo {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}

export function getFreshnessBadge(freshness: FreshnessStatus, daysUntilExpiry?: number): FreshnessBadgeInfo {
  const days = daysUntilExpiry ?? 0;

  if (freshness === 'expired') {
    const absDays = Math.abs(days);
    const label = absDays === 0 ? 'Expired today' : `Expired ${absDays}d ago`;
    return {
      label,
      color: 'text-red-700 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/40',
      borderColor: 'border-red-200 dark:border-red-800/60',
      dotColor: 'bg-red-500',
    };
  }

  if (freshness === 'expiring_soon') {
    const label = days === 0 ? 'Expires today' : days === 1 ? 'Expires tomorrow' : `Expires in ${days} days`;
    return {
      label,
      color: 'text-amber-700 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/40',
      borderColor: 'border-amber-200 dark:border-amber-800/60',
      dotColor: 'bg-amber-500',
    };
  }

  // Fresh
  const label = days >= 365 ? '1y+ left' : days > 30 ? `${Math.round(days / 30)}mo left` : `${days}d left`;
  return {
    label,
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-200 dark:border-emerald-800/60',
    dotColor: 'bg-emerald-500',
  };
}

export function getLocationMeta(location: PantryLocation): { label: string; icon: string; bg: string; text: string } {
  switch (location) {
    case 'fridge':
      return {
        label: 'Fridge',
        icon: '🧊',
        bg: 'bg-cyan-50 dark:bg-cyan-950/40',
        text: 'text-cyan-700 dark:text-cyan-300',
      };
    case 'freezer':
      return {
        label: 'Freezer',
        icon: '❄️',
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        text: 'text-blue-700 dark:text-blue-300',
      };
    case 'pantry':
    default:
      return {
        label: 'Pantry',
        icon: '🥫',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-300',
      };
  }
}
