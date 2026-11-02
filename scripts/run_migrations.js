#!/usr/bin/env node
/**
 * MediCare — Utilitário Explícito de Verificação e Execução de Migrações
 *
 * Modos de uso:
 * 1) Apenas verificar conexão e versão do esquema (Somente Leitura / Padrão):
 *    node scripts/run_migrations.js --check
 *
 * 2) Aplicar migrações incrementais não-destrutivas (Requer autorização explícita --apply):
 *    node scripts/run_migrations.js --apply
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const applyMode = process.argv.includes('--apply');
  const dbUrl = process.env.DATABASE_URL || process.env.ORACLE_DB_URL;

  if (!dbUrl) {
    console.error('ERRO: Defina DATABASE_URL antes de executar o utilitário de migrações.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: process.env.ORACLE_PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    const connRes = await client.query('SELECT version(), current_database() AS db, NOW() AS server_time');
    console.log('✓ Conectado ao banco:', connRes.rows[0].db);

    const tablesRes = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    const tables = tablesRes.rows.map((r) => r.table_name);
    console.log(`✓ Tabelas encontradas (${tables.length}):`, tables.join(', '));

    if (!applyMode) {
      console.log('Modo somente-leitura (--check). Nenhuma alteração foi executada no banco.');
      return;
    }

    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '03_incremental_compatibility.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Aplicando migração incremental 03_incremental_compatibility.sql...');
    await client.query(sql);
    console.log('✓ Migração 03_incremental_compatibility.sql aplicada com sucesso.');
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Erro no utilitário de migrações:', err.message);
    process.exit(1);
  });
}
