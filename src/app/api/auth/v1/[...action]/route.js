import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getPgPool, ensureOraclePostgresSchema } from '@/lib/oraclePostgres';
import { forwardToOracleBackend } from '@/lib/oracleProxy';
import {
  CSRF_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_SEC,
  attachAuthCookies,
  checkRateLimit,
  clearAuthCookies,
  extractAuthenticatedUser,
  hashOpaqueToken,
  isSecureRequest,
  issueSessionTokens,
  parseRequestCookies,
  serializeCookie,
  verifyActiveSessionInDb,
} from '@/lib/oracleAuth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, apikey, x-api-key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req, { params }) {
  const action = (await params).action?.[0] || '';
  const pool = getPgPool();
  if (!pool) {
    return forwardToOracleBackend(req, `/api/auth/v1/${action}`);
  }

  if (action === 'user') {
    const claims = extractAuthenticatedUser(req, { enforceCsrf: false });
    if (!claims?.sub) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers: corsHeaders });
    }

    const client = await pool.connect();
    try {
      await ensureOraclePostgresSchema(client);
      const isActiveSession = await verifyActiveSessionInDb(client, claims);
      if (!isActiveSession) {
        const res = NextResponse.json(
          { error: 'Sessão revogada ou expirada.' },
          { status: 401, headers: corsHeaders }
        );
        return clearAuthCookies(res, req);
      }

      const uRes = await client.query(
        `SELECT u.id, u.email, u.raw_user_meta_data, u.is_active, p.nome, p.role
         FROM app_users u
         LEFT JOIN profiles p ON p.id::text = u.id::text
         WHERE u.id::text = $1::text
         LIMIT 1`,
        [String(claims.sub)]
      );

      if (uRes.rowCount === 0 || uRes.rows[0].is_active === false) {
        const res = NextResponse.json(
          { error: 'Conta de usuário inativa ou inexistente.' },
          { status: 401, headers: corsHeaders }
        );
        return clearAuthCookies(res, req);
      }

      const row = uRes.rows[0];
      const cookies = parseRequestCookies(req);
      const csrfToken = cookies[CSRF_COOKIE_NAME] || claims.csrf || crypto.randomBytes(24).toString('hex');

      const response = NextResponse.json(
        {
          id: String(row.id),
          email: row.email,
          role: row.role || claims.role || 'independente',
          user_metadata: {
            ...(row.raw_user_meta_data || {}),
            nome: row.nome || row.raw_user_meta_data?.nome || '',
            role: row.role || claims.role || 'independente',
          },
          csrf_token: csrfToken,
        },
        { status: 200, headers: corsHeaders }
      );

      if (!cookies[CSRF_COOKIE_NAME]) {
        response.headers.append(
          'Set-Cookie',
          serializeCookie(CSRF_COOKIE_NAME, csrfToken, {
            httpOnly: false,
            secure: isSecureRequest(req),
            sameSite: 'Lax',
            path: '/',
            maxAge: REFRESH_TOKEN_TTL_SEC,
          })
        );
      }

      return response;
    } finally {
      client.release();
    }
  }
  return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404, headers: corsHeaders });
}

export async function POST(req, { params }) {
  const action = (await params).action?.[0] || '';
  const ip = req.headers.get('x-forwarded-for') || 'local';

  if (!checkRateLimit(`auth:${ip}:${action}`, 20, 60_000)) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde 1 minuto e tente novamente.' },
      { status: 429, headers: corsHeaders }
    );
  }

  const pool = getPgPool();
  if (!pool) {
    return forwardToOracleBackend(req, `/api/auth/v1/${action}`);
  }

  const client = await pool.connect();
  try {
    await ensureOraclePostgresSchema(client);

    // 1. CADASTRO (POST /api/auth/v1/signup)
    if (action === 'signup') {
      const body = await req.json();
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';
      const nome = body.data?.nome || body.options?.data?.nome || email.split('@')[0];
      const role = body.data?.role || body.options?.data?.role || 'independente';

      if (!email || password.length < 6) {
        return NextResponse.json(
          { error: 'Informe um e-mail válido e senha com no mínimo 6 caracteres.' },
          { status: 400, headers: corsHeaders }
        );
      }

      const existing = await client.query('SELECT id FROM app_users WHERE lower(email) = $1 LIMIT 1', [email]);
      if (existing.rowCount > 0) {
        return NextResponse.json(
          { error: 'Este e-mail já está cadastrado.' },
          { status: 409, headers: corsHeaders }
        );
      }

      const userId = crypto.randomUUID();
      const meta = { nome, role };

      await client.query('BEGIN');
      const insertUser = await client.query(
        `INSERT INTO app_users (id, email, password_hash, raw_user_meta_data)
         VALUES ($1, $2, crypt($3, gen_salt('bf', 10)), $4::jsonb)
         RETURNING id, email, raw_user_meta_data, created_at`,
        [userId, email, password, JSON.stringify(meta)]
      );

      await client.query(
        `INSERT INTO profiles (id, nome, email, role, blood_type)
         VALUES ($1, $2, $3, $4, NULL)
         ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, email = EXCLUDED.email`,
        [userId, nome, email, role]
      );

      const sessionData = await issueSessionTokens(
        client,
        { ...insertUser.rows[0], nome, role },
        req.headers.get('user-agent') || '',
        ip
      );
      await client.query('COMMIT');

      const response = NextResponse.json(sessionData, { status: 200, headers: corsHeaders });
      return attachAuthCookies(response, sessionData, req);
    }

    // 2. LOGIN E REFRESH TOKEN (POST /api/auth/v1/token?grant_type=password|refresh_token)
    if (action === 'token') {
      const { searchParams } = new URL(req.url);
      const grantType = searchParams.get('grant_type') || 'password';
      const body = await req.json().catch(() => ({}));

      if (grantType === 'refresh_token') {
        const cookies = parseRequestCookies(req);
        const refreshToken = body.refresh_token || cookies[REFRESH_COOKIE_NAME] || '';
        if (!refreshToken) {
          const res = NextResponse.json(
            { error: 'Refresh token ausente.' },
            { status: 401, headers: corsHeaders }
          );
          return clearAuthCookies(res, req);
        }

        const tokenHash = hashOpaqueToken(refreshToken);

        const sessRes = await client.query(
          `SELECT s.id AS session_id, u.id, u.email, u.raw_user_meta_data, u.created_at, p.nome, p.role
           FROM auth_sessions s
           JOIN app_users u ON u.id = s.user_id
           LEFT JOIN profiles p ON p.id = u.id
           WHERE s.refresh_token_hash = $1
             AND s.revoked_at IS NULL
             AND s.expires_at > NOW()
             AND u.is_active = TRUE
           LIMIT 1`,
          [tokenHash]
        );

        if (sessRes.rowCount === 0) {
          const res = NextResponse.json(
            { error: 'Sessão expirada ou inválida.' },
            { status: 401, headers: corsHeaders }
          );
          return clearAuthCookies(res, req);
        }

        await client.query('BEGIN');
        // Revoga apenas a sessão rotacionada atual (isolamento de sessão por dispositivo)
        await client.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1', [
          sessRes.rows[0].session_id,
        ]);
        const newSession = await issueSessionTokens(
          client,
          sessRes.rows[0],
          req.headers.get('user-agent') || '',
          ip
        );
        await client.query('COMMIT');

        const response = NextResponse.json(newSession, { status: 200, headers: corsHeaders });
        return attachAuthCookies(response, newSession, req);
      }

      // grant_type=password (compatível com hashes bcrypt)
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';

      const userRes = await client.query(
        `SELECT u.id, u.email, u.raw_user_meta_data, u.created_at, p.nome, p.role
         FROM app_users u
         LEFT JOIN profiles p ON p.id = u.id
         WHERE lower(u.email) = $1
           AND u.is_active = TRUE
           AND u.password_hash = crypt($2, u.password_hash)
         LIMIT 1`,
        [email, password]
      );

      if (userRes.rowCount === 0) {
        return NextResponse.json(
          { error: 'E-mail ou senha incorretos.' },
          { status: 401, headers: corsHeaders }
        );
      }

      await client.query('BEGIN');
      await client.query('UPDATE app_users SET last_sign_in_at = NOW() WHERE id = $1', [
        userRes.rows[0].id,
      ]);
      const sessionData = await issueSessionTokens(
        client,
        userRes.rows[0],
        req.headers.get('user-agent') || '',
        ip
      );
      await client.query('COMMIT');

      const response = NextResponse.json(sessionData, { status: 200, headers: corsHeaders });
      return attachAuthCookies(response, sessionData, req);
    }

    // 3. LOGOUT COM ISOLAMENTO DE SESSÃO (POST /api/auth/v1/logout)
    if (action === 'logout') {
      const claims = extractAuthenticatedUser(req, { enforceCsrf: false });
      const cookies = parseRequestCookies(req);
      const body = await req.json().catch(() => ({}));
      const rawRefresh = body.refresh_token || cookies[REFRESH_COOKIE_NAME] || '';
      const revokeAll = body.all_sessions === true;

      if (revokeAll && claims?.sub) {
        await client.query(
          'UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id::text = $1::text AND revoked_at IS NULL',
          [String(claims.sub)]
        );
      } else if (claims?.sid) {
        await client.query(
          'UPDATE auth_sessions SET revoked_at = NOW() WHERE id::text = $1::text AND revoked_at IS NULL',
          [String(claims.sid)]
        );
      } else if (rawRefresh) {
        const refreshHash = hashOpaqueToken(rawRefresh);
        await client.query(
          'UPDATE auth_sessions SET revoked_at = NOW() WHERE refresh_token_hash = $1 AND revoked_at IS NULL',
          [refreshHash]
        );
      } else if (claims?.sub) {
        await client.query(
          'UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id::text = $1::text AND revoked_at IS NULL',
          [String(claims.sub)]
        );
      }

      const response = NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders });
      return clearAuthCookies(response, req);
    }

    // 4. RECUPERAÇÃO DE SENHA (POST /api/auth/v1/recover)
    if (action === 'recover') {
      const body = await req.json();
      const email = (body.email || '').trim().toLowerCase();
      if (email) {
        const uRes = await client.query('SELECT id FROM app_users WHERE lower(email) = $1 LIMIT 1', [email]);
        if (uRes.rowCount > 0) {
          const rawResetToken = crypto.randomBytes(24).toString('hex');
          const resetHash = hashOpaqueToken(rawResetToken);
          await client.query(
            `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
             VALUES ($1, $2, $3, NOW() + INTERVAL '2 hours')`,
            [crypto.randomUUID(), uRes.rows[0].id, resetHash]
          );
        }
      }
      // Sempre retorna 200 para evitar enumeração de e-mails
      return NextResponse.json(
        { ok: true, message: 'Se o e-mail existir, as instruções de recuperação foram registradas.' },
        { status: 200, headers: corsHeaders }
      );
    }

    // 5. EXCLUIR CONTA DEFINITIVAMENTE (POST /api/auth/v1/delete-account)
    if (action === 'delete-account' || action === 'delete') {
      const claims = extractAuthenticatedUser(req, { returnCsrfError: true });
      if (claims?.csrfError) {
        return NextResponse.json({ error: claims.reason }, { status: 403, headers: corsHeaders });
      }
      if (!claims?.sub) {
        return NextResponse.json(
          { error: 'Autenticação necessária para excluir a conta.' },
          { status: 401, headers: corsHeaders }
        );
      }

      let body = {};
      try {
        body = await req.json();
      } catch (_) {}

      const requestedId = body.userId || body.user_id || body.id;
      if (requestedId && String(requestedId) !== String(claims.sub)) {
        return NextResponse.json(
          { error: 'Acesso negado: você só pode excluir a própria conta.' },
          { status: 403, headers: corsHeaders }
        );
      }

      await client.query('BEGIN');
      await executeDeleteUserRecords(client, claims.sub, claims.email);
      await client.query('COMMIT');

      const response = NextResponse.json(
        { ok: true, message: 'Conta e todos os registros foram excluídos permanentemente do banco de dados.' },
        { status: 200, headers: corsHeaders }
      );
      return clearAuthCookies(response, req);
    }

    return NextResponse.json({ error: 'Ação de autenticação desconhecida.' }, { status: 404, headers: corsHeaders });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return NextResponse.json(
      { error: err.message || 'Erro interno na autenticação.' },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    client.release();
  }
}

async function executeDeleteUserRecords(client, targetId, targetEmail) {
  const cleanEmail = (targetEmail || '').trim().toLowerCase();
  const idStr = targetId ? String(targetId).trim() : null;

  const foundUserIds = new Set();
  const foundEmails = new Set();

  if (idStr) {
    foundUserIds.add(idStr);
    const uById = await client
      .query('SELECT id, email FROM app_users WHERE id::text = $1', [idStr])
      .catch(() => ({ rows: [] }));
    uById.rows.forEach((r) => {
      if (r.id) foundUserIds.add(String(r.id));
      if (r.email) foundEmails.add(String(r.email).trim().toLowerCase());
    });
    const pById = await client
      .query('SELECT id, email FROM profiles WHERE id::text = $1', [idStr])
      .catch(() => ({ rows: [] }));
    pById.rows.forEach((r) => {
      if (r.id) foundUserIds.add(String(r.id));
      if (r.email) foundEmails.add(String(r.email).trim().toLowerCase());
    });
  }

  if (cleanEmail) {
    foundEmails.add(cleanEmail);
    const uByEmail = await client
      .query('SELECT id, email FROM app_users WHERE lower(email) = $1', [cleanEmail])
      .catch(() => ({ rows: [] }));
    uByEmail.rows.forEach((r) => {
      if (r.id) foundUserIds.add(String(r.id));
      if (r.email) foundEmails.add(String(r.email).trim().toLowerCase());
    });
    const pByEmail = await client
      .query('SELECT id, email FROM profiles WHERE lower(email) = $1', [cleanEmail])
      .catch(() => ({ rows: [] }));
    pByEmail.rows.forEach((r) => {
      if (r.id) foundUserIds.add(String(r.id));
      if (r.email) foundEmails.add(String(r.email).trim().toLowerCase());
    });
  }

  const userIdsArray = Array.from(foundUserIds);
  const emailsArray = Array.from(foundEmails);

  if (userIdsArray.length === 0 && emailsArray.length === 0) {
    return;
  }

  // 1. Desvincular chaves estrangeiras de agente / autor
  await client
    .query(
      `UPDATE historico_doses SET performed_by = NULL
       WHERE performed_by::text = ANY($1::text[])
          OR performed_by IN (SELECT id FROM app_users WHERE lower(email) = ANY($2::text[]))`,
      [userIdsArray, emailsArray]
    )
    .catch(() => {});

  await client
    .query(
      `UPDATE caregiver_audit_log SET actor_id = NULL
       WHERE actor_id::text = ANY($1::text[])
          OR actor_id IN (SELECT id FROM app_users WHERE lower(email) = ANY($2::text[]))`,
      [userIdsArray, emailsArray]
    )
    .catch(() => {});

  await client
    .query(
      `UPDATE audit_logs SET performed_by = NULL
       WHERE performed_by::text = ANY($1::text[])
          OR performed_by IN (SELECT id FROM app_users WHERE lower(email) = ANY($2::text[]))`,
      [userIdsArray, emailsArray]
    )
    .catch(() => {});

  // 2. Apagar logs e notas de cuidadores associados
  await client
    .query(
      `DELETE FROM caregiver_audit_log
       WHERE relationship_id IN (
         SELECT id FROM caregiver_relationships
         WHERE patient_id::text = ANY($1::text[])
            OR caregiver_id::text = ANY($1::text[])
            OR lower(invite_email) = ANY($2::text[])
       )`,
      [userIdsArray, emailsArray]
    )
    .catch(() => {});

  await client
    .query(
      `DELETE FROM caregiver_notes
       WHERE patient_id::text = ANY($1::text[])
          OR caregiver_id::text = ANY($1::text[])
          OR relationship_id IN (
            SELECT id FROM caregiver_relationships
            WHERE patient_id::text = ANY($1::text[])
               OR caregiver_id::text = ANY($1::text[])
               OR lower(invite_email) = ANY($2::text[])
          )`,
      [userIdsArray, emailsArray]
    )
    .catch(() => {});

  // 3. Apagar relacionamentos de cuidadores
  await client
    .query(
      `DELETE FROM caregiver_relationships
       WHERE patient_id::text = ANY($1::text[])
          OR caregiver_id::text = ANY($1::text[])
          OR lower(invite_email) = ANY($2::text[])`,
      [userIdsArray, emailsArray]
    )
    .catch(() => {});

  await client
    .query(
      `DELETE FROM cuidadores
       WHERE paciente_id::text = ANY($1::text[])
          OR cuidador_id::text = ANY($1::text[])`,
      [userIdsArray]
    )
    .catch(() => {});

  // 4. Apagar registros das tabelas dependentes
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
    'calendar_notes',
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
    await client
      .query(
        `DELETE FROM ${table}
         WHERE ${col}::text = ANY($1::text[])
            OR ${col} IN (SELECT id FROM app_users WHERE lower(email) = ANY($2::text[]))`,
        [userIdsArray, emailsArray]
      )
      .catch(() => {});
  }

  // 5. Apagar do perfil e usuários
  await client
    .query(
      `DELETE FROM profiles
       WHERE id::text = ANY($1::text[])
          OR lower(email) = ANY($2::text[])`,
      [userIdsArray, emailsArray]
    )
    .catch(() => {});

  await client.query(
    `DELETE FROM app_users
     WHERE id::text = ANY($1::text[])
        OR lower(email) = ANY($2::text[])`,
    [userIdsArray, emailsArray]
  );
}

export async function DELETE(req, { params }) {
  const action = (await params).action?.[0] || '';
  const pool = getPgPool();
  if (!pool) {
    return forwardToOracleBackend(req, `/api/auth/v1/${action}`);
  }

  const claims = extractAuthenticatedUser(req, { returnCsrfError: true });
  if (claims?.csrfError) {
    return NextResponse.json({ error: claims.reason }, { status: 403, headers: corsHeaders });
  }
  if (!claims?.sub) {
    return NextResponse.json(
      { error: 'Autenticação necessária para exclusão de conta.' },
      { status: 401, headers: corsHeaders }
    );
  }

  const { searchParams } = new URL(req.url);
  let body = {};
  try {
    body = await req.json();
  } catch (_) {}

  const requestedId = searchParams.get('userId') || searchParams.get('id') || body.userId || body.id;
  if (requestedId && String(requestedId) !== String(claims.sub)) {
    return NextResponse.json(
      { error: 'Acesso negado: você só pode excluir a própria conta.' },
      { status: 403, headers: corsHeaders }
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await executeDeleteUserRecords(client, claims.sub, claims.email);
    await client.query('COMMIT');
    const response = NextResponse.json(
      { ok: true, message: 'Conta e todos os registros foram excluídos permanentemente do banco de dados.' },
      { status: 200, headers: corsHeaders }
    );
    return clearAuthCookies(response, req);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return NextResponse.json(
      { error: err.message || 'Erro ao excluir conta do banco de dados.' },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    client.release();
  }
}

export async function PUT(req, { params }) {
  const action = (await params).action?.[0] || '';
  if (action !== 'user') {
    return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404, headers: corsHeaders });
  }

  const claims = extractAuthenticatedUser(req, { returnCsrfError: true });
  if (claims?.csrfError) {
    return NextResponse.json({ error: claims.reason }, { status: 403, headers: corsHeaders });
  }
  if (!claims?.sub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers: corsHeaders });
  }

  const pool = getPgPool();
  if (!pool) {
    return NextResponse.json(
      { error: 'PostgreSQL Oracle ainda não configurado no servidor.' },
      { status: 503, headers: corsHeaders }
    );
  }

  const client = await pool.connect();
  try {
    await ensureOraclePostgresSchema(client);
    const body = await req.json();
    const userData = body.data || {};

    await client.query('BEGIN');

    if (body.password && String(body.password).length >= 6) {
      await client.query(
        `UPDATE app_users
         SET password_hash = crypt($1, gen_salt('bf', 10)),
             updated_at = NOW()
         WHERE id::text = $2::text`,
        [String(body.password), String(claims.sub)]
      );
    }

    if (Object.keys(userData).length > 0) {
      await client.query(
        `UPDATE app_users
         SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || $1::jsonb,
             updated_at = NOW()
         WHERE id::text = $2::text`,
        [JSON.stringify(userData), String(claims.sub)]
      );
      if (userData.role) {
        await client.query(`UPDATE profiles SET role = $1, updated_at = NOW() WHERE id::text = $2::text`, [
          userData.role,
          String(claims.sub),
        ]);
      }
      if (userData.nome) {
        await client.query(`UPDATE profiles SET nome = $1, updated_at = NOW() WHERE id::text = $2::text`, [
          userData.nome,
          String(claims.sub),
        ]);
      }
    }

    const updatedRes = await client.query(
      `SELECT u.id, u.email, u.raw_user_meta_data, u.created_at, p.role
       FROM app_users u
       LEFT JOIN profiles p ON p.id::text = u.id::text
       WHERE u.id::text = $1::text
       LIMIT 1`,
      [String(claims.sub)]
    );

    await client.query('COMMIT');
    const row = updatedRes.rows[0] || { id: claims.sub, email: claims.email, raw_user_meta_data: userData };
    return NextResponse.json(
      {
        id: row.id,
        email: row.email,
        role: row.role || userData.role || claims.role,
        user_metadata: row.raw_user_meta_data || {},
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return NextResponse.json(
      { error: err.message || 'Erro ao atualizar usuário.' },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    client.release();
  }
}
