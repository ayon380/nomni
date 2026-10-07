import React from 'react';
import { OrderStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

interface StatusConfig {
  badge: string;
  dot: string;
  label: string;
}

const STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  RECEIVED: {
    badge: 'bg-[#EFF6FF] dark:bg-[#1E293B] text-[#1D4ED8] dark:text-[#93C5FD] border-[#BFDBFE] dark:border-[#334155]',
    dot: 'bg-[#3B82F6] dark:bg-[#60A5FA]',
    label: 'Received',
  },
  CONFIRMED: {
    badge: 'bg-[#EDF8F1] dark:bg-[#06291C] text-[#0E3727] dark:text-[#34D399] border-[#BDE5CB] dark:border-[#0E5C3B]',
    dot: 'bg-[#2AC864] dark:bg-[#34D399]',
    label: 'Confirmed',
  },
  PREPARING: {
    badge: 'bg-[#FEF8ED] dark:bg-[#2E1D05] text-[#B45309] dark:text-[#FBBF24] border-[#FDE68A] dark:border-[#66420A]',
    dot: 'bg-[#F59E0B] dark:bg-[#FBBF24] animate-pulse',
    label: 'Preparing',
  },
  READY: {
    badge: 'bg-[#E7F8EE] dark:bg-[#062D1D] text-[#047857] dark:text-[#34D399] border-[#A7F3D0] dark:border-[#0F5A3B]',
    dot: 'bg-[#10B981] dark:bg-[#34D399]',
    label: 'Ready for Pickup',
  },
  DELIVERED: {
    badge: 'bg-[#F3F4F6] dark:bg-[#1E2024] text-[#4B5563] dark:text-[#9CA3AF] border-[#E5E7EB] dark:border-[#374151]',
    dot: 'bg-[#9CA3AF] dark:bg-[#6B7280]',
    label: 'Delivered',
  },
  CANCELLED: {
    badge: 'bg-[#FDF2F2] dark:bg-[#2A0E10] text-[#B91C1C] dark:text-[#F87171] border-[#FCA5A5] dark:border-[#5C1D24]',
    dot: 'bg-[#EF4444] dark:bg-[#F87171]',
    label: 'Cancelled',
  },
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.RECEIVED;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-tight border transition-colors ${config.badge} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
