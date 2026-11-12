import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  ACCESS_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_SEC,
  attachAuthCookies,
  clearAuthCookies,
  isSecureRequest,
  parseRequestCookies,
  serializeCookie,
  validateCsrfRequest,
} from './oracleAuth';

export const ORACLE_BACKEND_URL =
  process.env.ORACLE_BACKEND_URL || 'http://144.22.160.191:3009';

/**
 * Encaminha a requisição HTTP para o backend MediCare ativo na Oracle Cloud
 * quando o banco de dados PostgreSQL local não estiver configurado no ambiente atual,
 * preservando cookies HttpOnly, proteção CSRF e compatibilidade com Bearer Android.
 */
export async function forwardToOracleBackend(req, targetPath) {
  const targetUrl = new URL(targetPath, ORACLE_BACKEND_URL);

  // Repassa query parameters da requisição original
  const origUrl = new URL(req.url);
  origUrl.searchParams.forEach((val, key) => {
    targetUrl.searchParams.append(key, val);
  });

  const method = String(req.method || 'GET').toUpperCase();
  const cookies = parseRequestCookies(req);
  const accessCookie = cookies[ACCESS_COOKIE_NAME] || '';
  const refreshCookie = cookies[REFRESH_COOKIE_NAME] || '';
  const csrfCookie = cookies[CSRF_COOKIE_NAME] || '';

  const isAuthAction = targetPath.startsWith('/api/auth/v1/');
  const isPublicAuthMutation =
    targetPath === '/api/auth/v1/token' ||
    targetPath === '/api/auth/v1/signup' ||
    targetPath === '/api/auth/v1/recover' ||
    targetPath === '/api/auth/v1/logout';

  // Se o cliente web usa cookie HttpOnly (sem Bearer explícito), valida CSRF em mutações
  if (
    !req.headers.get('authorization') &&
    accessCookie &&
    !['GET', 'HEAD', 'OPTIONS'].includes(method) &&
    !isPublicAuthMutation
  ) {
    const csrfCheck = validateCsrfRequest(req);
    if (!csrfCheck.valid) {
      return NextResponse.json(
        { error: csrfCheck.reason || 'Falha na validação CSRF.' },
        { status: 403 }
      );
    }
  }

  const headers = new Headers();
  req.headers.forEach((val, key) => {
    const k = key.toLowerCase();
    if (k !== 'host' && k !== 'connection' && k !== 'content-length') {
      headers.set(key, val);
    }
  });

  // Preserva host original para validação de Origin no upstream quando aplicável
  const origHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (origHost) {
    headers.set('x-forwarded-host', origHost);
  }

  // Converte cookie HttpOnly em Bearer ao encaminhar para o backend Oracle
  if (!headers.has('authorization') && accessCookie) {
    headers.set('Authorization', `Bearer ${accessCookie}`);
  }

  const fetchOptions = {
    method,
    headers,
    redirect: 'manual',
  };

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    try {
      const cloned = req.clone();
      const rawBuf = await cloned.arrayBuffer();

      // Para refresh_token / logout via cookie HttpOnly, injeta refresh_token no payload quando ausente
      if (
        (targetPath === '/api/auth/v1/token' &&
          origUrl.searchParams.get('grant_type') === 'refresh_token') ||
        targetPath === '/api/auth/v1/logout'
      ) {
        let jsonBody = {};
        if (rawBuf && rawBuf.byteLength > 0) {
          try {
            jsonBody = JSON.parse(Buffer.from(rawBuf).toString('utf8'));
          } catch {
            jsonBody = {};
          }
        }
        if (!jsonBody.refresh_token && refreshCookie) {
          jsonBody.refresh_token = refreshCookie;
          headers.set('Content-Type', 'application/json');
        }
        fetchOptions.body = JSON.stringify(jsonBody);
      } else if (rawBuf && rawBuf.byteLength > 0) {
        fetchOptions.body = rawBuf;
      }
    } catch {
      // Ignora erro caso não haja corpo legível
    }
  }

  try {
    const res = await fetch(targetUrl.toString(), fetchOptions);
    const respHeaders = new Headers();
    const upstreamCookies =
      typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];

    res.headers.forEach((val, key) => {
      const k = key.toLowerCase();
      if (
        k !== 'content-encoding' &&
        k !== 'content-length' &&
        k !== 'transfer-encoding' &&
        k !== 'set-cookie'
      ) {
        respHeaders.set(key, val);
      }
    });

    for (const c of upstreamCookies) {
      respHeaders.append('Set-Cookie', c);
    }

    respHeaders.set('Access-Control-Allow-Origin', '*');
    respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    respHeaders.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-CSRF-Token, apikey, x-api-key, Prefer'
    );

    const hasUpstreamAccessCookie = upstreamCookies.some((c) =>
      c.startsWith(`${ACCESS_COOKIE_NAME}=`)
    );

    // Bridge de autenticação: se Oracle retornou tokens JSON sem cookies HttpOnly,
    // o servidor Next.js emite os cookies HttpOnly/CSRF seguros para o navegador.
    if (isAuthAction && res.ok) {
      const rawText = await res.text();
      let json = null;
      try {
        json = JSON.parse(rawText);
      } catch {
        json = null;
      }

      if (targetPath === '/api/auth/v1/logout') {
        const out = NextResponse.json(json || { ok: true }, {
          status: res.status,
          headers: respHeaders,
        });
        return clearAuthCookies(out, req);
      }

      if (
        json &&
        (targetPath === '/api/auth/v1/token' || targetPath === '/api/auth/v1/signup') &&
        json.access_token &&
        !hasUpstreamAccessCookie
      ) {
        const csrfToken = json.csrf_token || crypto.randomBytes(24).toString('hex');
        const payload = { ...json, csrf_token: csrfToken };
        const out = NextResponse.json(payload, { status: res.status, headers: respHeaders });
        return attachAuthCookies(out, payload, req);
      }

      if (json && targetPath === '/api/auth/v1/user' && json.id) {
        const csrfToken = json.csrf_token || csrfCookie || crypto.randomBytes(24).toString('hex');
        const payload = { ...json, csrf_token: csrfToken };
        const out = NextResponse.json(payload, { status: res.status, headers: respHeaders });
        if (!csrfCookie) {
          out.headers.append(
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
        return out;
      }

      return new NextResponse(rawText, { status: res.status, headers: respHeaders });
    }

    // Limpa cookies se refresh falhou ou usuário foi invalidado
    if (
      isAuthAction &&
      res.status === 401 &&
      ((targetPath === '/api/auth/v1/token' &&
        origUrl.searchParams.get('grant_type') === 'refresh_token') ||
        targetPath === '/api/auth/v1/user') &&
      !hasUpstreamAccessCookie
    ) {
      const rawText = await res.text();
      const out = new NextResponse(rawText, { status: res.status, headers: respHeaders });
      return clearAuthCookies(out, req);
    }

    const resBuffer = await res.arrayBuffer();
    return new NextResponse(resBuffer, {
      status: res.status,
      headers: respHeaders,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Falha ao conectar com o backend Oracle (${ORACLE_BACKEND_URL}): ${err.message}` },
      { status: 502 }
    );
  }
}
