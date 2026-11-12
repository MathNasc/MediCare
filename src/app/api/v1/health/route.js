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
  try {
    const status = await checkOraclePostgresHealth();

    if (!status.configured) {
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
              mode: 'ORACLE_PROXY',
              upstreamUrl: ORACLE_BACKEND_URL,
              upstream: proxyData,
            },
            { status: 200, headers: corsHeaders }
          );
        }
      } catch {
        // segue retornando status local não configurado abaixo
      }
    }

    return NextResponse.json(
      {
        service: 'MediCare Oracle PostgreSQL Backend',
        timestamp: new Date().toISOString(),
        ...status,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return NextResponse.json(
      {
        service: 'MediCare Oracle PostgreSQL Backend',
        ok: false,
        configured: true,
        error: err.message || 'Falha ao conectar ao PostgreSQL no servidor Oracle',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
