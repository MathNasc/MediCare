const fs = require('fs');
let code = fs.readFileSync('src/lib/supabase.js', 'utf8');

code = code.replace(/async signUp[\s\S]*?return \{ data, error \};\n  \},/, 
`async signUp(email, password, nome) {
    if (!supabase) return { error: 'Supabase não configurado' };
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { nome } },
    });
    console.log('[Auth Diagnostics] signUp result:', { 
      error, 
      hasUser: !!data?.user, 
      hasSession: !!data?.session, 
      userId: data?.user?.id 
    });
    
    if (!error && data.user) {
      if (!data.session) {
        console.warn('[Auth Diagnostics] signUp returned NO session! (Likely repeated signup or email confirm required)');
      } else {
        await supabase.from('profiles').upsert({ id: data.user.id, nome, email });
      }
    }
    return { data, error };
  },`);

fs.writeFileSync('src/lib/supabase.js', code);
