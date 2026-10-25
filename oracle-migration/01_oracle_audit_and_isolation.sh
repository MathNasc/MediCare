#!/usr/bin/env bash
# ==============================================================================
# MediCare — Fase 1 & 3: Auditoria Não-Destrutiva e Isolamento no Servidor Oracle
# ==============================================================================
# REGRA DE OURO: Este script é 100% SOMENTE LEITURA por padrão.
# Ele NÃO reinicia serviços, NÃO altera firewall, NÃO modifica outros bancos
# e NÃO toca em containers ou configurações de outros projetos.
# ==============================================================================

set -euo pipefail

MODE="${1:---audit}"

echo "======================================================================"
echo " MEDICARE — AUDITORIA DE INFRAESTRUTURA ORACLE CLOUD (READ-ONLY)"
echo " Data/Hora: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "======================================================================"

echo ""
echo "[1/8] Sistema Operacional e Kernel:"
uname -a
if [ -f /etc/os-release ]; then
  grep -E "^(NAME|VERSION)=" /etc/os-release || true
fi

echo ""
echo "[2/8] Recursos de Hardware (CPU, RAM, Swap — Limites Oracle Free Tier):"
lscpu | grep -E "Model name|CPU\(s\)|Architecture" || true
free -h

echo ""
echo "[3/8] Espaço em Disco e Volumes:"
df -h -x tmpfs -x devtmpfs

echo ""
echo "[4/8] Instâncias PostgreSQL em Execução e Versões:"
pg_isready || echo "Aviso: pg_isready não respondeu na porta local padrão."
ps aux | grep -E "[p]ostgres|[p]ostmaster" || echo "Nenhum processo postgres nativo visível."
if command -v psql >/dev/null 2>&1; then
  psql --version
fi

echo ""
echo "[5/8] Bancos de Dados e Roles Existentes (Listagem Segura):"
if sudo -n -u postgres psql -Atc "SELECT datname FROM pg_database WHERE datistemplate = false;" >/dev/null 2>&1; then
  echo "Bancos existentes na instância local:"
  sudo -u postgres psql -Atc "SELECT ' - ' || datname || ' (owner: ' || pg_catalog.pg_get_userbyid(datdba) || ')' FROM pg_database WHERE datistemplate = false;"
  echo "Usuários/Roles existentes:"
  sudo -u postgres psql -Atc "SELECT ' - ' || rolname FROM pg_roles WHERE rolcanlogin = true;"
else
  echo "Info: Execute com permissões adequadas para listar os bancos existentes via sudo -u postgres."
fi

echo ""
echo "[6/8] Containers Docker em Execução (Outros Projetos):"
if command -v docker >/dev/null 2>&1; then
  docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" || true
else
  echo "Docker não instalado ou não utilizado."
fi

echo ""
echo "[7/8] Portas TCP em Escuta (Prevenção de Conflitos):"
ss -tulnp | grep LISTEN || netstat -tulnp | grep LISTEN || true

echo ""
echo "[8/8] Reverse Proxy (Nginx / Caddy / Apache) e Systemd Timers:"
systemctl is-active nginx 2>/dev/null && echo "Nginx: ATIVO" || echo "Nginx: inativo/ausente"
systemctl is-active caddy 2>/dev/null && echo "Caddy: ATIVO" || echo "Caddy: inativo/ausente"
systemctl is-active postgresql 2>/dev/null && echo "PostgreSQL service: ATIVO" || echo "PostgreSQL service: inativo/containerizado"

if [ "$MODE" = "--prepare-isolated-db" ]; then
  echo ""
  echo "======================================================================"
  echo " PREPARAÇÃO ISOLADA DO BANCO medicare_db E USUÁRIO medicare_app"
  echo "======================================================================"
  if [ -z "${MEDICARE_DB_PASSWORD:-}" ]; then
    echo "ERRO: Defina a variável MEDICARE_DB_PASSWORD antes de executar --prepare-isolated-db"
    exit 1
  fi

  DB_NAME="${MEDICARE_DB_NAME:-medicare_db}"
  DB_USER="${MEDICARE_DB_USER:-medicare_app}"

  sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${MEDICARE_DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    RAISE NOTICE 'Role ${DB_USER} criada com sucesso.';
  ELSE
    RAISE NOTICE 'Role ${DB_USER} já existe — nenhuma alteração destrutiva realizada.';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER} ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

-- Isolamento estrito: revoga acesso público e restringe permissões apenas ao medicare_db
REVOKE ALL ON DATABASE ${DB_NAME} FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE ${DB_NAME} TO ${DB_USER};
EOSQL

  sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 <<EOSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${DB_USER};
EOSQL

  echo "✓ Banco '${DB_NAME}' e usuário '${DB_USER}' preparados com isolamento total!"
fi
