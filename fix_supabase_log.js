const fs = require('fs');
let code = fs.readFileSync('src/lib/supabase.js', 'utf8');

code = code.replace(/if \(typeof window !== 'undefined' && !isSupabaseEnabled\) \{[\s\S]*?\}/, `if (typeof window !== 'undefined' && !isSupabaseEnabled) {
  console.error(
    '[MediCare] ⚠ Supabase NÃO configurado neste build. ' +
    'O aplicativo não funcionará corretamente sem o banco de dados. ' +
    'Verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no ' +
    'ambiente de deploy e gere um novo deploy.'
  );
}`);

fs.writeFileSync('src/lib/supabase.js', code);
