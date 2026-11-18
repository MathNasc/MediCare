import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    const manifestPath = path.join(process.cwd(), 'src-apk', 'AndroidManifest.xml');
    const rootApkPath = path.join(process.cwd(), 'MediCare-Paciente.apk');
    const publicApkPath = path.join(process.cwd(), 'public', 'MediCare-Paciente.apk');
    const targetApkPath = fs.existsSync(rootApkPath) ? rootApkPath : publicApkPath;

    let versionCode = 0;
    let versionName = '';
    let packageName = 'br.com.medicare.paciente';

    if (fs.existsSync(manifestPath)) {
      const manifestXml = fs.readFileSync(manifestPath, 'utf8');
      const vcMatch = manifestXml.match(/android:versionCode="(\d+)"/);
      const vnMatch = manifestXml.match(/android:versionName="([^"]+)"/);
      const pkgMatch = manifestXml.match(/package="([^"]+)"/);
      if (vcMatch) versionCode = parseInt(vcMatch[1], 10) || 0;
      if (vnMatch) versionName = vnMatch[1].trim();
      if (pkgMatch) packageName = pkgMatch[1].trim();
    }

    const apkExists = fs.existsSync(targetApkPath);
    let apkSizeBytes = 0;
    let updatedAt = null;
    if (apkExists) {
      const stats = fs.statSync(targetApkPath);
      apkSizeBytes = stats.size;
      updatedAt = stats.mtime.toISOString();
    }

    return NextResponse.json(
      {
        ok: true,
        package: packageName,
        versionCode,
        versionName,
        apkAvailable: apkExists,
        apkSizeBytes,
        updatedAt,
        downloadUrl: '/api/apk',
      },
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Erro ao verificar versão do APK', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
