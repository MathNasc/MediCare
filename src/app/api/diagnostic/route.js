import { NextResponse } from 'next/server';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return NextResponse.json({
    url: supabaseUrl || 'None',
    host: supabaseUrl ? new URL(supabaseUrl).hostname : 'None'
  });
}
