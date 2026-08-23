const fs = require('fs');
let code = fs.readFileSync('src/screens/ProfileScreen.jsx', 'utf8');
code = code.replace("  );\n\n\nexport function", "  );\n}\n\nexport function");
fs.writeFileSync('src/screens/ProfileScreen.jsx', code);
