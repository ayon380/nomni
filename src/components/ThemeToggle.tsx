'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${
        theme === 'light'
          ? 'bg-[#EFE9D7] hover:bg-[#E4DDC7] text-[#0E3727]'
          : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200'
      } ${className}`}
      title={`Toggle theme (current: ${theme})`}
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4 text-[#0E3727]" />
      ) : (
        <Sun className="w-4 h-4 text-[#2AC864]" />
      )}
    </button>
  );
}
