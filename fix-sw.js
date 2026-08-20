const fs = require('fs');
let code = fs.readFileSync('src/components/MainApp.jsx', 'utf8');

const regex = /useEffect\(\(\) => \{\n\s*if \(typeof window === 'undefined' \|\| !\('serviceWorker' in navigator\)\) return;\n\s*let registration = null;[\s\S]*?\}, \[\]\);/;
if (regex.test(code)) {
  code = code.replace(regex, `useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let reg of registrations) reg.unregister();
    });
  }, []);`);
  fs.writeFileSync('src/components/MainApp.jsx', code);
  console.log('Replaced successfully');
} else {
  console.log('Regex did not match');
}
