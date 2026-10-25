import { OrderStatus, OrderProvider } from './types';

/**
 * Formats integer cents into standard localized currency string (e.g., 2450 -> $24.50)
 */
export function formatMoney(cents: number, currency = 'USD'): string {
  const amount = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

/**
 * Formats ISO date into human readable, clean format
 */
export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return isoString;
  }
}

/**
 * Returns human-friendly provider labels
 */
export function getProviderLabel(provider: OrderProvider): string {
  switch (provider) {
    case 'uber_eats':
      return 'Uber Eats';
    case 'doordash':
      return 'DoorDash';
    default:
      return provider;
  }
}

/**
 * Returns canonical next status in lifecycle
 */
export function getNextStatus(current: OrderStatus): OrderStatus | null {
  switch (current) {
    case 'RECEIVED':
      return 'CONFIRMED';
    case 'CONFIRMED':
      return 'PREPARING';
    case 'PREPARING':
      return 'READY';
    case 'READY':
      return 'DELIVERED';
    case 'DELIVERED':
    case 'CANCELLED':
      return null;
    default:
      return null;
  }
}

const STATUS_RANKS: Record<OrderStatus, number> = {
  RECEIVED: 1,
  CONFIRMED: 2,
  PREPARING: 3,
  READY: 4,
  DELIVERED: 5,
  CANCELLED: 99,
};

/**
 * Validates that status transitions only advance forward monotonically,
 * allow cancellations from active states, and reject transitions out of terminal states.
 */
export function isValidStatusTransition(current: OrderStatus, target: OrderStatus): boolean {
  if (current === target) return true;
  if (current === 'DELIVERED' || current === 'CANCELLED') return false; // Terminal states
  if (target === 'CANCELLED') return true; // Can cancel from any active state

  return STATUS_RANKS[target] > STATUS_RANKS[current];
}

