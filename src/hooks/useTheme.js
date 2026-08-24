
'use client';
import { useState, useEffect } from 'react';
import { TK } from '@/lib/theme';

export function useTheme() {
  const [dark, setDark] = useState(true);
  const [hc, setHc] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('mc_theme');
      setDark(stored === null ? true : stored === 'dark');
      const storedHc = localStorage.getItem('mc_hc');
      setHc(storedHc === 'true');
    } catch {}
  }, []);

  const toggle = () =>
    setDark((d) => {
      try { localStorage.setItem('mc_theme', !d ? 'dark' : 'light'); } catch {}
      return !d;
    });

  const toggleHc = () =>
    setHc((h) => {
      try { localStorage.setItem('mc_hc', !h ? 'true' : 'false'); } catch {}
      return !h;
    });

  useEffect(() => {
    if (hc) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }, [hc]);

  return { dark, toggle, hc, toggleHc, T: TK(dark, hc) };
}
