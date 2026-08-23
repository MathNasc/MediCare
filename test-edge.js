const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.example' });

// We only have ANON_KEY in .env.example, let's try to use it to invoke the function
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing Supabase URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFunction() {
  console.log('Invoking send-medication-reminders...');
  const { data, error } = await supabase.functions.invoke('send-medication-reminders', {
    method: 'POST',
    body: {}
  });

  if (error) {
    console.error('Error invoking function:', error);
  } else {
    console.log('Function response:', data);
  }
}

testFunction();
