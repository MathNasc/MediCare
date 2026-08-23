const fs = require('fs');
let code = fs.readFileSync('src/screens/ProfileScreen.jsx', 'utf8');
code = code.replace("    document.body\n  );\n}\n", "    document.getElementById('root')\n  );\n}\n");
fs.writeFileSync('src/screens/ProfileScreen.jsx', code);
