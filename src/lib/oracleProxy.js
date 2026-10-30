import { NextResponse } from 'next/server';

const ORACLE_BACKEND_URL = process.env.ORACLE_BACKEND_URL || 'http://144.22.160.191:3009';

/**
 * Encaminha a requisição HTTP para o backend MediCare ativo na Oracle Cloud
 * quando o banco de dados PostgreSQL local não estiver configurado no ambiente atual.
 */
export async function forwardToOracleBackend(req, targetPath) {
  const targetUrl = new URL(targetPath, ORACLE_BACKEND_URL);
  
  // Repassa query parameters da requisição original
  const origUrl = new URL(req.url);
  origUrl.searchParams.forEach((val, key) => {
    targetUrl.searchParams.append(key, val);
  });

  const headers = new Headers();
  req.headers.forEach((val, key) => {
    const k = key.toLowerCase();
    if (k !== 'host' && k !== 'connection' && k !== 'content-length') {
      headers.set(key, val);
    }
  });

  const fetchOptions = {
    method: req.method,
    headers,
    redirect: 'manual',
  };

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    try {
      const cloned = req.clone();
      const body = await cloned.arrayBuffer();
      if (body && body.byteLength > 0) {
        fetchOptions.body = body;
      }
    } catch {
      // Ignora erro caso não haja corpo legível
    }
  }

  try {
    const res = await fetch(targetUrl.toString(), fetchOptions);
    const respHeaders = new Headers();
    res.headers.forEach((val, key) => {
      const k = key.toLowerCase();
      if (k !== 'content-encoding' && k !== 'content-length' && k !== 'transfer-encoding') {
        respHeaders.set(key, val);
      }
    });
    respHeaders.set('Access-Control-Allow-Origin', '*');
    respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    respHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-api-key, Prefer');

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
