const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('notes').insert({
  user_id: 'test', 
  title: 'test', 
  date: '2026-08-24', 
  time: ''
}).then(res => console.log(JSON.stringify(res, null, 2)));
