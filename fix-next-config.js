const fs = require('fs');
let code = fs.readFileSync('next.config.js', 'utf8');
code = code.replace(/\{\s*source: '\/_next\/static\/:path\*',\s*headers: \[\s*\{\s*key: 'Cache-Control', value: 'public, max-age=31536000, immutable'\s*\}\s*\]\s*\},?/, '');
fs.writeFileSync('next.config.js', code);
