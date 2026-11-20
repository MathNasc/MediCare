import { NextResponse } from 'next/server';
import { checkOraclePostgresHealth } from '@/lib/oraclePostgres';
import { ORACLE_BACKEND_URL } from '@/lib/oracleProxy';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  let localStatus = null;
  let localError = null;
  try {
    localStatus = await checkOraclePostgresHealth();
  } catch (err) {
    localError = err?.message || 'Falha ao conectar ao PostgreSQL';
  }

  if (!localStatus?.configured || !localStatus?.ok) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const proxyRes = await fetch(`${ORACLE_BACKEND_URL}/api/v1/health`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);
      const proxyData = await proxyRes.json().catch(() => null);
      if (proxyRes.ok && proxyData) {
        return NextResponse.json(
          {
            service: 'MediCare Web + Proxy Oracle',
            timestamp: new Date().toISOString(),
            ok: Boolean(proxyData.ok),
            configured: true,
            mode: localStatus?.configured ? 'ORACLE_PROXY_FALLBACK' : 'ORACLE_PROXY',
            localPgError: localError || localStatus?.error || null,
            upstreamUrl: ORACLE_BACKEND_URL,
            upstream: proxyData,
          },
          { status: 200, headers: corsHeaders }
        );
      }
    } catch {
      // segue retornando status local abaixo
    }
  }

  if (localStatus) {
    return NextResponse.json(
      {
        service: 'MediCare Oracle PostgreSQL Backend',
        timestamp: new Date().toISOString(),
        ...localStatus,
      },
      { status: 200, headers: corsHeaders }
    );
  }

  return NextResponse.json(
    {
      service: 'MediCare Oracle PostgreSQL Backend',
      ok: false,
      configured: true,
      error: localError || 'Falha ao conectar ao PostgreSQL no servidor Oracle',
    },
    { status: 500, headers: corsHeaders }
  );
}
