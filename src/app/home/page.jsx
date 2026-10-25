'use client';
import { useState, useEffect } from 'react';
import MainApp from '@/components/MainApp';

export default function Page() {
  const [isClient, setIsClient] = useState(false);
  const [showApkBanner, setShowApkBanner] = useState(true);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null; // Return absolute null on server to guarantee no HTML mismatch
  }

  return (
    <>
      {showApkBanner && (
        <div
          style={{
            position: 'fixed',
            bottom: '84px',
            right: '16px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#0F172A',
            color: '#F8FAFC',
            padding: '10px 14px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
            border: '1px solid rgba(59, 130, 246, 0.5)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <a
            href="/api/apk"
            download="medicare-patient.apk"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#2563EB',
              color: '#FFFFFF',
              padding: '6px 12px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            ⬇ Baixar medicare-patient.apk
          </a>
          <button
            onClick={() => setShowApkBanner(false)}
            aria-label="Fechar aviso de download do APK"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              fontSize: '16px',
              lineHeight: 1,
              padding: '2px 4px',
            }}
          >
            ✕
          </button>
        </div>
      )}
      <MainApp />
    </>
  );
}

