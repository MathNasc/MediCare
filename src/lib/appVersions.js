import fs from 'fs';
import path from 'path';

export function readWebVersionInfo(rootDir = process.cwd()) {
  let version = '2.0.0';
  let name = 'MediCare Cuidador Web';
  let swVersion = 'medicare-cuidador-v5';

  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg?.version) version = String(pkg.version).trim();
    } catch {}
  }

  const swPath = path.join(rootDir, 'public', 'sw.js');
  if (fs.existsSync(swPath)) {
    try {
      const swContent = fs.readFileSync(swPath, 'utf8');
      const swMatch = swContent.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
      if (swMatch) swVersion = swMatch[1].trim();
    } catch {}
  }

  return {
    name,
    version,
    swVersion,
    pwaSupported: true,
    timezone: 'America/Sao_Paulo',
  };
}

export function readAndroidAppVersionInfo({
  rootDir = process.cwd(),
  manifestRelPath,
  apkFileName,
  defaultName,
  defaultPackage,
  downloadUrl,
}) {
  const manifestPath = path.join(rootDir, manifestRelPath);
  const rootApkPath = path.join(rootDir, apkFileName);
  const publicApkPath = path.join(rootDir, 'public', apkFileName);
  const targetApkPath = fs.existsSync(rootApkPath) ? rootApkPath : publicApkPath;

  let versionCode = 0;
  let versionName = '';
  let packageName = defaultPackage;
  let appLabel = defaultName;

  if (fs.existsSync(manifestPath)) {
    try {
      const manifestXml = fs.readFileSync(manifestPath, 'utf8');
      const vcMatch = manifestXml.match(/android:versionCode="(\d+)"/);
      const vnMatch = manifestXml.match(/android:versionName="([^"]+)"/);
      const pkgMatch = manifestXml.match(/package="([^"]+)"/);
      const lblMatch = manifestXml.match(/android:label="([^"]+)"/);
      if (vcMatch) versionCode = parseInt(vcMatch[1], 10) || 0;
      if (vnMatch) versionName = vnMatch[1].trim();
      if (pkgMatch) packageName = pkgMatch[1].trim();
      if (lblMatch) appLabel = lblMatch[1].trim();
    } catch {}
  }

  const apkAvailable = fs.existsSync(targetApkPath);
  let apkSizeBytes = 0;
  let updatedAt = null;
  if (apkAvailable) {
    try {
      const stats = fs.statSync(targetApkPath);
      apkSizeBytes = stats.size;
      updatedAt = stats.mtime.toISOString();
    } catch {}
  }

  return {
    name: appLabel,
    package: packageName,
    versionCode,
    versionName: versionName || '1.0.0',
    apkFileName,
    apkAvailable,
    apkSizeBytes,
    updatedAt,
    downloadUrl,
  };
}

export function getAllSystemVersions(rootDir = process.cwd()) {
  const web = readWebVersionInfo(rootDir);
  const patientAndroid = readAndroidAppVersionInfo({
    rootDir,
    manifestRelPath: path.join('src-apk', 'AndroidManifest.xml'),
    apkFileName: 'MediCare-Paciente.apk',
    defaultName: 'MediCare Paciente',
    defaultPackage: 'br.com.medicare.paciente',
    downloadUrl: '/api/apk',
  });
  const caregiverAndroid = readAndroidAppVersionInfo({
    rootDir,
    manifestRelPath: path.join('src-apk-cuidador', 'AndroidManifest.xml'),
    apkFileName: 'MediCare-Cuidador.apk',
    defaultName: 'MediCare Cuidador',
    defaultPackage: 'br.com.medicare.cuidador',
    downloadUrl: '/api/apk/cuidador',
  });

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    web,
    patientAndroid,
    caregiverAndroid,
  };
}
