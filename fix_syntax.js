const fs = require('fs');
let code = fs.readFileSync('src/lib/supabase.js', 'utf8');
code = code.replace(/    \}\n    \}\n    return \{ data, error \};\n  \},/, 
`    }
    return { data, error };
  },`);
fs.writeFileSync('src/lib/supabase.js', code);
