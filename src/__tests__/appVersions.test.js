import path from 'path';
import {
  readWebVersionInfo,
  readAndroidAppVersionInfo,
  getAllSystemVersions,
} from '@/lib/appVersions';

describe('appVersions helpers', () => {
  const rootDir = process.cwd();

  test('readWebVersionInfo extracts package.json version and sw.js cache version', () => {
    const web = readWebVersionInfo(rootDir);
    expect(web.name).toBe('MediCare Cuidador Web');
    expect(web.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(web.swVersion).toContain('medicare-cuidador');
    expect(web.timezone).toBe('America/Sao_Paulo');
  });

  test('readAndroidAppVersionInfo reads Patient Android manifest and APK stats', () => {
    const patient = readAndroidAppVersionInfo({
      rootDir,
      manifestRelPath: path.join('src-apk', 'AndroidManifest.xml'),
      apkFileName: 'MediCare-Paciente.apk',
      defaultName: 'MediCare Paciente',
      defaultPackage: 'br.com.medicare.paciente',
      downloadUrl: '/api/apk',
    });

    expect(patient.package).toBe('br.com.medicare.paciente');
    expect(patient.versionCode).toBeGreaterThanOrEqual(290);
    expect(patient.versionName).toBe('2.9.0');
    expect(patient.apkAvailable).toBe(true);
    expect(patient.apkSizeBytes).toBeGreaterThan(0);
    expect(patient.downloadUrl).toBe('/api/apk');
  });

  test('getAllSystemVersions returns unified web, patientAndroid, and caregiverAndroid metadata', () => {
    const versions = getAllSystemVersions(rootDir);
    expect(versions.ok).toBe(true);
    expect(versions.web.version).toBeTruthy();
    expect(versions.patientAndroid.downloadUrl).toBe('/api/apk');
    expect(versions.caregiverAndroid.package).toBe('br.com.medicare.cuidador');
    expect(versions.caregiverAndroid.versionCode).toBe(200);
    expect(versions.caregiverAndroid.versionName).toBe('2.0.0');
    expect(versions.caregiverAndroid.downloadUrl).toBe('/api/apk/cuidador');
  });
});
