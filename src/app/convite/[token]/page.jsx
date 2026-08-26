'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function ConvitePage() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    if (params?.token) {
      router.replace(`/home?convite=${params.token}`);
    } else {
      router.replace('/home');
    }
  }, [params, router]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0a0e1a' }}>
      <p style={{ color: '#fff', fontFamily: 'sans-serif' }}>Carregando convite...</p>
    </div>
  );
}
