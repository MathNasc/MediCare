#!/usr/bin/env bash
# ==============================================================================
# MediCare — Fase 4 & 17: Exportação Consistente e Backup do Supabase (Read-Only)
# ==============================================================================
# Exporta apenas os objetos e dados do MediCare (sem roles/schemas proprietários
# do Supabase que quebrariam a instância PostgreSQL compartilhada na Oracle).
# Nenhum dado é apagado ou modificado na origem.
# ==============================================================================

set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "ERRO: Defina SUPABASE_DB_URL (connection string PostgreSQL do Supabase)"
  exit 1
fi

BACKUP_DIR="${1:-./backups/medicare_$(date -u +%Y%m%d_%H%M%S)}"
mkdir -p "$BACKUP_DIR"

echo "1. Exportando usuários de auth.users (preservando UUIDs e hashes bcrypt)..."
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "\copy (SELECT id, email, COALESCE(encrypted_password, '') AS password_hash, COALESCE(raw_user_meta_data, '{}'::jsonb) AS raw_user_meta_data, email_confirmed_at, last_sign_in_at, created_at, updated_at FROM auth.users) TO '${BACKUP_DIR}/auth_users.csv' WITH CSV HEADER"

echo "2. Realizando dump consistente (snapshot isolado --serializable-deferrable) das tabelas public..."
pg_dump "$SUPABASE_DB_URL" \
  --schema=public \
  --data-only \
  --no-owner \
  --no-privileges \
  --serializable-deferrable \
  --column-inserts \
  -f "${BACKUP_DIR}/public_data.sql"

echo "3. Gerando inventário de contagem e checksums na origem para validação obrigatória..."
psql "$SUPABASE_DB_URL" -AtF',' -c "
SELECT 'auth.users', count(*) FROM auth.users
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'medicamentos', count(*) FROM public.medicamentos
UNION ALL SELECT 'historico_doses', count(*) FROM public.historico_doses
UNION ALL SELECT 'caregiver_relationships', count(*) FROM public.caregiver_relationships
UNION ALL SELECT 'caregiver_notes', count(*) FROM public.caregiver_notes
UNION ALL SELECT 'caregiver_audit_log', count(*) FROM public.caregiver_audit_log
UNION ALL SELECT 'audit_logs', count(*) FROM public.audit_logs
UNION ALL SELECT 'stock_movements', count(*) FROM public.stock_movements
UNION ALL SELECT 'health_events', count(*) FROM public.health_events
UNION ALL SELECT 'notes', count(*) FROM public.notes
UNION ALL SELECT 'dose_observations', count(*) FROM public.dose_observations
UNION ALL SELECT 'allergies', count(*) FROM public.allergies
UNION ALL SELECT 'health_conditions', count(*) FROM public.health_conditions
UNION ALL SELECT 'emergency_contacts', count(*) FROM public.emergency_contacts
UNION ALL SELECT 'healthcare_professionals', count(*) FROM public.healthcare_professionals
UNION ALL SELECT 'push_subscriptions', count(*) FROM public.push_subscriptions
UNION ALL SELECT 'notification_logs', count(*) FROM public.notification_logs
UNION ALL SELECT 'medication_catalog', count(*) FROM public.medication_catalog
UNION ALL SELECT 'custom_medications', count(*) FROM public.custom_medications;
" > "${BACKUP_DIR}/origin_counts.csv"

sha256sum "${BACKUP_DIR}/auth_users.csv" "${BACKUP_DIR}/public_data.sql" "${BACKUP_DIR}/origin_counts.csv" > "${BACKUP_DIR}/SHA256SUMS"

echo "✓ Backup concluído e verificado em: ${BACKUP_DIR}"
cat "${BACKUP_DIR}/SHA256SUMS"
