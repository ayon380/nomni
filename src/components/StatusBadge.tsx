import React from 'react';
import { OrderStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config: Record<OrderStatus, { bg: string; text: string; border: string; dot: string; label: string }> = {
    RECEIVED: {
      bg: 'bg-violet-500/10',
      text: 'text-violet-300',
      border: 'border-violet-500/25',
      dot: 'bg-violet-400',
      label: 'Received',
    },
    CONFIRMED: {
      bg: 'bg-sky-500/10',
      text: 'text-sky-300',
      border: 'border-sky-500/25',
      dot: 'bg-sky-400',
      label: 'Confirmed',
    },
    PREPARING: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-300',
      border: 'border-amber-500/25',
      dot: 'bg-amber-400 animate-pulse',
      label: 'Preparing',
    },
    READY: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-300',
      border: 'border-emerald-500/25',
      dot: 'bg-emerald-400',
      label: 'Ready for Pickup',
    },
    DELIVERED: {
      bg: 'bg-zinc-800/60',
      text: 'text-zinc-400',
      border: 'border-zinc-700/40',
      dot: 'bg-zinc-500',
      label: 'Delivered',
    },
    CANCELLED: {
      bg: 'bg-red-500/10',
      text: 'text-red-300',
      border: 'border-red-500/25',
      dot: 'bg-red-400',
      label: 'Cancelled',
    },
  };

  const style = config[status] || config.RECEIVED;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tracking-tight ${style.bg} ${style.text} border ${style.border} backdrop-blur-md ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
