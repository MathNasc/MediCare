import { NextResponse } from 'next/server';
import { checkOraclePostgresHealth } from '@/lib/oraclePostgres';

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
