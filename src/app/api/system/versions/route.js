import { NextResponse } from 'next/server';
import { getAllSystemVersions } from '@/lib/appVersions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const versions = getAllSystemVersions(process.cwd());
    return NextResponse.json(versions, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Erro ao consultar versões do MediCare', details: error.message },
      { status: 500 }
    );
  }
}
