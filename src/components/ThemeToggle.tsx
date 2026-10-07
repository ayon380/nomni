'use client';

import React, { useSyncExternalStore } from 'react';
import { useThemeStore } from '@/store/useThemeStore';
import { Sun, Moon } from 'lucide-react';

const emptySubscribe = () => () => {};

export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const isLight = mounted ? theme === 'light' : false;

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label="Toggle color theme"
      className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${
        isLight
          ? 'bg-[#EFE9D7] hover:bg-[#E4DDC7] text-[#0E3727]'
          : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200'
      } ${className}`}
      title={mounted ? `Toggle theme (current: ${theme})` : 'Toggle theme'}
    >
      {isLight ? (
        <Moon className="w-4 h-4 text-[#0E3727]" />
      ) : (
        <Sun className="w-4 h-4 text-[#2AC864]" />
      )}
    </button>
  );
}
