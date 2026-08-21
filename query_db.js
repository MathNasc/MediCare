const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data: subs, error } = await supabase.from('push_subscriptions').select('endpoint, timezone');
  console.log("Subscriptions:", subs);
  console.log("Error:", error);
}
run();
