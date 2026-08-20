const fs = require('fs');
let code = fs.readFileSync('src/app/layout.jsx', 'utf8');

code = code.replace(/<script dangerouslySetInnerHTML=\{\{ __html: \`[\s\S]*?\}\} \/>/,
`<script dangerouslySetInnerHTML={{ __html: \`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(registration) {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
              }, function(err) {
                console.log('ServiceWorker registration failed: ', err);
              });
            });
          }
        \`}} />`);

fs.writeFileSync('src/app/layout.jsx', code);
