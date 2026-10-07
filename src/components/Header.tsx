'use client';

import React from 'react';
import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { Radio, Keyboard } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b transition-colors duration-200 border-[#E8E2D1] dark:border-white/[0.08] bg-[#FAF7E9]/85 dark:bg-[#101216]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Nomni Brand Header */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-[#0E3727] dark:bg-[#181B20] border border-[#2AC864]/30 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200">
            <span className="font-bold text-lg text-[#2AC864] font-display">n</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-[#0E3727] dark:text-[#F4F4F6] font-display">
                nomni
              </span>
              <span className="text-[10px] uppercase font-mono font-semibold tracking-wider px-2 py-0.5 rounded-full bg-[#0E3727]/10 dark:bg-[#2AC864]/15 text-[#0E3727] dark:text-[#2AC864] border border-[#0E3727]/15 dark:border-[#2AC864]/30">
                Kitchen OS
              </span>
            </div>
            <p className="text-[11px] text-[#4A4E57] dark:text-[#8D919C]">
              Unified Marketplace Ingestion
            </p>
          </div>
        </Link>

        {/* Status Indicators & Controls */}
        <div className="flex items-center gap-3">
          {/* Keyboard navigation helper pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-[#EFE9D7] dark:bg-white/[0.05] text-[#4A4E57] dark:text-zinc-400 border border-[#E0D8C3] dark:border-white/[0.06]">
            <Keyboard className="w-3.5 h-3.5 text-[#0E3727] dark:text-[#2AC864]" />
            <span>Use ↑ ↓ & Enter</span>
          </div>

          {/* Ingest active badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-[#EFE9D7] dark:bg-zinc-900 border border-[#E0D8C3] dark:border-white/[0.08] text-[#0E3727] dark:text-zinc-200">
            <Radio className="w-3.5 h-3.5 text-[#2AC864] animate-pulse" />
            <span>API Online</span>
            <span className="text-[#B3AC99] dark:text-zinc-600">•</span>
            <span className="font-mono text-[11px] text-[#4A4E57] dark:text-zinc-400">POST /api/webhooks</span>
          </div>

          {/* Light / Dark Mode Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
