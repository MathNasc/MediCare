const fs = require('fs');
let code = fs.readFileSync('src/screens/ProfileScreen.jsx', 'utf8');

code = code.replace(/import dynamic from 'next\/dynamic';/, '');

code = code.replace(/import \{ CaregiversScreen \} from   \(\) => import\('.*?'\).then\(m => \(\{ default: m.CaregiversScreen \}\)\),  \{ ssr: false, loading: \(\) => <LoadingScreen icon=".*?" \/> \}\);/, "import { CaregiversScreen } from '@/screens/CaregiversScreen';");
code = code.replace(/import \{ CaregiverDashboard \} from   \(\) => import\('.*?'\).then\(m => \(\{ default: m.CaregiverDashboard \}\)\),  \{ ssr: false, loading: \(\) => <LoadingScreen icon=".*?" \/> \}\);/, "import { CaregiverDashboard } from '@/screens/CaregiverDashboard';");
code = code.replace(/import \{ StockHistoryScreen \} from   \(\) => import\('.*?'\).then\(m => \(\{ default: m.StockHistoryScreen \}\)\),  \{ ssr: false, loading: \(\) => <LoadingScreen icon=".*?" \/> \}\);/, "import { StockHistoryScreen } from '@/screens/StockHistoryScreen';");

fs.writeFileSync('src/screens/ProfileScreen.jsx', code);
