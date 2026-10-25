/**
 * MediCare — Fase 4, 6 & 17: Migração Completa + Validação Obrigatória de Dados
 * (Supabase Origem -> Oracle Cloud PostgreSQL Isolado medicare_db na porta 5436)
 *
 * Modos de uso:
 * 1) Migrar todos os dados (auth.users + 19 tabelas public) e validar em seguida:
 *    SUPABASE_DB_URL="postgresql://..." ORACLE_DB_URL="postgresql://medicare_app:SENHA@127.0.0.1:5436/medicare_db" \
 *    node oracle-migration/04_import_and_validate_oracle.js --migrate
 *
 * 2) Apenas validar paridade (Read-Only):
 *    SUPABASE_DB_URL="postgresql://..." ORACLE_DB_URL="postgresql://medicare_app:SENHA@127.0.0.1:5436/medicare_db" \
 *    node oracle-migration/04_import_and_validate_oracle.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Ordem topológica estrita respeitando chaves estrangeiras
const TABLES_IN_DEPENDENCY_ORDER = [
  { name: 'roles', pk: 'code' },
  { name: 'profiles', pk: 'id' },
  { name: 'medication_catalog', pk: 'id' },
  { name: 'custom_medications', pk: 'id' },
  { name: 'medicamentos', pk: 'id' },
  { name: 'historico_doses', pk: 'id' },
  { name: 'caregiver_relationships', pk: 'id' },
  { name: 'caregiver_notes', pk: 'id' },
  { name: 'caregiver_audit_log', pk: 'id' },
  { name: 'audit_logs', pk: 'id' },
  { name: 'stock_movements', pk: 'id' },
  { name: 'health_events', pk: 'id' },
  { name: 'notes', pk: 'id' },
  { name: 'dose_observations', pk: 'id' },
  { name: 'allergies', pk: 'id' },
  { name: 'health_conditions', pk: 'id' },
  { name: 'emergency_contacts', pk: 'id' },
  { name: 'healthcare_professionals', pk: 'id' },
  { name: 'push_subscriptions', pk: 'id' },
  { name: 'notification_logs', pk: 'id' },
];

async function getTableColumns(pool, schema, table) {
  const res = await pool.query(
    `SELECT column_name, data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [schema, table]
  );
  return res.rows.map((r) => r.column_name);
}

async function migrateUsersFromSupabase(originPool, targetPool) {
  console.log('\n[1/2] Migrando usuários de auth.users -> public.app_users (preservando UUIDs e hashes bcrypt)...');
  const usersRes = await originPool.query(`
    SELECT
      id,
      email,
      COALESCE(encrypted_password, '') AS password_hash,
      COALESCE(raw_user_meta_data, '{}'::jsonb) AS raw_user_meta_data,
      email_confirmed_at,
      last_sign_in_at,
      created_at,
      updated_at
    FROM auth.users
    ORDER BY created_at ASC
  `);

  let migrated = 0;
  for (const u of usersRes.rows) {
    await targetPool.query(
      `INSERT INTO public.app_users (
         id, email, password_hash, raw_user_meta_data,
         email_confirmed_at, last_sign_in_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         password_hash = CASE WHEN EXCLUDED.password_hash <> '' THEN EXCLUDED.password_hash ELSE public.app_users.password_hash END,
         raw_user_meta_data = EXCLUDED.raw_user_meta_data,
         email_confirmed_at = COALESCE(EXCLUDED.email_confirmed_at, public.app_users.email_confirmed_at),
         last_sign_in_at = COALESCE(EXCLUDED.last_sign_in_at, public.app_users.last_sign_in_at),
         updated_at = EXCLUDED.updated_at`,
      [
        u.id,
        u.email,
        u.password_hash,
        JSON.stringify(u.raw_user_meta_data || {}),
        u.email_confirmed_at,
        u.last_sign_in_at,
        u.created_at || new Date(),
        u.updated_at || new Date(),
      ]
    );
    migrated++;
  }
  console.log(`✓ ${migrated} usuários migrados com sucesso para public.app_users.`);
}

async function migratePublicTables(originPool, targetPool) {
  console.log('\n[2/2] Migrando tabelas do schema public em ordem topológica...');

  for (const tbl of TABLES_IN_DEPENDENCY_ORDER) {
    const originCols = await getTableColumns(originPool, 'public', tbl.name);
    const targetCols = await getTableColumns(targetPool, 'public', tbl.name);

    if (originCols.length === 0) {
      console.log(` - Tabela public.${tbl.name} não existe na origem (pulando).`);
      continue;
    }

    // Interseção de colunas que existem tanto na origem quanto no destino (excluindo colunas geradas como search_vector)
    const commonCols = originCols.filter(
      (col) => targetCols.includes(col) && col !== 'search_vector'
    );

    const quotedCols = commonCols.map((c) => `"${c}"`).join(', ');
    const rowsRes = await originPool.query(`SELECT ${quotedCols} FROM public."${tbl.name}"`);
    const rows = rowsRes.rows;

    if (rows.length === 0) {
      console.log(` - public.${tbl.name}: 0 registros.`);
      continue;
    }

    const client = await targetPool.connect();
    try {
      await client.query('BEGIN');
      for (const row of rows) {
        const values = commonCols.map((c) => row[c]);
        const placeholders = commonCols.map((_, idx) => `$${idx + 1}`).join(', ');
        const updateCols = commonCols.filter((c) => c !== tbl.pk);
        const conflictClause =
          updateCols.length > 0
            ? `ON CONFLICT ("${tbl.pk}") DO UPDATE SET ` +
              updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')
            : `ON CONFLICT ("${tbl.pk}") DO NOTHING`;

        await client.query(
          `INSERT INTO public."${tbl.name}" (${quotedCols}) VALUES (${placeholders}) ${conflictClause}`,
          values
        );
      }
      await client.query('COMMIT');
      console.log(` ✓ public.${tbl.name}: ${rows.length} registros migrados/sincronizados.`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Falha ao migrar tabela public.${tbl.name}: ${err.message}`);
    } finally {
      client.release();
    }
  }
}

async function runValidation() {
  const shouldMigrate = process.argv.includes('--migrate');
  const originUrl = process.env.SUPABASE_DB_URL;
  const targetUrl = process.env.ORACLE_DB_URL || process.env.DATABASE_URL;

  if (!targetUrl) {
    console.error('ERRO: Defina ORACLE_DB_URL (ou DATABASE_URL) apontando para o medicare_db na Oracle.');
    process.exit(1);
  }

  if (shouldMigrate && !originUrl) {
    console.error('ERRO: Para executar --migrate, defina SUPABASE_DB_URL com a string de conexão PostgreSQL do Supabase.');
    process.exit(1);
  }

  const targetPool = new Pool({ connectionString: targetUrl });
  const originPool = originUrl ? new Pool({ connectionString: originUrl, ssl: { rejectUnauthorized: false } }) : null;

  const report = {
    timestamp: new Date().toISOString(),
    mode: shouldMigrate ? 'MIGRATE_AND_VALIDATE' : 'VALIDATE_ONLY',
    status: 'PASS',
    authUsers: {},
    tables: {},
    semanticChecks: {},
    discrepancies: [],
  };

  try {
    if (shouldMigrate && originPool) {
      await migrateUsersFromSupabase(originPool, targetPool);
      await migratePublicTables(originPool, targetPool);
    }

    console.log('\n======================================================================');
    console.log(' EXECUTANDO VALIDAÇÃO DE PARIDADE E INTEGRIDADE (ORIGEM VS ORACLE)');
    console.log('======================================================================');

    // Validação de usuários (auth.users vs public.app_users)
    const targetUsersRes = await targetPool.query('SELECT count(*)::int AS cnt FROM public.app_users');
    const targetUsersCount = targetUsersRes.rows[0].cnt;
    let originUsersCount = null;
    if (originPool) {
      const originUsersRes = await originPool.query('SELECT count(*)::int AS cnt FROM auth.users');
      originUsersCount = originUsersRes.rows[0].cnt;
      if (originUsersCount !== targetUsersCount) {
        report.status = 'FAIL';
        report.discrepancies.push(`Usuários (auth.users vs app_users): origem=${originUsersCount}, destino=${targetUsersCount}`);
      }
    }
    report.authUsers = { originCount: originUsersCount, targetCount: targetUsersCount };

    for (const tbl of TABLES_IN_DEPENDENCY_ORDER) {
      const targetCountRes = await targetPool.query(`SELECT count(*)::int AS cnt FROM public."${tbl.name}"`);
      const targetCount = targetCountRes.rows[0].cnt;

      let originCount = null;
      if (originPool) {
        const originCols = await getTableColumns(originPool, 'public', tbl.name);
        if (originCols.length > 0) {
          const originCountRes = await originPool.query(`SELECT count(*)::int AS cnt FROM public."${tbl.name}"`);
          originCount = originCountRes.rows[0].cnt;
        }
      }

      const match = originCount === null || originCount === targetCount;
      if (!match) {
        report.status = 'FAIL';
        report.discrepancies.push(`Tabela ${tbl.name}: origem=${originCount}, destino=${targetCount}`);
      }

      report.tables[tbl.name] = {
        originCount,
        targetCount,
        match,
      };
    }

    // Verificações semânticas críticas exigidas na Seção 6
    const semanticSql = `
      SELECT
        (SELECT count(*)::int FROM public.medicamentos WHERE ativo = true AND treatment_type = 'continuous') AS active_continuous_meds,
        (SELECT count(*)::int FROM public.medicamentos WHERE treatment_type = 'temporary' AND status = 'ativo') AS active_temp_meds,
        (SELECT count(*)::int FROM public.medicamentos WHERE treatment_type = 'sos') AS sos_meds,
        (SELECT coalesce(sum(quantidade), 0)::int FROM public.medicamentos) AS total_stock_units,
        (SELECT count(*)::int FROM public.historico_doses WHERE status = 'confirmed') AS confirmed_doses,
        (SELECT count(*)::int FROM public.caregiver_relationships WHERE status = 'active') AS active_caregivers,
        (SELECT count(*)::int FROM public.medicamentos m LEFT JOIN public.profiles p ON p.id = m.user_id WHERE p.id IS NULL) AS orphan_medications,
        (SELECT count(*)::int FROM public.historico_doses h LEFT JOIN public.medicamentos m ON m.id = h.med_id WHERE h.med_id IS NOT NULL AND m.id IS NULL) AS orphan_dose_logs
    `;

    const targetSem = (await targetPool.query(semanticSql)).rows[0];
    report.semanticChecks.oracleTarget = targetSem;

    if (targetSem.orphan_medications > 0 || targetSem.orphan_dose_logs > 0) {
      report.status = 'FAIL';
      report.discrepancies.push('Encontrados registros órfãos violando integridade referencial no destino.');
    }

    if (originPool) {
      const originSem = (await originPool.query(semanticSql)).rows[0];
      report.semanticChecks.supabaseOrigin = originSem;
      for (const key of Object.keys(originSem)) {
        if (originSem[key] !== targetSem[key]) {
          report.status = 'FAIL';
          report.discrepancies.push(`Divergência semântica em ${key}: origem=${originSem[key]}, destino=${targetSem[key]}`);
        }
      }
    }

    const outPath = path.join(process.cwd(), 'oracle-migration', 'validation-report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log('✓ Relatório de validação salvo em:', outPath);
    console.log('✓ Status Global:', report.status);
    if (report.discrepancies.length > 0) {
      console.error('Discrepâncias encontradas:', report.discrepancies);
      process.exit(1);
    }
  } finally {
    await targetPool.end();
    if (originPool) await originPool.end();
  }
}

if (require.main === module) {
  runValidation().catch((err) => {
    console.error('Erro na migração/validação:', err);
    process.exit(1);
  });
}

module.exports = { runValidation };
