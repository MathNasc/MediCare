/**
 * @jest-environment node
 */

import {
  signJwt,
  verifyJwt,
  extractAuthenticatedUser,
  validateCsrfRequest,
  verifyActiveSessionInDb,
  canAccessPatientData,
  ACCESS_COOKIE_NAME,
  CSRF_COOKIE_NAME,
} from '@/lib/oracleAuth';
import {
  verifyDatabaseConnection,
  runDatabaseMigrations,
  ensureOraclePostgresSchema,
  resetSchemaVerificationCache,
  REQUIRED_CORE_TABLES,
} from '@/lib/oraclePostgres';

function buildMockRequest({
  method = 'GET',
  headers = {},
  url = 'https://medicare-cuidador.duckdns.org/api/rest/v1/medicamentos',
} = {}) {
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    method,
    url,
    headers: {
      get(name) {
        return normalizedHeaders.get(String(name).toLowerCase()) || null;
      },
    },
  };
}

describe('Segurança de Autenticação (HttpOnly Cookie + CSRF + Bearer Android)', () => {
  const testClaims = {
    sub: '11111111-2222-3333-4444-555555555555',
    sid: 'session-abc-123',
    csrf: 'csrf-secret-token-999',
    email: 'cuidador@medicare.local',
    role: 'cuidador',
  };

  it('emite JWT com identificador isolado de sessão (sid) e valida assinatura', () => {
    const token = signJwt(testClaims, 3600);
    const payload = verifyJwt(token);
    expect(payload).not.toBeNull();
    expect(payload.sub).toBe(testClaims.sub);
    expect(payload.sid).toBe('session-abc-123');
  });

  it('rejeita token expirado', () => {
    const expiredToken = signJwt(testClaims, -10);
    expect(verifyJwt(expiredToken)).toBeNull();
  });

  it('mantém compatibilidade com Authorization: Bearer (Android) sem exigir CSRF', () => {
    const token = signJwt(testClaims, 3600);
    const req = buildMockRequest({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const user = extractAuthenticatedUser(req);
    expect(user).not.toBeNull();
    expect(user.authSource).toBe('bearer');
    expect(user.sub).toBe(testClaims.sub);
  });

  it('autentica via cookie HttpOnly e exige X-CSRF-Token + Origin válido em mutações web', () => {
    const csrfToken = testClaims.csrf;
    const token = signJwt(testClaims, 3600);

    // 1. Sem X-CSRF-Token -> bloqueado
    const reqNoCsrf = buildMockRequest({
      method: 'POST',
      headers: {
        Cookie: `${ACCESS_COOKIE_NAME}=${encodeURIComponent(token)}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
        Origin: 'https://medicare-cuidador.duckdns.org',
        Host: 'medicare-cuidador.duckdns.org',
      },
    });
    expect(extractAuthenticatedUser(reqNoCsrf)).toBeNull();
    expect(validateCsrfRequest(reqNoCsrf, testClaims).valid).toBe(false);

    // 2. Com X-CSRF-Token divergente -> bloqueado
    const reqWrongCsrf = buildMockRequest({
      method: 'POST',
      headers: {
        Cookie: `${ACCESS_COOKIE_NAME}=${encodeURIComponent(token)}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
        'X-CSRF-Token': 'token-invalido',
        Origin: 'https://medicare-cuidador.duckdns.org',
        Host: 'medicare-cuidador.duckdns.org',
      },
    });
    expect(extractAuthenticatedUser(reqWrongCsrf)).toBeNull();

    // 3. Com Origin externo malicioso -> bloqueado
    const reqBadOrigin = buildMockRequest({
      method: 'POST',
      headers: {
        Cookie: `${ACCESS_COOKIE_NAME}=${encodeURIComponent(token)}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
        'X-CSRF-Token': csrfToken,
        Origin: 'https://atacante.exemplo.com',
        Host: 'medicare-cuidador.duckdns.org',
      },
    });
    expect(extractAuthenticatedUser(reqBadOrigin)).toBeNull();

    // 4. Com Cookie + X-CSRF-Token + Origin legítimo -> aprovado
    const reqValid = buildMockRequest({
      method: 'POST',
      headers: {
        Cookie: `${ACCESS_COOKIE_NAME}=${encodeURIComponent(token)}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
        'X-CSRF-Token': csrfToken,
        Origin: 'https://medicare-cuidador.duckdns.org',
        Host: 'medicare-cuidador.duckdns.org',
      },
    });
    const authedWeb = extractAuthenticatedUser(reqValid);
    expect(authedWeb).not.toBeNull();
    expect(authedWeb.authSource).toBe('cookie');
    expect(authedWeb.sub).toBe(testClaims.sub);
  });

  it('valida revogação e isolamento de sessão em auth_sessions via sid', async () => {
    const activeClient = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ '?column?': 1 }] }),
    };
    const revokedClient = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    };

    const userClaims = { sub: testClaims.sub, sid: 'sid-1' };
    expect(await verifyActiveSessionInDb(activeClient, userClaims)).toBe(true);
    expect(await verifyActiveSessionInDb(revokedClient, userClaims)).toBe(false);
  });

  it('bloqueia acesso a pacientes sem vínculo ativo (prevenção contra IDOR)', async () => {
    const unlinkedClient = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    };
    const linkedClient = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ '?column?': 1 }] }),
    };

    expect(
      await canAccessPatientData(
        unlinkedClient,
        'cuidador-uuid-1',
        'paciente-alheio-uuid-2',
        'viewer'
      )
    ).toBe(false);

    expect(
      await canAccessPatientData(
        linkedClient,
        'cuidador-uuid-1',
        'paciente-vinculado-uuid-3',
        'caregiver'
      )
    ).toBe(true);
  });
});

describe('Separação entre Conexão, Verificação de Versão e Migrações do Banco', () => {
  beforeEach(() => {
    resetSchemaVerificationCache();
  });

  it('verifica conexão de forma isolada sem executar DDL', async () => {
    const queries = [];
    const mockClient = {
      query: jest.fn(async (sql) => {
        queries.push(sql);
        return {
          rows: [{ version: 'PostgreSQL 16.4', db: 'medicare_db', server_time: new Date().toISOString() }],
          rowCount: 1,
        };
      }),
    };

    const res = await verifyDatabaseConnection(mockClient);
    expect(res.connected).toBe(true);
    expect(res.database).toBe('medicare_db');
    expect(queries.some((q) => /ALTER\s+TABLE|CREATE\s+TABLE/i.test(q))).toBe(false);
  });

  it('ensureOraclePostgresSchema e verifySchemaVersion apenas verificam tabelas e não executam ALTER/CREATE TABLE durante requisições', async () => {
    const queries = [];
    const mockClient = {
      query: jest.fn(async (sql) => {
        queries.push(sql);
        if (sql.includes("to_regclass('public.app_users')")) {
          return {
            rows: [{ app_users: 'public.app_users', profiles: 'public.profiles' }],
          };
        }
        if (sql.includes('information_schema.tables')) {
          return {
            rows: [
              ...REQUIRED_CORE_TABLES.map((table_name) => ({ table_name })),
              { table_name: 'schema_migrations' },
            ],
          };
        }
        return { rows: [] };
      }),
    };

    const ready = await ensureOraclePostgresSchema(mockClient);
    expect(ready).toBe(true);
    expect(queries.some((q) => /ALTER\s+TABLE|CREATE\s+TABLE/i.test(q))).toBe(false);
  });

  it('bloqueia execução de migrações sem autorização explícita', async () => {
    const mockClient = { query: jest.fn() };
    await expect(runDatabaseMigrations(mockClient, { authorized: false })).rejects.toThrow(
      /requer autorização explícita/i
    );
  });
});
