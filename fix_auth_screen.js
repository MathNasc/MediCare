const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.jsx', 'utf8');

code = code.replace(/\{\/\* Aviso: Supabase.*?\*\/\}\s*\{!isSupabaseEnabled && \([\s\S]*?<\/div>\s*\)\}/, '');

fs.writeFileSync('src/components/AuthScreen.jsx', code);
