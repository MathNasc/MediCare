import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: history, error } = await supabase.from('historico_doses').select('*');
    if (error) return NextResponse.json({ error });

    const grouped = {};
    const toDelete = [];

    history.forEach(d => {
       const date = new Date(d.created_at).toDateString();
       const key = `${d.user_id}_${d.med_id}_${d.hora}_${date}`;
       if (!grouped[key]) {
         grouped[key] = d;
       } else {
         toDelete.push(d.id);
       }
    });

    for (const id of toDelete) {
      await supabase.from('historico_doses').delete().eq('id', id);
    }

    return NextResponse.json({ deletedCount: toDelete.length, toDelete });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
