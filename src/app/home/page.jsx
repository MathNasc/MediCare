'use client';
import { useState, useEffect } from 'react';
import MainApp from '@/components/MainApp';

export default function Page() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null; // Return absolute null on server to guarantee no HTML mismatch
  }

  return <MainApp />;
}
