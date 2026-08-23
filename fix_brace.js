const fs = require('fs');
let code = fs.readFileSync('src/screens/ProfileScreen.jsx', 'utf8');
code = code.replace("    document.body\n  );\nexport function", "    document.body\n  );\n}\n\nexport function");
fs.writeFileSync('src/screens/ProfileScreen.jsx', code);
