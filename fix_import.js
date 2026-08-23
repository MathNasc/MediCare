const fs = require('fs');
let code = fs.readFileSync('src/screens/ProfileScreen.jsx', 'utf8');
code = code.replace("import { useNotifications } from '@/hooks/useNotifications';\n", "");
code = code.replace("'use client';\n", "'use client';\nimport { useNotifications } from '@/hooks/useNotifications';\n");
fs.writeFileSync('src/screens/ProfileScreen.jsx', code);
