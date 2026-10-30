import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getPgPool, ensureOraclePostgresSchema } from '@/lib/oraclePostgres';
import { forwardToOracleBackend } from '@/lib/oracleProxy';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, apikey',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(str) {
  return typeof str === 'string' && UUID_REGEX.test(str.trim());
}

function toDeterministicUuid(rawId, prefix = 'medicare') {
  if (isValidUuid(rawId)) return rawId.trim().toLowerCase();
  const seed = `${prefix}:${String(rawId || crypto.randomUUID())}`;
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function parsePgDate(val) {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  if (!s) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  // DD/MM/YYYY
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const dd = br[1].padStart(2, '0');
    const mm = br[2].padStart(2, '0');
    const yyyy = br[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  // Just year YYYY
  if (/^\d{4}$/.test(s)) {
    return `${s}-01-01`;
  }
  return null;
}

function parsePgTime(val) {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    return `${m[1].padStart(2, '0')}:${m[2]}`;
  }
  return null;
}

function parsePgNumeric(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const cleaned = String(val)
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')
    .trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function normalizeTreatmentType(val) {
  const s = String(val || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (s === 'temporary' || s === 'temporario') return 'temporary';
  if (s === 'sos' || s === 'se necessario') return 'sos';
  return 'continuous';
}

function normalizeDoseStatus(val) {
  const s = String(val || '').toLowerCase().trim();
  if (s === 'confirmed' || s === 'tomada' || s === 'taken' || s === 'concluida') return 'confirmed';
  if (s === 'missed' || s === 'pulada' || s === 'perdida' || s === 'skipped') return 'missed';
  if (s === 'late' || s === 'atrasada') return 'late';
  if (s === 'pending' || s === 'pendente') return 'pending';
  return 'confirmed';
}

function normalizeEventType(val) {
  const s = String(val || '').toLowerCase().trim();
  if (['consulta', 'exame', 'procedimento', 'outro', 'estoque'].includes(s)) return s;
  return 'consulta';
}

function normalizeMovementType(val) {
  const s = String(val || '').toLowerCase().trim();
  if (['purchase', 'compra', 'reposition', 'reposicao', 'refill'].includes(s)) return 'purchase';
  if (['correction', 'correcao'].includes(s)) return 'correction';
  if (['return', 'devolucao'].includes(s)) return 'return';
  return 'adjustment';
}

async function resolveTargetUserId(client, requestedId, userObj = {}) {
  const email = (userObj.email || '').trim().toLowerCase();
  const nome = (userObj.nome || '').trim();

  // 1. Se o ID informado já existe em profiles ou app_users, usa-o diretamente
  if (isValidUuid(requestedId)) {
    const byId = await client.query('SELECT id FROM profiles WHERE id = $1 LIMIT 1', [requestedId.trim()]);
    if (byId.rowCount > 0) return byId.rows[0].id;
    const byAppUserId = await client
      .query('SELECT id FROM app_users WHERE id = $1 LIMIT 1', [requestedId.trim()])
      .catch(() => ({ rowCount: 0 }));
    if (byAppUserId.rowCount > 0) return byAppUserId.rows[0].id;
  }

  // 2. Procura por email em profiles ou app_users
  if (email) {
    const byEmail = await client.query('SELECT id FROM profiles WHERE lower(email) = $1 LIMIT 1', [email]);
    if (byEmail.rowCount > 0) return byEmail.rows[0].id;
    const byAppUserEmail = await client
      .query('SELECT id FROM app_users WHERE lower(email) = $1 LIMIT 1', [email])
      .catch(() => ({ rowCount: 0 }));
    if (byAppUserEmail.rowCount > 0) return byAppUserEmail.rows[0].id;
  }

  // Se um UUID válido ou um email explícito foi informado (novo usuário), NUNCA mesclar com outro perfil existente
  if (isValidUuid(requestedId) || email) {
    const newUuid = isValidUuid(requestedId)
      ? requestedId.trim()
      : toDeterministicUuid(email, 'medicare-user');
    const fallbackEmail = email || `${newUuid.slice(0, 8)}@medicare.local`;
    await client
      .query(
        `INSERT INTO app_users (id, email, password_hash, raw_user_meta_data)
         VALUES ($1, $2, 'local_sync_account', $3::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [newUuid, fallbackEmail, JSON.stringify({ nome: nome || 'Paciente', role: 'independente' })]
      )
      .catch(() => {});
    return newUuid;
  }

  // 3. Apenas quando não há ID nem email: procura por nome exato ou parcial em profiles
  if (nome && nome.toLowerCase() !== 'paciente') {
    const byName = await client.query(
      'SELECT id FROM profiles WHERE lower(nome) = lower($1) OR lower(nome) LIKE lower($2) ORDER BY updated_at DESC LIMIT 1',
      [nome, `${nome.split(' ')[0]}%`]
    );
    if (byName.rowCount > 0) return byName.rows[0].id;
  }

  // 4. Fallback legado somente para chamadas sem identificador
  const existingProfiles = await client.query('SELECT id FROM profiles ORDER BY updated_at DESC LIMIT 5');
  if (existingProfiles.rowCount > 0) {
    return existingProfiles.rows[0].id;
  }

  const newUuid = toDeterministicUuid(requestedId || 'pac-001', 'user');
  const fallbackEmail = `${newUuid.slice(0, 8)}@medicare.local`;
  await client
    .query(
      `INSERT INTO app_users (id, email, password_hash, raw_user_meta_data)
       VALUES ($1, $2, 'local_sync_account', $3::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [newUuid, fallbackEmail, JSON.stringify({ nome: nome || 'Paciente', role: 'independente' })]
    )
    .catch(() => {});
  return newUuid;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawUserId = searchParams.get('userId') || searchParams.get('patientId') || '';
  const rawEmail = searchParams.get('email') || '';

  const pool = getPgPool();
  if (!pool) {
    return forwardToOracleBackend(request, '/api/v1/sync');
  }

  const client = await pool.connect();
  try {
    await ensureOraclePostgresSchema(client);

    const allProfilesRes = await client.query(
      'SELECT id, nome, social_name, email, role, blood_type, dob, sex, cpf, phone, weight, height, updated_at FROM profiles ORDER BY updated_at DESC LIMIT 50'
    );

    const userId = await resolveTargetUserId(client, rawUserId, { email: rawEmail });

    const [profileRes, medsRes, histRes, eventsRes, notesRes, algRes, condRes, contRes, profRes, cgRes, stockRes] =
      await Promise.all([
        client.query('SELECT * FROM profiles WHERE id = $1 LIMIT 1', [userId]),
        client.query('SELECT * FROM medicamentos WHERE user_id = $1 ORDER BY created_at ASC', [userId]),
        client.query('SELECT * FROM historico_doses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500', [userId]),
        client.query(
          "SELECT * FROM health_events WHERE user_id = $1 AND COALESCE(type, '') <> 'estoque' AND COALESCE(title, '') NOT ILIKE 'Reposição:%' AND COALESCE(title, '') NOT ILIKE 'Ajuste:%' ORDER BY date ASC",
          [userId]
        ),
        client
          .query('SELECT * FROM notes WHERE user_id = $1 ORDER BY date DESC', [userId])
          .catch(() => client.query('SELECT * FROM calendar_notes WHERE user_id = $1 ORDER BY date DESC', [userId]))
          .catch(() => ({ rows: [] })),
        client.query('SELECT * FROM allergies WHERE user_id = $1', [userId]).catch(() => ({ rows: [] })),
        client.query('SELECT * FROM health_conditions WHERE user_id = $1', [userId]).catch(() => ({ rows: [] })),
        client
          .query('SELECT * FROM emergency_contacts WHERE user_id = $1 ORDER BY priority ASC', [userId])
          .catch(() => ({ rows: [] })),
        client.query('SELECT * FROM healthcare_professionals WHERE user_id = $1', [userId]).catch(() => ({ rows: [] })),
        client
          .query('SELECT * FROM caregiver_relationships WHERE patient_id = $1', [userId])
          .catch(() => ({ rows: [] })),
        client
          .query('SELECT * FROM stock_movements WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200', [userId])
          .catch(() => ({ rows: [] })),
      ]);

    return NextResponse.json(
      {
        ok: true,
        syncedAt: new Date().toISOString(),
        userId,
        all_profiles: allProfilesRes.rows,
        user: profileRes.rows[0] || null,
        profile: profileRes.rows[0] || null,
        meds: medsRes.rows,
        medicamentos: medsRes.rows,
        history: histRes.rows,
        historico_doses: histRes.rows,
        events: eventsRes.rows,
        health_events: eventsRes.rows,
        notes: notesRes.rows,
        calendar_notes: notesRes.rows,
        allergies: algRes.rows,
        conditions: condRes.rows,
        health_conditions: condRes.rows,
        contacts: contRes.rows,
        emergency_contacts: contRes.rows,
        professionals: profRes.rows,
        healthcare_professionals: profRes.rows,
        caregivers: cgRes.rows,
        caregiver_relationships: cgRes.rows,
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
    return forwardToOracleBackend(request, '/api/v1/sync');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400, headers: corsHeaders });
  }

  // Ação de exclusão total da conta via POST
  if (body.action === 'delete_account' || body.action === 'delete') {
    const user = body.user || body.profile || {};
    const delUserId = body.userId || user.id || body.patientId || '';
    const delEmail = body.email || user.email || '';
    return handleDeleteAccountInDb(pool, delUserId, delEmail);
  }

  const user = body.user || body.profile || {};
  const requestedUserId = user.id || body.userId || body.patientId || '';
  const meds = Array.isArray(body.meds) ? body.meds : Array.isArray(body.medicamentos) ? body.medicamentos : [];
  const history = Array.isArray(body.history)
    ? body.history
    : Array.isArray(body.historico_doses)
    ? body.historico_doses
    : [];
  const events = Array.isArray(body.events)
    ? body.events
    : Array.isArray(body.health_events)
    ? body.health_events
    : [];
  const rawNotes = body.notes || body.calendar_notes || [];
  const notes = Array.isArray(rawNotes)
    ? rawNotes
    : typeof rawNotes === 'object' && rawNotes !== null
    ? Object.entries(rawNotes).map(([dateKey, contentVal]) => ({
        id: `note-${dateKey}`,
        date: dateKey,
        content: typeof contentVal === 'string' ? contentVal : JSON.stringify(contentVal),
      }))
    : [];
  const allergies = Array.isArray(body.allergies) ? body.allergies : [];
  const conditions = Array.isArray(body.conditions)
    ? body.conditions
    : Array.isArray(body.health_conditions)
    ? body.health_conditions
    : [];
  const contacts = Array.isArray(body.contacts)
    ? body.contacts
    : Array.isArray(body.emergency_contacts)
    ? body.emergency_contacts
    : [];
  const professionals = Array.isArray(body.professionals)
    ? body.professionals
    : Array.isArray(body.healthcare_professionals)
    ? body.healthcare_professionals
    : [];
  const stockMovements = Array.isArray(body.stock_movements) ? body.stock_movements : [];

  const client = await pool.connect();
  try {
    await ensureOraclePostgresSchema(client);
    const userId = await resolveTargetUserId(client, requestedUserId, user);

    // Detecta o tipo da coluna horarios em medicamentos (text[] no schema standalone vs jsonb)
    const horariosColRes = await client.query(
      `SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medicamentos' AND column_name = 'horarios' LIMIT 1`
    );
    const isHorariosArray = horariosColRes.rows[0]?.data_type === 'ARRAY';

    await client.query('BEGIN');

    // 1. Atualiza ou insere o perfil do paciente preservando campos existentes caso não venham preenchidos
    const cleanRole = ['paciente', 'cuidador', 'independente', 'medico', 'enfermeiro', 'clinica', 'farmacia', 'admin_sistema'].includes(
      user.role || user.user_role
    )
      ? user.role || user.user_role
      : 'independente';

    await client.query(
      `INSERT INTO profiles (id, nome, social_name, email, role, blood_type, dob, sex, cpf, phone, address, weight, height, foto_url, role_change_pin, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
       ON CONFLICT (id) DO UPDATE SET
         nome = COALESCE(NULLIF(EXCLUDED.nome, ''), profiles.nome),
         social_name = COALESCE(EXCLUDED.social_name, profiles.social_name),
         email = COALESCE(EXCLUDED.email, profiles.email),
         role = COALESCE(EXCLUDED.role, profiles.role),
         blood_type = COALESCE(EXCLUDED.blood_type, profiles.blood_type),
         dob = COALESCE(EXCLUDED.dob, profiles.dob),
         sex = COALESCE(EXCLUDED.sex, profiles.sex),
         cpf = COALESCE(EXCLUDED.cpf, profiles.cpf),
         phone = COALESCE(EXCLUDED.phone, profiles.phone),
         address = COALESCE(EXCLUDED.address, profiles.address),
         weight = COALESCE(EXCLUDED.weight, profiles.weight),
         height = COALESCE(EXCLUDED.height, profiles.height),
         foto_url = COALESCE(EXCLUDED.foto_url, profiles.foto_url),
         role_change_pin = COALESCE(EXCLUDED.role_change_pin, profiles.role_change_pin),
         updated_at = NOW()`,
      [
        userId,
        user.nome || 'Paciente',
        user.social_name || user.apelido || null,
        user.email || null,
        cleanRole,
        user.blood_type || user.tipo_sanguineo || 'O+',
        parsePgDate(user.dob || user.data_nascimento),
        user.sex || user.sexo || null,
        user.cpf || null,
        user.phone || user.telefone || null,
        user.address || user.endereco || null,
        parsePgNumeric(user.weight ?? user.peso),
        parsePgNumeric(user.height ?? user.altura),
        user.foto_url || null,
        user.role_change_pin || '123456',
      ]
    );

    // Mapa de IDs de medicamentos (ex: "med-123" -> UUID determinístico) para manter integridade com historico_doses e stock_movements
    const medIdMap = new Map();

    for (const m of meds) {
      const rawMedId = m.id || `med-${m.nome || Date.now()}`;
      const medUuid = toDeterministicUuid(rawMedId, `med:${userId}`);
      medIdMap.set(rawMedId, medUuid);

      const horariosArr = Array.isArray(m.horarios)
        ? m.horarios.map((h) => String(h))
        : typeof m.horarios === 'string' && m.horarios.trim()
        ? [m.horarios.trim()]
        : ['08:00'];

      const activeIng = m.active_ingredient || m.activeIngredient || m.principio_ativo || null;
      const manuf = m.manufacturer || m.fabricante || null;
      const treatType = normalizeTreatmentType(m.treatment_type || m.treatmentType || m.tipo_uso);
      const medStatus = ['ativo', 'pausado', 'concluido', 'cancelado'].includes(m.status) ? m.status : 'ativo';

      await client.query(
        `INSERT INTO medicamentos (
           id, user_id, nome, principio_ativo, active_ingredient, fabricante, manufacturer,
           dosagem, unidade, cor, quantidade, horarios, observacoes, ativo, status,
           treatment_type, start_date, end_date, treatment_days, updated_at
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,${isHorariosArray ? '$12::text[]' : '$12::jsonb'},$13,$14,$15,$16,$17,$18,$19,NOW())
         ON CONFLICT (id) DO UPDATE SET
           nome = EXCLUDED.nome,
           principio_ativo = COALESCE(EXCLUDED.principio_ativo, medicamentos.principio_ativo),
           active_ingredient = COALESCE(EXCLUDED.active_ingredient, medicamentos.active_ingredient),
           fabricante = COALESCE(EXCLUDED.fabricante, medicamentos.fabricante),
           manufacturer = COALESCE(EXCLUDED.manufacturer, medicamentos.manufacturer),
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
           updated_at = NOW()`,
        [
          medUuid,
          userId,
          m.nome || 'Medicamento',
          activeIng,
          activeIng,
          manuf,
          manuf,
          m.dosagem || '1 dose',
          m.unidade || 'comprimido',
          m.cor || '#3b82f6',
          Math.max(0, Math.round(Number(m.quantidade ?? m.estoque_atual ?? 30) || 0)),
          isHorariosArray ? horariosArr : JSON.stringify(horariosArr),
          m.observacoes || m.instrucoes || null,
          m.ativo !== false,
          medStatus,
          treatType,
          parsePgDate(m.start_date || m.startDate || m.data_inicio),
          parsePgDate(m.end_date || m.endDate || m.data_fim),
          parsePgNumeric(m.treatment_days ?? m.treatmentDays ?? m.duracao_dias),
        ]
      );
    }

    for (const h of history) {
      const rawMedId = h.med_id || h.medId || '';
      const resolvedMedUuid = medIdMap.get(rawMedId) || (rawMedId ? toDeterministicUuid(rawMedId, `med:${userId}`) : null);
      if (!resolvedMedUuid) continue;

      // Verifica se o medicamento existe para não violar FK
      const medExists = await client.query('SELECT 1 FROM medicamentos WHERE id = $1 LIMIT 1', [resolvedMedUuid]);
      if (medExists.rowCount === 0) continue;

      const rawDoseDate =
        h.date ||
        h.data ||
        h.dose_date ||
        (h.created_at ? String(h.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10));
      const doseDate = parsePgDate(rawDoseDate) || new Date().toISOString().slice(0, 10);
      const hora = h.hora || h.horario || '08:00';
      const doseUuid = toDeterministicUuid(h.id || `${resolvedMedUuid}:${doseDate}:${hora}`, `dose:${userId}`);

      await client.query(
        `INSERT INTO historico_doses (id, med_id, user_id, hora, dose_date, status, quantidade_usada, is_retroactive, correction_reason, motivo, confirmed_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           correction_reason = COALESCE(EXCLUDED.correction_reason, historico_doses.correction_reason)`,
        [
          doseUuid,
          resolvedMedUuid,
          userId,
          hora,
          doseDate,
          normalizeDoseStatus(h.status),
          parsePgNumeric(h.quantidade_usada ?? h.quantidadeUsada ?? 1) || 1,
          Boolean(h.is_retroactive ?? h.isRetroactive),
          h.reason || h.correction_reason || h.correctionReason || h.motivo || null,
          h.motivo || h.reason || null,
          h.confirmed_by || h.confirmedByName || user.nome || 'Paciente',
        ]
      );
    }

    await client
      .query(
        `DELETE FROM health_events WHERE user_id = $1 AND (type = 'estoque' OR title ILIKE 'Reposição:%' OR title ILIKE 'Ajuste:%')`,
        [userId]
      )
      .catch(() => {});

    for (const ev of events) {
      const evType = normalizeEventType(ev.type || ev.tipo);
      const evTitle = String(ev.title || ev.titulo || 'Compromisso').trim();
      if (evType === 'estoque' || /^reposi[cç][aã]o:/i.test(evTitle) || /^ajuste:/i.test(evTitle)) {
        continue;
      }
      const evDate = parsePgDate(ev.date || ev.data) || new Date().toISOString().slice(0, 10);
      const evUuid = toDeterministicUuid(ev.id || `${evTitle}:${evDate}`, `event:${userId}`);
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
          evUuid,
          userId,
          evType,
          evTitle,
          ev.description || ev.observacoes || null,
          evDate,
          parsePgTime(ev.time || ev.hora),
          ev.doctor || ev.medico || null,
          ev.location || ev.local || null,
        ]
      );
    }

    for (const n of notes) {
      const content = n?.content || n?.description || n?.texto || n?.title || '';
      if (!content) continue;
      const noteDate = parsePgDate(n.date || n.data) || new Date().toISOString().slice(0, 10);
      const noteUuid = toDeterministicUuid(n.id || `note:${noteDate}:${content.slice(0, 20)}`, `note:${userId}`);

      await client
        .query(
          `INSERT INTO notes (id, user_id, title, description, date, time)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description`,
          [noteUuid, userId, content.slice(0, 120), content, noteDate, parsePgTime(n.time || n.hora)]
        )
        .catch(() => {});

      await client
        .query(
          `INSERT INTO calendar_notes (id, user_id, date, content, mood)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content`,
          [noteUuid, userId, noteDate, content, n.mood || null]
        )
        .catch(() => {});
    }

    for (const a of allergies) {
      const algName = a.name || a.nome || a.substancia || '';
      if (!algName) continue;
      const algUuid = toDeterministicUuid(a.id || algName, `alg:${userId}`);
      await client.query(
        `INSERT INTO allergies (id, user_id, name, reaction, severity)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, reaction = EXCLUDED.reaction, severity = EXCLUDED.severity`,
        [algUuid, userId, algName, a.reaction || a.reacao || null, a.severity || a.gravidade || 'Moderada']
      );
    }

    for (const c of conditions) {
      const condName = c.name || c.nome || '';
      if (!condName) continue;
      const condUuid = toDeterministicUuid(c.id || condName, `cond:${userId}`);
      await client.query(
        `INSERT INTO health_conditions (id, user_id, name, notes, diagnosed_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, notes = EXCLUDED.notes, diagnosed_at = EXCLUDED.diagnosed_at`,
        [
          condUuid,
          userId,
          condName,
          c.notes || c.observacoes || null,
          parsePgDate(c.diagnosed_at || c.ano || c.desde),
        ]
      );
    }

    for (const ct of contacts) {
      const ctName = ct.name || ct.nome || '';
      if (!ctName) continue;
      const ctUuid = toDeterministicUuid(ct.id || `${ctName}:${ct.phone || ct.telefone}`, `ct:${userId}`);
      const rel = ct.relationship || ct.relation || ct.relacao || 'Familiar';
      await client.query(
        `INSERT INTO emergency_contacts (id, user_id, name, relationship, relation, phone, priority)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, relationship = EXCLUDED.relationship, relation = EXCLUDED.relation, phone = EXCLUDED.phone`,
        [ctUuid, userId, ctName, rel, rel, ct.phone || ct.telefone || '', Number(ct.priority ?? 1) || 1]
      );
    }

    for (const pr of professionals) {
      const prName = pr.name || pr.nome || '';
      if (!prName) continue;
      const prUuid = toDeterministicUuid(pr.id || `${prName}:${pr.crm || ''}`, `pr:${userId}`);
      const clinicVal = pr.clinic || pr.location || pr.clinica || null;
      await client.query(
        `INSERT INTO healthcare_professionals (id, user_id, name, specialty, phone, crm, clinic, location)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, specialty = EXCLUDED.specialty, phone = EXCLUDED.phone, crm = EXCLUDED.crm, clinic = EXCLUDED.clinic, location = EXCLUDED.location`,
        [
          prUuid,
          userId,
          prName,
          pr.specialty || pr.especialidade || 'Clínico',
          pr.phone || pr.telefone || null,
          pr.crm || null,
          clinicVal,
          clinicVal,
        ]
      );
    }

    for (const sm of stockMovements) {
      const rawMedId = sm.medication_id || sm.med_id || '';
      const smMedName = sm.med_name || sm.med_nome || sm.nome || null;
      let resolvedMedUuid =
        medIdMap.get(rawMedId) || (rawMedId ? toDeterministicUuid(rawMedId, `med:${userId}`) : null);
      if (!resolvedMedUuid && smMedName) {
        const matchedMed = meds.find(
          (m) => String(m.nome || '').trim().toLowerCase() === String(smMedName).trim().toLowerCase()
        );
        if (matchedMed) {
          const mRawId = matchedMed.id || `med-${matchedMed.nome}`;
          resolvedMedUuid = medIdMap.get(mRawId) || toDeterministicUuid(mRawId, `med:${userId}`);
        }
      }
      if (!resolvedMedUuid) continue;
      const medExists = await client.query('SELECT 1 FROM medicamentos WHERE id = $1 LIMIT 1', [resolvedMedUuid]);
      if (medExists.rowCount === 0) continue;

      const smUuid = toDeterministicUuid(sm.id || `${resolvedMedUuid}:${sm.created_at || sm.data || Date.now()}`, `sm:${userId}`);
      const qBefore = parsePgNumeric(sm.quantity_before ?? sm.previous_quantity) ?? 0;
      const qChanged =
        parsePgNumeric(sm.quantity_changed ?? sm.quantity_delta ?? sm.quantity_change ?? sm.delta ?? sm.qtd) ?? 0;
      const qAfter = parsePgNumeric(sm.quantity_after ?? sm.new_quantity) ?? Math.max(0, qBefore + qChanged);

      await client.query(
        `INSERT INTO stock_movements (
           id, user_id, medication_id, med_name, movement_type,
           quantity_before, quantity_changed, quantity_delta, quantity_after,
           purchase_price, purchase_location, batch, expiration_date, notes
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO UPDATE SET
           med_name = COALESCE(EXCLUDED.med_name, stock_movements.med_name),
           movement_type = EXCLUDED.movement_type,
           quantity_before = EXCLUDED.quantity_before,
           quantity_changed = EXCLUDED.quantity_changed,
           quantity_delta = EXCLUDED.quantity_delta,
           quantity_after = EXCLUDED.quantity_after,
           purchase_price = COALESCE(EXCLUDED.purchase_price, stock_movements.purchase_price),
           purchase_location = COALESCE(EXCLUDED.purchase_location, stock_movements.purchase_location),
           notes = COALESCE(EXCLUDED.notes, stock_movements.notes)`,
        [
          smUuid,
          userId,
          resolvedMedUuid,
          smMedName,
          normalizeMovementType(sm.movement_type || sm.tipo),
          qBefore,
          qChanged,
          qChanged,
          qAfter,
          parsePgNumeric(sm.purchase_price ?? sm.price_paid ?? sm.preco),
          sm.purchase_location || sm.pharmacy || sm.local || null,
          sm.batch || sm.lote || null,
          parsePgDate(sm.expiration_date || sm.validade),
          sm.notes || sm.motivo || sm.description || sm.observacoes || null,
        ]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json(
      {
        ok: true,
        syncedAt: new Date().toISOString(),
        userId,
        counts: {
          meds: meds.length,
          history: history.length,
          events: events.length,
          notes: notes.length,
          allergies: allergies.length,
          conditions: conditions.length,
          contacts: contacts.length,
          professionals: professionals.length,
          stock_movements: stockMovements.length,
        },
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return NextResponse.json(
      { ok: false, error: err.message || 'Falha ao sincronizar com o PostgreSQL Oracle' },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    client.release();
  }
}

async function handleDeleteAccountInDb(pool, targetUserId, targetEmail) {
  if (!targetUserId && !targetEmail) {
    return NextResponse.json(
      { ok: false, error: 'Identificador de usuário ou e-mail não fornecido para exclusão.' },
      { status: 400, headers: corsHeaders }
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cleanEmail = (targetEmail || '').trim().toLowerCase();
    const idStr = targetUserId ? String(targetUserId).trim() : null;

    if (idStr) {
      await client.query('UPDATE historico_doses SET performed_by = NULL WHERE performed_by::text = $1', [idStr]).catch(() => {});
      await client.query('UPDATE caregiver_audit_log SET actor_id = NULL WHERE actor_id::text = $1', [idStr]).catch(() => {});
      await client.query('UPDATE audit_logs SET performed_by = NULL WHERE performed_by::text = $1', [idStr]).catch(() => {});
      await client.query('DELETE FROM cuidadores WHERE paciente_id::text = $1 OR cuidador_id::text = $1', [idStr]).catch(() => {});
      await client.query('DELETE FROM caregiver_relationships WHERE patient_id::text = $1 OR caregiver_id::text = $1', [idStr]).catch(() => {});
    }
    if (cleanEmail) {
      await client.query(
        `UPDATE historico_doses SET performed_by = NULL WHERE performed_by IN (SELECT id FROM app_users WHERE lower(email) = $1)`,
        [cleanEmail]
      ).catch(() => {});
      await client.query(
        `DELETE FROM cuidadores WHERE paciente_id IN (SELECT id FROM app_users WHERE lower(email) = $1) OR cuidador_id IN (SELECT id FROM app_users WHERE lower(email) = $1)`,
        [cleanEmail]
      ).catch(() => {});
      await client.query(
        `DELETE FROM caregiver_relationships WHERE patient_id IN (SELECT id FROM app_users WHERE lower(email) = $1) OR caregiver_id IN (SELECT id FROM app_users WHERE lower(email) = $1)`,
        [cleanEmail]
      ).catch(() => {});
    }

    const tables = [
      'auth_sessions',
      'password_reset_tokens',
      'stock_movements',
      'dose_observations',
      'historico_doses',
      'notification_logs',
      'push_subscriptions',
      'audit_logs',
      'health_events',
      'notes',
      'custom_medications',
      'medicamentos',
      'allergies',
      'health_conditions',
      'emergency_contacts',
      'healthcare_professionals',
      'documentos',
      'notificacoes',
    ];

    for (const table of tables) {
      const col = table === 'audit_logs' ? 'patient_id' : 'user_id';
      if (idStr) {
        await client.query(`DELETE FROM ${table} WHERE ${col}::text = $1`, [idStr]).catch(() => {});
      }
      if (cleanEmail) {
        await client.query(
          `DELETE FROM ${table} WHERE ${col} IN (SELECT id FROM app_users WHERE lower(email) = $1)`,
          [cleanEmail]
        ).catch(() => {});
      }
    }

    if (idStr) {
      await client.query('DELETE FROM profiles WHERE id::text = $1', [idStr]).catch(() => {});
      await client.query('DELETE FROM app_users WHERE id::text = $1', [idStr]).catch(() => {});
    }
    if (cleanEmail) {
      await client.query('DELETE FROM profiles WHERE lower(email) = $1', [cleanEmail]).catch(() => {});
      await client.query('DELETE FROM app_users WHERE lower(email) = $1', [cleanEmail]).catch(() => {});
    }

    await client.query('COMMIT');
    return NextResponse.json(
      { ok: true, message: 'Conta e todos os dados foram apagados permanentemente do PostgreSQL Oracle.' },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return NextResponse.json(
      { ok: false, error: err.message || 'Erro ao excluir dados no PostgreSQL Oracle' },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    client.release();
  }
}

export async function DELETE(request) {
  const pool = getPgPool();
  if (!pool) {
    return forwardToOracleBackend(request, '/api/v1/sync');
  }

  const { searchParams } = new URL(request.url);
  let body = {};
  try { body = await request.json(); } catch (_) {}

  const targetUserId = searchParams.get('userId') || searchParams.get('patientId') || searchParams.get('id') || body.userId || body.user_id || body.id;
  const targetEmail = searchParams.get('email') || body.email;

  return handleDeleteAccountInDb(pool, targetUserId, targetEmail);
}
