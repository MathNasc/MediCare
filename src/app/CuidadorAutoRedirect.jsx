'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CuidadorAutoRedirect() {
  const router = useRouter();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('portal') === '1') return;

      const savedToken = localStorage.getItem('medicare_cuidador_jwt');
      if (savedToken) {
        document.cookie = 'medicare_cuidador_logged_in=1; path=/; max-age=31536000; SameSite=Lax';
        if (window.location.hostname === 'medicare-cuidador.duckdns.org') {
          window.location.replace('https://medicare-cuidador.duckdns.org/cuidador');
        } else {
          router.replace('/cuidador');
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [router]);

  return null;
}
