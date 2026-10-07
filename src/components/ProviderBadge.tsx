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
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tracking-tight bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 backdrop-blur-md ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        Uber Eats
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tracking-tight bg-rose-950/60 text-rose-400 border border-rose-500/20 backdrop-blur-md ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
      DoorDash
    </span>
  );
}
