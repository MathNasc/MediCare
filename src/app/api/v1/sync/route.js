import { NextResponse } from 'next/server';
import { getPgPool, ensureOraclePostgresSchema } from '@/lib/oraclePostgres';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || 'user-local-paciente';

  const pool = getPgPool();
  if (!pool) {
    return NextResponse.json(
      { ok: false, configured: false, error: 'PostgreSQL Oracle não configurado no ambiente (.env).' },
      { status: 503, headers: corsHeaders }
    );
  }

  const client = await pool.connect();
  try {
    await ensureOraclePostgresSchema(client);

    const [profileRes, medsRes, histRes, eventsRes, notesRes, algRes, condRes, contRes, profRes, cgRes, stockRes] =
      await Promise.all([
        client.query('SELECT * FROM profiles WHERE id = $1 LIMIT 1', [userId]),
        client.query('SELECT * FROM medicamentos WHERE user_id = $1 ORDER BY created_at ASC', [userId]),
        client.query('SELECT * FROM historico_doses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500', [userId]),
        client.query('SELECT * FROM health_events WHERE user_id = $1 ORDER BY date ASC', [userId]),
        client.query('SELECT * FROM calendar_notes WHERE user_id = $1 ORDER BY date DESC', [userId]),
        client.query('SELECT * FROM allergies WHERE user_id = $1', [userId]),
        client.query('SELECT * FROM health_conditions WHERE user_id = $1', [userId]),
        client.query('SELECT * FROM emergency_contacts WHERE user_id = $1 ORDER BY priority ASC', [userId]),
        client.query('SELECT * FROM healthcare_professionals WHERE user_id = $1', [userId]),
        client.query('SELECT * FROM caregiver_relationships WHERE patient_id = $1', [userId]),
        client.query('SELECT * FROM stock_movements WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200', [userId]),
      ]);

    return NextResponse.json(
      {
        ok: true,
        syncedAt: new Date().toISOString(),
        user: profileRes.rows[0] || null,
        meds: medsRes.rows,
        history: histRes.rows,
        events: eventsRes.rows,
        notes: notesRes.rows,
        allergies: algRes.rows,
        conditions: condRes.rows,
        contacts: contRes.rows,
        professionals: profRes.rows,
        caregivers: cgRes.rows,
        stock_movements: stockRes.rows,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Erro ao consultar dados no PostgreSQL Oracle' },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    client.release();
  }
}

export async function POST(request) {
  const pool = getPgPool();
  if (!pool) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error: 'Banco PostgreSQL Oracle ainda não configurado no servidor (defina DATABASE_URL ou ORACLE_PG_HOST).',
      },
      { status: 503, headers: corsHeaders }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400, headers: corsHeaders });
  }

  const user = body.user || {};
  const userId = user.id || body.userId || 'user-local-paciente';
  const meds = Array.isArray(body.meds) ? body.meds : [];
  const history = Array.isArray(body.history) ? body.history : [];
  const events = Array.isArray(body.events) ? body.events : [];
  const notes = Array.isArray(body.notes) ? body.notes : [];

  const client = await pool.connect();
  try {
    await ensureOraclePostgresSchema(client);
    await client.query('BEGIN');

    if (user.nome) {
      await client.query(
        `INSERT INTO profiles (id, nome, social_name, email, role, blood_type, dob, sex, cpf, phone, address, weight, height, role_change_pin, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
         ON CONFLICT (id) DO UPDATE SET
           nome = EXCLUDED.nome,
           social_name = EXCLUDED.social_name,
           email = EXCLUDED.email,
           role = EXCLUDED.role,
           blood_type = EXCLUDED.blood_type,
           dob = EXCLUDED.dob,
           sex = EXCLUDED.sex,
           cpf = EXCLUDED.cpf,
           phone = EXCLUDED.phone,
           address = EXCLUDED.address,
           weight = EXCLUDED.weight,
           height = EXCLUDED.height,
           role_change_pin = EXCLUDED.role_change_pin,
           updated_at = NOW()`,
        [
          userId,
          user.nome || 'Paciente',
          user.social_name || null,
          user.email || null,
          user.role || 'independente',
          user.blood_type || 'O+',
          user.dob || null,
          user.sex || null,
          user.cpf || null,
          user.phone || null,
          user.address || null,
          user.weight || null,
          user.height || null,
          user.role_change_pin || '123456',
        ]
      );
    }

    for (const m of meds) {
      await client.query(
        `INSERT INTO medicamentos (id, user_id, nome, active_ingredient, dosagem, unidade, cor, quantidade, horarios, observacoes, ativo, status, treatment_type, start_date, end_date, treatment_days, manufacturer, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
         ON CONFLICT (id) DO UPDATE SET
           nome = EXCLUDED.nome,
           active_ingredient = EXCLUDED.active_ingredient,
           dosagem = EXCLUDED.dosagem,
           unidade = EXCLUDED.unidade,
           cor = EXCLUDED.cor,
           quantidade = EXCLUDED.quantidade,
           horarios = EXCLUDED.horarios,
           observacoes = EXCLUDED.observacoes,
           ativo = EXCLUDED.ativo,
           status = EXCLUDED.status,
           treatment_type = EXCLUDED.treatment_type,
           start_date = EXCLUDED.start_date,
           end_date = EXCLUDED.end_date,
           treatment_days = EXCLUDED.treatment_days,
           manufacturer = EXCLUDED.manufacturer,
           updated_at = NOW()`,
        [
          m.id,
          userId,
          m.nome,
          m.active_ingredient || m.activeIngredient || null,
          m.dosagem,
          m.unidade || 'comprimido',
          m.cor || '#3b82f6',
          Number(m.quantidade ?? 30),
          JSON.stringify(m.horarios || ['08:00']),
          m.observacoes || null,
          m.ativo !== false,
          m.status || 'ativo',
          m.treatment_type || m.treatmentType || 'continuous',
          m.start_date || m.startDate || null,
          m.end_date || m.endDate || null,
          m.treatment_days || m.treatmentDays || null,
          m.manufacturer || null,
        ]
      );
    }

    for (const h of history) {
      const doseDate = h.date || (h.created_at ? h.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
      await client.query(
        `INSERT INTO historico_doses (id, med_id, user_id, hora, dose_date, status, quantidade_usada, is_retroactive, correction_reason, confirmed_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           correction_reason = EXCLUDED.correction_reason`,
        [
          h.id,
          h.med_id || h.medId,
          userId,
          h.hora || '08:00',
          doseDate,
          h.status || 'confirmed',
          Number(h.quantidade_usada ?? h.quantidadeUsada ?? 1),
          Boolean(h.is_retroactive ?? h.isRetroactive),
          h.reason || h.correction_reason || h.correctionReason || null,
          h.confirmed_by || h.confirmedByName || user.nome || 'Paciente',
        ]
      );
    }

    for (const ev of events) {
      await client.query(
        `INSERT INTO health_events (id, user_id, type, title, description, date, time, doctor, location)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           date = EXCLUDED.date,
           time = EXCLUDED.time,
           doctor = EXCLUDED.doctor,
           location = EXCLUDED.location`,
        [
          ev.id,
          userId,
          ev.type || 'consulta',
          ev.title,
          ev.description || null,
          ev.date,
          ev.time || null,
          ev.doctor || null,
          ev.location || null,
        ]
      );
    }

    for (const n of notes) {
      await client.query(
        `INSERT INTO calendar_notes (id, user_id, date, content, mood)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content`,
        [n.id, userId, n.date, n.content, n.mood || null]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json(
      {
        ok: true,
        syncedAt: new Date().toISOString(),
        counts: {
          meds: meds.length,
          history: history.length,
          events: events.length,
          notes: notes.length,
        },
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    await client.query('ROLLBACK');
    return NextResponse.json(
      { ok: false, error: err.message || 'Falha ao sincronizar com o PostgreSQL Oracle' },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    client.release();
  }
}
