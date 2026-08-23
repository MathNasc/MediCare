import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
export async function GET() {
  const { data, error } = await supabase.from('historico_doses').select('*').limit(1);
  return NextResponse.json({ data, error });
}
