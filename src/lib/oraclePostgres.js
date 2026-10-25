import { Pool } from 'pg';

let poolInstance = null;
let schemaInitialized = false;

export function getOraclePgConfig() {
  const connectionString = process.env.DATABASE_URL?.trim();
  const host = process.env.ORACLE_PG_HOST?.trim();
  const port = parseInt(process.env.ORACLE_PG_PORT || '5432', 10);
  const database = process.env.ORACLE_PG_DATABASE?.trim() || 'medicare';
  const user = process.env.ORACLE_PG_USER?.trim() || 'postgres';
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

/**
 * Inicializa de forma segura e não-destrutiva (CREATE TABLE IF NOT EXISTS)
 * todas as tabelas necessárias no PostgreSQL do servidor Oracle.
 */
export async function ensureOraclePostgresSchema(client) {
  if (schemaInitialized) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      social_name TEXT,
      email TEXT,
      role TEXT DEFAULT 'independente',
      blood_type TEXT DEFAULT 'O+',
      dob TEXT,
      sex TEXT,
      cpf TEXT,
      phone TEXT,
      address TEXT,
      weight TEXT,
      height TEXT,
      role_change_pin TEXT DEFAULT '123456',
      notifications_enabled BOOLEAN DEFAULT TRUE,
      emergency_settings JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS medicamentos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      active_ingredient TEXT,
      dosagem TEXT NOT NULL,
      unidade TEXT DEFAULT 'comprimido',
      cor TEXT DEFAULT '#3b82f6',
      quantidade INTEGER DEFAULT 30,
      aviso_estoque INTEGER DEFAULT 5,
      horarios JSONB DEFAULT '["08:00"]'::jsonb,
      dias_semana JSONB DEFAULT '[0,1,2,3,4,5,6]'::jsonb,
      observacoes TEXT,
      ativo BOOLEAN DEFAULT TRUE,
      status TEXT DEFAULT 'ativo',
      treatment_type TEXT DEFAULT 'continuous',
      start_date TEXT,
      end_date TEXT,
      treatment_days INTEGER,
      manufacturer TEXT,
      important_for_emergency BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS historico_doses (
      id TEXT PRIMARY KEY,
      med_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      hora TEXT NOT NULL,
      dose_date TEXT NOT NULL,
      status TEXT DEFAULT 'confirmed',
      atraso_minutos INTEGER DEFAULT 0,
      quantidade_usada INTEGER DEFAULT 1,
      is_retroactive BOOLEAN DEFAULT FALSE,
      correction_reason TEXT,
      confirmed_by_name TEXT,
      confirmed_by_role TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_historico_doses_user_date
      ON historico_doses (user_id, dose_date);

    CREATE TABLE IF NOT EXISTS health_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      time TEXT,
      doctor TEXT,
      location TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS calendar_notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      mood TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      medication_id TEXT NOT NULL,
      med_name TEXT,
      movement_type TEXT NOT NULL,
      quantity_before INTEGER NOT NULL,
      quantity_after INTEGER NOT NULL,
      quantity_delta INTEGER NOT NULL,
      purchase_price TEXT,
      purchase_location TEXT,
      batch TEXT,
      expiration_date TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS allergies (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      reaction TEXT,
      severity TEXT DEFAULT 'Moderada'
    );

    CREATE TABLE IF NOT EXISTS health_conditions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      relation TEXT NOT NULL,
      phone TEXT NOT NULL,
      priority INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS healthcare_professionals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      phone TEXT,
      crm TEXT,
      location TEXT
    );

    CREATE TABLE IF NOT EXISTS caregiver_relationships (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      caregiver_name TEXT,
      invite_email TEXT,
      relationship_label TEXT,
      permission_level TEXT DEFAULT 'caregiver',
      status TEXT DEFAULT 'active',
      invite_token TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  schemaInitialized = true;
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
  const start = Date.now();
  const client = await pool.connect();
  try {
    await ensureOraclePostgresSchema(client);
    const res = await client.query('SELECT version(), current_database() AS db, NOW() AS server_time');
    return {
      ok: true,
      configured: true,
      mode: cfg.mode,
      latencyMs: Date.now() - start,
      database: res.rows[0]?.db,
      serverTime: res.rows[0]?.server_time,
      version: res.rows[0]?.version,
    };
  } finally {
    client.release();
  }
}
