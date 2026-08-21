const fs = require('fs');
let code = fs.readFileSync('src/lib/supabase.js', 'utf8');

code = code.replace(/async getSession\(\) \{/, 
`async getProfileRole(userId) {
    if (!supabase) return 'independente';
    try {
      const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
      if (error) {
        console.error('getProfileRole error:', error);
        return 'independente';
      }
      return data?.role || 'independente';
    } catch { return 'independente'; }
  },
  async getSession() {`);

fs.writeFileSync('src/lib/supabase.js', code);
