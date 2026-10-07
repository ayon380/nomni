import React from 'react';
import { OrderStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config: Record<OrderStatus, { light: string; dark: string; dot: string; label: string }> = {
    RECEIVED: {
      light: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
      dark: 'bg-[#1E293B] text-[#93C5FD] border-[#334155]',
      dot: 'bg-[#3B82F6]',
      label: 'Received',
    },
    CONFIRMED: {
      light: 'bg-[#EDF8F1] text-[#0E3727] border-[#BDE5CB]',
      dark: 'bg-[#0E3727] text-[#34D399] border-[#1D5940]',
      dot: 'bg-[#2AC864]',
      label: 'Confirmed',
    },
    PREPARING: {
      light: 'bg-[#FEF8ED] text-[#B45309] border-[#FDE68A]',
      dark: 'bg-[#2E1D05] text-[#FBBF24] border-[#66420A]',
      dot: 'bg-[#F59E0B] animate-pulse',
      label: 'Preparing',
    },
    READY: {
      light: 'bg-[#E7F8EE] text-[#047857] border-[#A7F3D0]',
      dark: 'bg-[#062D1D] text-[#34D399] border-[#0F5A3B]',
      dot: 'bg-[#10B981]',
      label: 'Ready for Pickup',
    },
    DELIVERED: {
      light: 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]',
      dark: 'bg-[#1E2024] text-[#9CA3AF] border-[#374151]',
      dot: 'bg-[#9CA3AF]',
      label: 'Delivered',
    },
    CANCELLED: {
      light: 'bg-[#FDF2F2] text-[#B91C1C] border-[#FCA5A5]',
      dark: 'bg-[#2E0F12] text-[#F87171] border-[#5E1E24]',
      dot: 'bg-[#EF4444]',
      label: 'Cancelled',
    },
  };

  const style = config[status] || config.RECEIVED;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-tight border transition-colors ${style.light} dark:${style.dark} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
