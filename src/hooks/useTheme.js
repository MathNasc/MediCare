'use client';
import { useState, useEffect } from 'react';
import { TK } from '@/lib/theme';

export function useTheme() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('mc_theme');
      setDark(stored === null ? true : stored === 'dark');
    } catch {}
  }, []);

  const toggle = () =>
    setDark((d) => {
      try { localStorage.setItem('mc_theme', !d ? 'dark' : 'light'); } catch {}
      return !d;
    });

  return { dark, toggle, T: TK(dark) };
}
