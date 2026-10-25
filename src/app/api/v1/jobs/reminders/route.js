import { NextResponse } from 'next/server';
import { runMedicationReminderWorker } from '@/lib/reminderWorker';

export async function POST(req) {
  const expectedKey = process.env.CRON_SECRET || process.env.BACKEND_API_KEY;
  if (expectedKey) {
    const provided =
      req.headers.get('x-api-key') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (provided !== expectedKey) {
      return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });
    }
  }

  try {
    const res = await runMedicationReminderWorker();
    return NextResponse.json(res, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req) {
  return POST(req);
}
