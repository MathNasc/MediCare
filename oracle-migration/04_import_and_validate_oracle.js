/**
 * MediCare — Fase 4, 6 & 17: Validação Obrigatória de Dados (Origem vs Destino Oracle)
 * e Reconciliação para Cutover/Rollback Seguro.
 *
 * Uso:
 *   SUPABASE_DB_URL="postgresql://..." ORACLE_DB_URL="postgresql://..." node oracle-migration/04_import_and_validate_oracle.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const TABLES_TO_VALIDATE = [
  { name: 'profiles', pk: 'id' },
  { name: 'roles', pk: 'code' },
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
  { name: 'medication_catalog', pk: 'id' },
  { name: 'custom_medications', pk: 'id' },
];

async function runValidation() {
  const originUrl = process.env.SUPABASE_DB_URL;
  const targetUrl = process.env.ORACLE_DB_URL || process.env.DATABASE_URL;

  if (!targetUrl) {
    console.error('Defina ORACLE_DB_URL (ou DATABASE_URL) apontando para o medicare_db na Oracle.');
    process.exit(1);
  }

  const targetPool = new Pool({ connectionString: targetUrl });
  const originPool = originUrl ? new Pool({ connectionString: originUrl }) : null;

  const report = {
    timestamp: new Date().toISOString(),
    status: 'PASS',
    tables: {},
    semanticChecks: {},
    discrepancies: [],
  };

  try {
    for (const tbl of TABLES_TO_VALIDATE) {
      const targetCountRes = await targetPool.query(`SELECT count(*)::int AS cnt FROM public.${tbl.name}`);
      const targetCount = targetCountRes.rows[0].cnt;

      let originCount = null;
      if (originPool) {
        const originCountRes = await originPool.query(`SELECT count(*)::int AS cnt FROM public.${tbl.name}`);
        originCount = originCountRes.rows[0].cnt;
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
    console.log('Relatório de validação salvo em:', outPath);
    console.log('Status Global:', report.status);
  } finally {
    await targetPool.end();
    if (originPool) await originPool.end();
  }
}

if (require.main === module) {
  runValidation().catch((err) => {
    console.error('Erro na validação:', err);
    process.exit(1);
  });
}

module.exports = { runValidation };
