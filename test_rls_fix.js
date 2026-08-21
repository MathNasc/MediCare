const fs = require('fs');
let code = fs.readFileSync('src/app/test-rls/page.jsx', 'utf8');

code = code.replace(/import \{ useApp \} from '@\/context\/AppContext';/, "import { useApp, AppProvider } from '@/context/AppContext';");
code = code.replace(/export default function TestRLS\(\) \{\n  const \[isClient, setIsClient\] = useState\(false\);\n  useEffect\(\(\) => setIsClient\(true\), \[\]\);\n  return isClient \? <InnerTest \/> : null;\n\}/, 
`export default function TestRLS() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  return isClient ? (
    <AppProvider>
      <InnerTest />
    </AppProvider>
  ) : null;
}`);

fs.writeFileSync('src/app/test-rls/page.jsx', code);
