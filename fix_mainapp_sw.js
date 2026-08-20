const fs = require('fs');
let code = fs.readFileSync('src/components/MainApp.jsx', 'utf8');

code = code.replace(/useEffect\(\(\) => \{\s*if \(typeof window === 'undefined' \|\| !(?:'serviceWorker' in navigator)\) return;\s*navigator\.serviceWorker\.getRegistrations\(\)\.then\(\(registrations\) => \{\s*for \(let reg of registrations\) reg\.unregister\(\);\s*\}\);\s*\}, \[\]\);/,
`useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    
    let interval;
    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        reg.update();
      } catch (e) {
        console.error('SW Error:', e);
      }
    };
    
    checkForUpdates();
    
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') checkForUpdates();
    };
    
    window.addEventListener('visibilitychange', visibilityHandler);
    interval = setInterval(checkForUpdates, 5 * 60 * 1000);
    
    return () => {
      window.removeEventListener('visibilitychange', visibilityHandler);
      clearInterval(interval);
    };
  }, []);`);

fs.writeFileSync('src/components/MainApp.jsx', code);
