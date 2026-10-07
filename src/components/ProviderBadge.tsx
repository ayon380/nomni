import React from 'react';
import { OrderProvider } from '@/lib/types';

interface ProviderBadgeProps {
  provider: OrderProvider;
  className?: string;
}

export function ProviderBadge({ provider, className = '' }: ProviderBadgeProps) {
  if (provider === 'uber_eats') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-tight transition-colors bg-[#E7F6ED] dark:bg-[#06291C] text-[#0E4A2F] dark:text-[#34D399] border border-[#BCE8CD] dark:border-[#0E5C3B] ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] dark:bg-[#34D399]" />
        Uber Eats
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-tight transition-colors bg-[#FDE8E8] dark:bg-[#2A0E10] text-[#9B1C1C] dark:text-[#F87171] border border-[#F8B4B4] dark:border-[#5C1D24] ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] dark:bg-[#F87171]" />
      DoorDash
    </span>
  );
}
