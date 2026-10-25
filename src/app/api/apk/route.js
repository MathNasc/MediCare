import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const rootApkPath = path.join(process.cwd(), 'medicare-patient.apk');
    const publicApkPath = path.join(process.cwd(), 'public', 'medicare-patient.apk');
    const targetPath = fs.existsSync(rootApkPath) ? rootApkPath : publicApkPath;

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json(
        { error: 'Arquivo medicare-patient.apk não encontrado.' },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(targetPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="medicare-patient.apk"',
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao baixar medicare-patient.apk', details: error.message },
      { status: 500 }
    );
  }
}
