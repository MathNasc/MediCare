import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getPgPool, ensureOraclePostgresSchema } from '@/lib/oraclePostgres';
import {
  checkRateLimit,
  extractAuthenticatedUser,
  hashOpaqueToken,
  issueSessionTokens,
} from '@/lib/oracleAuth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-api-key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req, { params }) {
  const action = (await params).action?.[0] || '';
  if (action === 'user') {
    const claims = extractAuthenticatedUser(req);
    if (!claims) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers: corsHeaders });
    }
    return NextResponse.json(
      {
        id: claims.sub,
        email: claims.email,
        role: claims.role,
        user_metadata: claims.user_metadata || {},
      },
      { status: 200, headers: corsHeaders }
    );
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
    return NextResponse.json(
      { error: 'PostgreSQL Oracle ainda não configurado no servidor.' },
      { status: 503, headers: corsHeaders }
    );
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
      // Usa pgcrypto crypt(..., gen_salt('bf', 10)) compatível com bcrypt ($2a$/$2b$)
      const insertUser = await client.query(
        `INSERT INTO app_users (id, email, password_hash, raw_user_meta_data)
         VALUES ($1, $2, crypt($3, gen_salt('bf', 10)), $4::jsonb)
         RETURNING id, email, raw_user_meta_data, created_at`,
        [userId, email, password, JSON.stringify(meta)]
      );

      await client.query(
        `INSERT INTO profiles (id, nome, email, role)
         VALUES ($1, $2, $3, $4)
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

      return NextResponse.json(sessionData, { status: 200, headers: corsHeaders });
    }

    // 2. LOGIN E REFRESH TOKEN (POST /api/auth/v1/token?grant_type=password|refresh_token)
    if (action === 'token') {
      const { searchParams } = new URL(req.url);
      const grantType = searchParams.get('grant_type') || 'password';
      const body = await req.json();

      if (grantType === 'refresh_token') {
        const refreshToken = body.refresh_token || '';
        const tokenHash = hashOpaqueToken(refreshToken);

        const sessRes = await client.query(
          `SELECT s.id AS session_id, u.id, u.email, u.raw_user_meta_data, u.created_at, p.nome, p.role
           FROM auth_sessions s
           JOIN app_users u ON u.id = s.user_id
           LEFT JOIN profiles p ON p.id = u.id
           WHERE s.refresh_token_hash = $1
             AND s.revoked_at IS NULL
             AND s.expires_at > NOW()
           LIMIT 1`,
          [tokenHash]
        );

        if (sessRes.rowCount === 0) {
          return NextResponse.json(
            { error: 'Sessão expirada ou inválida.' },
            { status: 401, headers: corsHeaders }
          );
        }

        await client.query('BEGIN');
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
        return NextResponse.json(newSession, { status: 200, headers: corsHeaders });
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

      return NextResponse.json(sessionData, { status: 200, headers: corsHeaders });
    }

    // 3. LOGOUT (POST /api/auth/v1/logout)
    if (action === 'logout') {
      const claims = extractAuthenticatedUser(req);
      if (claims?.sub) {
        await client.query(
          'UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
          [claims.sub]
        );
      }
      return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders });
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

export async function PUT(req, { params }) {
  const action = (await params).action?.[0] || '';
  if (action !== 'user') {
    return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404, headers: corsHeaders });
  }

  const claims = extractAuthenticatedUser(req);
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

