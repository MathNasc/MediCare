import { Pool } from 'pg';

let poolInstance = null;
let schemaVerified = false;

export const REQUIRED_CORE_TABLES = [
  'app_users',
  'auth_sessions',
  'roles',
  'profiles',
  'medicamentos',
  'historico_doses',
  'caregiver_relationships',
  'health_events',
  'stock_movements',
  'audit_logs',
];

export const OPTIONAL_COMPATIBILITY_TABLES = [
  'calendar_notes',
  'notes',
  'custom_medications',
  'notificacoes',
  'approval_requests',
  'schema_migrations',
];

export const VERSIONED_MIGRATIONS = [
  {
    version: '03_incremental_compatibility',
    description: 'Colunas de rastreabilidade de doses, pacientes gerenciados e aprovações',
    statements: [
      `CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version text PRIMARY KEY,
        description text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`,
      `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight_updated_at timestamptz`,
      `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_managed boolean DEFAULT false`,
      `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS managed_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL`,
      `ALTER TABLE public.medicamentos ADD COLUMN IF NOT EXISTS active_ingredient text`,
      `ALTER TABLE public.medicamentos ADD COLUMN IF NOT EXISTS principio_ativo text`,
      `ALTER TABLE public.medicamentos ADD COLUMN IF NOT EXISTS manufacturer text`,
      `ALTER TABLE public.medicamentos ADD COLUMN IF NOT EXISTS fabricante text`,
      `ALTER TABLE public.medicamentos ADD COLUMN IF NOT EXISTS aviso_estoque int DEFAULT 5`,
      `ALTER TABLE public.medicamentos ADD COLUMN IF NOT EXISTS important_for_emergency boolean DEFAULT false`,
      `ALTER TABLE public.medicamentos DROP CONSTRAINT IF EXISTS medicamentos_quantidade_check`,
      `ALTER TABLE public.historico_doses ADD COLUMN IF NOT EXISTS dose_date date`,
      `ALTER TABLE public.historico_doses ADD COLUMN IF NOT EXISTS administered_at timestamptz`,
      `ALTER TABLE public.historico_doses ADD COLUMN IF NOT EXISTS origin text DEFAULT 'patient_app'`,
      `ALTER TABLE public.historico_doses ADD COLUMN IF NOT EXISTS confirmed_by_name text`,
      `ALTER TABLE public.historico_doses ADD COLUMN IF NOT EXISTS confirmed_by_role text`,
      `CREATE INDEX IF NOT EXISTS idx_historico_doses_user_date ON public.historico_doses (user_id, dose_date)`,
      `ALTER TABLE public.emergency_contacts ADD COLUMN IF NOT EXISTS relation text`,
      `ALTER TABLE public.emergency_contacts ADD COLUMN IF NOT EXISTS relationship text`,
      `ALTER TABLE public.healthcare_professionals ADD COLUMN IF NOT EXISTS location text`,
      `ALTER TABLE public.healthcare_professionals ADD COLUMN IF NOT EXISTS clinic text`,
      `ALTER TABLE public.healthcare_professionals ADD COLUMN IF NOT EXISTS email text`,
      `ALTER TABLE public.healthcare_professionals ADD COLUMN IF NOT EXISTS notes text`,
      `ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS med_name text`,
      `ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS quantity_delta numeric`,
      `ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS quantity_changed numeric`,
      `CREATE TABLE IF NOT EXISTS public.calendar_notes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
        date date NOT NULL,
        content text NOT NULL,
        mood text,
        created_at timestamptz DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS public.notes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
        title text NOT NULL,
        description text,
        date date NOT NULL,
        time time,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS public.custom_medications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
        commercial_name text NOT NULL,
        active_ingredient text,
        dosage text,
        pharmaceutical_form text,
        presentation text,
        unit text DEFAULT 'comprimido',
        manufacturer text,
        medicine_type text DEFAULT 'outro',
        is_custom boolean DEFAULT true,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS public.notificacoes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        tipo text NOT NULL,
        titulo text NOT NULL,
        mensagem text NOT NULL,
        lida boolean DEFAULT false,
        created_at timestamptz DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS public.approval_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        caregiver_id uuid,
        med_id text,
        med_nome text,
        dose_date text,
        hora text,
        action_type text NOT NULL,
        requested_status text NOT NULL,
        reason text NOT NULL,
        status text DEFAULT 'pending',
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )`,
    ],
  },
];

export function getOraclePgConfig() {
  const connectionString = process.env.DATABASE_URL?.trim();
  const host = process.env.ORACLE_PG_HOST?.trim();
  const port = parseInt(process.env.ORACLE_PG_PORT || '5432', 10);
  const database = process.env.ORACLE_PG_DATABASE?.trim() || 'medicare_db';
  const user = process.env.ORACLE_PG_USER?.trim() || 'medicare_app';
  const password = process.env.ORACLE_PG_PASSWORD || '';
  const useSsl = process.env.ORACLE_PG_SSL === 'true';

  if (connectionString) {
    return {
      configured: true,
      mode: 'DATABASE_URL',
      poolConfig: {
        connectionString,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 8000,
      },
    };
  }

  if (host) {
    return {
      configured: true,
      mode: 'ORACLE_PG_HOST',
      poolConfig: {
        host,
        port,
        database,
        user,
        password,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 8000,
      },
    };
  }

  return { configured: false, mode: 'NONE', poolConfig: null };
}

export function getPgPool() {
  const cfg = getOraclePgConfig();
  if (!cfg.configured) return null;
  if (!poolInstance) {
    poolInstance = new Pool(cfg.poolConfig);
  }
  return poolInstance;
}

export function resetSchemaVerificationCache() {
  schemaVerified = false;
}

/**
 * 1. VERIFICAÇÃO DE CONEXÃO (Somente leitura, zero DDL)
 */
export async function verifyDatabaseConnection(client) {
  const start = Date.now();
  const res = await client.query('SELECT version(), current_database() AS db, NOW() AS server_time');
  const row = res.rows[0] || {};
  return {
    connected: true,
    latencyMs: Date.now() - start,
    database: row.db || null,
    serverTime: row.server_time || null,
    version: row.version || null,
  };
}

/**
 * 2. VERIFICAÇÃO DE VERSÃO E ESTRUTURA DO ESQUEMA (Somente leitura, zero DDL)
 */
export async function verifySchemaVersion(client) {
  const tablesRes = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'`
  );
  const existingTables = new Set((tablesRes.rows || []).map((r) => r.table_name));
  const missingCoreTables = REQUIRED_CORE_TABLES.filter((t) => !existingTables.has(t));
  const missingOptionalTables = OPTIONAL_COMPATIBILITY_TABLES.filter((t) => !existingTables.has(t));

  let appliedMigrations = [];
  if (existingTables.has('schema_migrations')) {
    const migRes = await client.query(
      `SELECT version, description, applied_at
       FROM public.schema_migrations
       ORDER BY applied_at ASC, version ASC`
    );
    appliedMigrations = migRes.rows || [];
  }

  const latestVersion =
    appliedMigrations.length > 0
      ? appliedMigrations[appliedMigrations.length - 1].version
      : missingCoreTables.length === 0
      ? '02_schema_oracle_standalone (unrecorded)'
      : 'uninitialized';

  return {
    initialized: missingCoreTables.length === 0,
    schemaVersion: latestVersion,
    missingCoreTables,
    missingOptionalTables,
    appliedMigrations,
  };
}

/**
 * 3. EXECUÇÃO EXPLÍCITA E VERSIONADA DE MIGRAÇÕES (Transacional, não-destrutiva e sem falhas silenciosas)
 * Nunca executada durante requisições normais sem autorização explícita.
 */
export async function runDatabaseMigrations(client, options = {}) {
  const isAuthorized =
    options.authorized === true || process.env.ALLOW_EXPLICIT_MIGRATIONS === 'true';

  if (!isAuthorized) {
    throw new Error(
      'Execução de migrações bloqueada: requer autorização explícita (authorized: true ou ALLOW_EXPLICIT_MIGRATIONS=true).'
    );
  }

  const statusBefore = await verifySchemaVersion(client);
  if (!statusBefore.initialized) {
    throw new Error(
      `O esquema base (02_schema_oracle_standalone.sql) precisa ser aplicado antes das migrações incrementais. Tabelas ausentes: ${statusBefore.missingCoreTables.join(', ')}`
    );
  }

  const executedVersions = [];

  for (const migration of VERSIONED_MIGRATIONS) {
    await client.query('BEGIN');
    try {
      for (const stmt of migration.statements) {
        await client.query(stmt);
      }

      await client.query(
        `INSERT INTO public.schema_migrations (version, description)
         VALUES ($1, $2)
         ON CONFLICT (version) DO NOTHING`,
        [migration.version, migration.description]
      );

      await client.query('COMMIT');
      executedVersions.push(migration.version);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      schemaVerified = false;
      throw new Error(`Falha ao aplicar migração ${migration.version}: ${err.message}`);
    }
  }

  schemaVerified = true;
  return {
    ok: true,
    executedVersions,
  };
}

/**
 * 4. OPERAÇÃO NORMAL DA APLICAÇÃO
 * Verifica apenas a existência das tabelas fundamentais sem executar DDL em requisições normais
 * e nunca marca o esquema como verificado caso a consulta falhe.
 */
export async function ensureOraclePostgresSchema(client) {
  if (schemaVerified) return true;

  const check = await client.query(
    `SELECT
       to_regclass('public.app_users') AS app_users,
       to_regclass('public.profiles') AS profiles`
  );

  const row = check.rows?.[0];
  if (!row?.app_users || !row?.profiles) {
    schemaVerified = false;
    throw new Error(
      'Esquema do banco PostgreSQL não inicializado (tabelas public.app_users / public.profiles ausentes). Execute as migrações explícitas.'
    );
  }

  schemaVerified = true;
  return true;
}

export async function checkOraclePostgresHealth() {
  const cfg = getOraclePgConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      configured: false,
      message: 'Variáveis DATABASE_URL ou ORACLE_PG_HOST ainda não definidas no servidor.',
    };
  }
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const connInfo = await verifyDatabaseConnection(client);
    const schemaInfo = await verifySchemaVersion(client);
    return {
      ok: connInfo.connected && schemaInfo.initialized,
      configured: true,
      mode: cfg.mode,
      latencyMs: connInfo.latencyMs,
      database: connInfo.database,
      serverTime: connInfo.serverTime,
      version: connInfo.version,
      schema: {
        initialized: schemaInfo.initialized,
        version: schemaInfo.schemaVersion,
        missingCoreTables: schemaInfo.missingCoreTables,
      },
    };
  } finally {
    client.release();
  }
}
