const fs = require('fs');
let code = fs.readFileSync('src/screens/ProfileScreen.jsx', 'utf8');
code = code.replace(
  "    document.getElementById('root')\n  );\n}",
  "    document.getElementById('root') || document.body\n  );\n}"
);
fs.writeFileSync('src/screens/ProfileScreen.jsx', code);
