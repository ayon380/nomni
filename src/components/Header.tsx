'use client';

import React from 'react';
import Link from 'next/link';
import { ChefHat, Radio, ArrowUpRight } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-zinc-950/75 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 p-0.5 shadow-lg shadow-violet-500/20 group-hover:scale-105 transition-transform duration-200">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <ChefHat className="w-4 h-4 text-violet-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base tracking-tight text-white">nomni</span>
              <span className="text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                Kitchen OS
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-normal">Marketplace Orders Unified Ticket</p>
          </div>
        </Link>

        {/* Status / Live Badge */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-white/[0.08] text-xs text-zinc-300">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Ingest Active</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400 font-mono text-[11px]">POST /api/webhooks</span>
          </div>

          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg hover:bg-white/[0.04]"
          >
            <span>v1.0.0</span>
            <ArrowUpRight className="w-3 h-3 text-zinc-500" />
          </a>
        </div>
      </div>
    </header>
  );
}
