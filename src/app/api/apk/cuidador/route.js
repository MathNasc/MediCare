import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const rootApkPath = path.join(process.cwd(), 'MediCare-Cuidador.apk');
    const publicApkPath = path.join(process.cwd(), 'public', 'MediCare-Cuidador.apk');
    const targetPath = fs.existsSync(rootApkPath) ? rootApkPath : publicApkPath;

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json(
        {
          error:
            'Arquivo MediCare-Cuidador.apk ainda não foi gerado no servidor. Execute scripts/rebuild_and_sign_cuidador_apk.sh ou instale o app via navegador (PWA).',
        },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(targetPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="MediCare-Cuidador.apk"',
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao baixar MediCare-Cuidador.apk', details: error.message },
      { status: 500 }
    );
  }
}
