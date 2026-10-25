import crypto from 'crypto';
import { getPgPool, ensureOraclePostgresSchema } from './oraclePostgres';

const JWT_SECRET = process.env.JWT_SECRET || process.env.BACKEND_API_KEY || 'medicare-oracle-standalone-jwt-secret-change-in-prod';
const ACCESS_TOKEN_TTL_SEC = 3600; // 1 hora
const REFRESH_TOKEN_TTL_DAYS = 30; // 30 dias

// Rate limiter em memória por IP/email para proteção de endpoints de autenticação
const rateLimitMap = new Map();

export function checkRateLimit(key, maxRequests = 15, windowMs = 60_000) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf8');
}

export function signJwt(payload, expiresInSec = ACCESS_TOKEN_TTL_SEC) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = {
    ...payload,
    iat: now,
    exp: now + expiresInSec,
    iss: 'medicare-oracle-auth',
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(body))}`;
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(unsigned)
    .digest();
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

export function verifyJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, b, sig] = parts;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest()
  );
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }
  try {
    const payload = JSON.parse(base64UrlDecode(b));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashOpaqueToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

export function extractAuthenticatedUser(req) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return verifyJwt(token);
}

/**
 * Executa uma operação autenticada no PostgreSQL Oracle definindo
 * `SET LOCAL app.current_user_id = '<uuid>'` dentro da transação
 * para que todas as funções SQL e políticas de autorização respeitem o usuário autenticado.
 */
export async function withAuthenticatedPg(req, handler) {
  const userClaims = extractAuthenticatedUser(req);
  if (!userClaims?.sub) {
    return { unauthorized: true, error: 'Token de autenticação ausente ou inválido.' };
  }

  const pool = getPgPool();
  if (!pool) {
    return { unconfigured: true, error: 'Banco PostgreSQL Oracle ainda não configurado.' };
  }

  const client = await pool.connect();
  try {
    await ensureOraclePostgresSchema(client);
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userClaims.sub]);
    const result = await handler(client, userClaims);
    await client.query('COMMIT');
    return { ok: true, data: result, user: userClaims };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Verifica se o usuário autenticado (`actorId`) pode acessar ou modificar dados do `targetPatientId`.
 * Substitui as policies RLS do Supabase com validação explícita no backend e no PostgreSQL.
 */
export async function canAccessPatientData(client, actorId, targetPatientId, requiredLevel = 'viewer') {
  if (!actorId || !targetPatientId) return false;
  if (String(actorId) === String(targetPatientId)) return true;

  const allowedLevels =
    requiredLevel === 'admin'
      ? ['admin']
      : requiredLevel === 'caregiver'
      ? ['caregiver', 'admin']
      : ['viewer', 'caregiver', 'admin'];

  const res = await client.query(
    `SELECT 1 FROM caregiver_relationships
     WHERE patient_id = $1
       AND caregiver_id = $2
       AND status = 'active'
       AND permission_level = ANY($3::text[])
     LIMIT 1`,
    [String(targetPatientId), String(actorId), allowedLevels]
  );
  return res.rowCount > 0;
}

export async function issueSessionTokens(client, userRow, userAgent = '', ipAddress = '') {
  const accessToken = signJwt({
    sub: String(userRow.id),
    email: userRow.email,
    role: userRow.role || 'independente',
    user_metadata: userRow.raw_user_meta_data || { nome: userRow.nome },
  });

  const rawRefreshToken = crypto.randomBytes(32).toString('hex');
  const refreshHash = hashOpaqueToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86400 * 1000).toISOString();

  await client.query(
    `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [crypto.randomUUID(), String(userRow.id), refreshHash, userAgent, ipAddress, expiresAt]
  );

  return {
    access_token: accessToken,
    refresh_token: rawRefreshToken,
    token_type: 'bearer',
    expires_in: ACCESS_TOKEN_TTL_SEC,
    user: {
      id: String(userRow.id),
      email: userRow.email,
      user_metadata: userRow.raw_user_meta_data || { nome: userRow.nome || '' },
      created_at: userRow.created_at,
    },
  };
}
