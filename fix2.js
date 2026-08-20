const fs = require('fs');
let code = fs.readFileSync('src/screens/ProfileScreen.jsx', 'utf8');

const target = `// ─── Lazy: telas de cuidador e estoque (só carregam quando abertas) ───────────
import { CaregiversScreen } from   () => import('@/screens/CaregiversScreen').then(m => ({ default: m.CaregiversScreen })),  { ssr: false, loading: () => <LoadingScreen icon="🤝" /> });
import { CaregiverDashboard } from   () => import('@/screens/CaregiverDashboard').then(m => ({ default: m.CaregiverDashboard })),  { ssr: false, loading: () => <LoadingScreen icon="👤" /> });
import { StockHistoryScreen } from   () => import('@/screens/StockHistoryScreen').then(m => ({ default: m.StockHistoryScreen })),  { ssr: false, loading: () => <LoadingScreen icon="📦" /> });`;

const replacement = `// ─── Telas de cuidador e estoque ───────────
import { CaregiversScreen } from '@/screens/CaregiversScreen';
import { CaregiverDashboard } from '@/screens/CaregiverDashboard';
import { StockHistoryScreen } from '@/screens/StockHistoryScreen';`;

const regex = /\/\/ ─── Lazy.*?\📦" \/> \} \);/s;

code = code.replace(regex, replacement);

fs.writeFileSync('src/screens/ProfileScreen.jsx', code);
