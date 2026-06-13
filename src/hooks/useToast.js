'use client';
import { useState, useCallback } from 'react';

export function useToast() {
  const [list, setList] = useState([]);

  const show = useCallback((msg, type = 'ok', ms = 3200) => {
    const id = Date.now() + Math.random();
    setList((t) => [...t, { id, msg, type }]);
    setTimeout(() => setList((t) => t.filter((x) => x.id !== id)), ms);
  }, []);

  return { list, show };
}
