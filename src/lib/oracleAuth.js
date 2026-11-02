import crypto from 'crypto';
import { getPgPool, ensureOraclePostgresSchema } from './oraclePostgres';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.BACKEND_API_KEY ||
  'medicare-oracle-standalone-jwt-secret-change-in-prod';

export const ACCESS_TOKEN_TTL_SEC = 3600; // 1 hora
export const REFRESH_TOKEN_TTL_DAYS = 30; // 30 dias
export const REFRESH_TOKEN_TTL_SEC = REFRESH_TOKEN_TTL_DAYS * 86400;

export const ACCESS_COOKIE_NAME = 'medicare_access_token';
export const REFRESH_COOKIE_NAME = 'medicare_refresh_token';
export const CSRF_COOKIE_NAME = 'medicare_csrf_token';
export const LOGGED_IN_COOKIE_NAME = 'medicare_cuidador_logged_in';

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
  let base64 = str.replace(/-/g, '+').replace(/\//g, '_').replace(/_/g, '/');
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
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(unsigned).digest();
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

export function parseRequestCookies(req) {
  const map = {};
  if (!req) return map;
  const rawCookie = req.headers?.get?.('cookie') || '';
  if (!rawCookie) return map;
  const pairs = rawCookie.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      try {
        map[key] = decodeURIComponent(val);
      } catch {
        map[key] = val;
      }
    }
  }
  return map;
}

export function isSecureRequest(req) {
  const proto = req?.headers?.get?.('x-forwarded-proto') || '';
  if (proto.toLowerCase().includes('https')) return true;
  if (typeof req?.url === 'string' && req.url.startsWith('https://')) return true;
  return false;
}

export function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value ?? '')}`];
  parts.push(`Path=${options.path || '/'}`);
  if (typeof options.maxAge === 'number') {
    parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }
  if (options.httpOnly) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  return parts.join('; ');
}

export function attachAuthCookies(response, sessionData, req) {
  if (!response || !sessionData) return response;
  const secure = isSecureRequest(req);
  const csrfToken = sessionData.csrf_token || crypto.randomBytes(24).toString('hex');

  const cookies = [
    serializeCookie(ACCESS_COOKIE_NAME, sessionData.access_token, {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: ACCESS_TOKEN_TTL_SEC,
    }),
    serializeCookie(REFRESH_COOKIE_NAME, sessionData.refresh_token, {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/api/auth',
      maxAge: REFRESH_TOKEN_TTL_SEC,
    }),
    serializeCookie(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: REFRESH_TOKEN_TTL_SEC,
    }),
    serializeCookie(LOGGED_IN_COOKIE_NAME, '1', {
      httpOnly: false,
      secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: REFRESH_TOKEN_TTL_SEC,
    }),
  ];

  for (const c of cookies) {
    response.headers.append('Set-Cookie', c);
  }
  return response;
}

export function clearAuthCookies(response, req) {
  if (!response) return response;
  const secure = isSecureRequest(req);
  const cookies = [
    serializeCookie(ACCESS_COOKIE_NAME, '', {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: 0,
    }),
    serializeCookie(REFRESH_COOKIE_NAME, '', {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/api/auth',
      maxAge: 0,
    }),
    serializeCookie(CSRF_COOKIE_NAME, '', {
      httpOnly: false,
      secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: 0,
    }),
    serializeCookie(LOGGED_IN_COOKIE_NAME, '', {
      httpOnly: false,
      secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: 0,
    }),
  ];
  for (const c of cookies) {
    response.headers.append('Set-Cookie', c);
  }
  return response;
}

function safeTokenCompare(a, b) {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

export function validateCsrfRequest(req, claims = null) {
  const method = String(req?.method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true };
  }

  // Validação de Origin/Referer se presentes
  const origin = req?.headers?.get?.('origin');
  const host = req?.headers?.get?.('x-forwarded-host') || req?.headers?.get?.('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return { valid: false, reason: 'Origem (Origin) da requisição não corresponde ao host.' };
      }
    } catch {
      return { valid: false, reason: 'Cabeçalho Origin malformado.' };
    }
  }

  const cookies = parseRequestCookies(req);
  const csrfCookie = cookies[CSRF_COOKIE_NAME] || '';
  const csrfHeader =
    req?.headers?.get?.('x-csrf-token') || req?.headers?.get?.('X-CSRF-Token') || '';

  if (!csrfHeader) {
    return { valid: false, reason: 'Cabeçalho X-CSRF-Token ausente em requisição autenticada por cookie.' };
  }

  if (csrfCookie && safeTokenCompare(csrfHeader, csrfCookie)) {
    return { valid: true };
  }
  if (claims?.csrf && safeTokenCompare(csrfHeader, claims.csrf)) {
    return { valid: true };
  }

  return { valid: false, reason: 'Token CSRF inválido.' };
}

/**
 * Extrai e valida o usuário autenticado suportando:
 * 1) Header Authorization: Bearer <jwt> (MediCare Paciente Android e clientes de API)
 * 2) Cookie HttpOnly medicare_access_token + validação CSRF para mutações (MediCare Cuidador Web)
 */
export function extractAuthenticatedUser(req, options = {}) {
  if (!req) return null;

  // 1. Fluxo Bearer (Android / API)
  const authHeader = req.headers?.get?.('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const claims = verifyJwt(token);
    if (!claims) return null;
    return { ...claims, authSource: 'bearer' };
  }

  // 2. Fluxo Cookie HttpOnly (Web Cuidador)
  const cookies = parseRequestCookies(req);
  const cookieToken = cookies[ACCESS_COOKIE_NAME];
  if (!cookieToken) return null;

  const claims = verifyJwt(cookieToken);
  if (!claims) return null;

  if (options.enforceCsrf !== false) {
    const csrfCheck = validateCsrfRequest(req, claims);
    if (!csrfCheck.valid) {
      if (options.returnCsrfError) {
        return { csrfError: true, reason: csrfCheck.reason };
      }
      return null;
    }
  }

  return { ...claims, authSource: 'cookie' };
}

/**
 * Verifica no banco se a sessão (`sid`) do token ainda está ativa e não foi revogada.
 */
export async function verifyActiveSessionInDb(client, claims) {
  if (!claims?.sub) return false;
  if (!claims.sid) return true; // Tokens emitidos sem sid permanecem compatíveis até expirar
  const res = await client.query(
    `SELECT 1 FROM auth_sessions
     WHERE id::text = $1::text
       AND user_id::text = $2::text
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [String(claims.sid), String(claims.sub)]
  );
  return res.rowCount > 0;
}

/**
 * Executa uma operação autenticada no PostgreSQL Oracle definindo
 * `SET LOCAL app.current_user_id = '<uuid>'` dentro da transação
 * para que todas as funções SQL e políticas de autorização respeitem o usuário autenticado.
 */
export async function withAuthenticatedPg(req, handler) {
  const userClaims = extractAuthenticatedUser(req, { returnCsrfError: true });
  if (userClaims?.csrfError) {
    return { forbidden: true, error: userClaims.reason || 'Falha na validação CSRF.' };
  }
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
    const active = await verifyActiveSessionInDb(client, userClaims);
    if (!active) {
      return { unauthorized: true, error: 'Sessão expirada ou revogada.' };
    }
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userClaims.sub]);
    const result = await handler(client, userClaims);
    await client.query('COMMIT');
    return { ok: true, data: result, user: userClaims };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Verifica se o usuário autenticado (`actorId`) pode acessar ou modificar dados do `targetPatientId`.
 * Validação explícita de acesso a dados de pacientes no backend e no PostgreSQL.
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
     WHERE patient_id::text = $1::text
       AND caregiver_id::text = $2::text
       AND status = 'active'
       AND permission_level = ANY($3::text[])
     LIMIT 1`,
    [String(targetPatientId), String(actorId), allowedLevels]
  );
  return res.rowCount > 0;
}

export async function issueSessionTokens(client, userRow, userAgent = '', ipAddress = '') {
  const sessionId = crypto.randomUUID();
  const csrfToken = crypto.randomBytes(24).toString('hex');

  const accessToken = signJwt({
    sub: String(userRow.id),
    sid: sessionId,
    csrf: csrfToken,
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
    [sessionId, String(userRow.id), refreshHash, userAgent, ipAddress, expiresAt]
  );

  return {
    access_token: accessToken,
    refresh_token: rawRefreshToken,
    csrf_token: csrfToken,
    session_id: sessionId,
    token_type: 'bearer',
    expires_in: ACCESS_TOKEN_TTL_SEC,
    user: {
      id: String(userRow.id),
      email: userRow.email,
      role: userRow.role || 'independente',
      user_metadata: userRow.raw_user_meta_data || { nome: userRow.nome || '' },
      created_at: userRow.created_at,
    },
  };
}
