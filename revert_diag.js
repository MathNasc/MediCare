const fs = require('fs');
let code = fs.readFileSync('src/lib/supabase.js', 'utf8');
code = code.replace(/console\.log\('\[Auth Diagnostics\].*?\n.*?if \(!error && data\.user\) \{\n.*?if \(!data\.session\) \{\n.*?\n.*?\n.*?\n.*?\}/s,
`if (!error && data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, nome, email });
    }`);
fs.writeFileSync('src/lib/supabase.js', code);
