const fs = require('fs');
let code = fs.readFileSync('src/app/layout.jsx', 'utf8');

code = code.replace(/<script dangerouslySetInnerHTML=[\s\S]*?<\/script>/, `<script dangerouslySetInnerHTML={{ __html: \`
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.update();
    });
  }
  if ('caches' in window) {
    caches.keys().then(function(names) {
      for (let name of names) caches.delete(name);
    });
  }
\`}} />`);

fs.writeFileSync('src/app/layout.jsx', code);
