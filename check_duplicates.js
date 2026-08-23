const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('historico_doses').select('id, user_id, med_id, hora, created_at, status');
  if (error) console.error(error);
  else {
    const duplicates = {};
    data.forEach(d => {
       const date = new Date(d.created_at).toDateString();
       const key = `${d.user_id}_${d.med_id}_${d.hora}_${date}`;
       if (!duplicates[key]) duplicates[key] = [];
       duplicates[key].push(d);
    });
    const dupes = Object.values(duplicates).filter(arr => arr.length > 1);
    console.log("Duplicates found:", dupes.length);
    console.log(JSON.stringify(dupes, null, 2));
  }
}
run();
