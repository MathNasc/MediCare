'use client';
import { useState, useEffect } from 'react';

export function useFontScale() {
  const [size, setSize] = useState('normal');

  useEffect(() => {
    try { setSize(localStorage.getItem('mc_fs') || 'normal'); } catch {}
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-fs', size);
  }, [size]);

  const set = (s) => {
    try { localStorage.setItem('mc_fs', s); } catch {}
    setSize(s);
  };

  const scale = size === 'large' ? 1.14 : size === 'xlarge' ? 1.28 : 1;
  return { size, set, scale };
}
