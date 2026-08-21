const fs = require('fs');
let code = fs.readFileSync('public/sw.js', 'utf8');

code = code.replace(/if \(res && res\.ok\) \{[\s\S]*?caches\.open\(cacheName\)\.then\(c => c\.put\(request, res\.clone\(\)\)\);\s*\}/,
`if (res && res.ok) {
          const resToCache = res.clone();
          const cacheName = url.pathname.startsWith('/_next/static') || url.pathname.match(/\\.(png|ico|svg|woff2?)$/)
             ? STATIC_CACHE
             : DYNAMIC_CACHE;
          caches.open(cacheName).then(c => c.put(request, resToCache));
        }`);

fs.writeFileSync('public/sw.js', code);
