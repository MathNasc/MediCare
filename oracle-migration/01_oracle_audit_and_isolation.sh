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
  echo " PREPARAÇÃO ISOLADA DO CONTAINER medicare_db (PORTA 5436)"
  echo "======================================================================"
  if [ -z "${MEDICARE_DB_PASSWORD:-}" ]; then
    echo ""
    read -rsp "Digite a senha que deseja para o banco medicare_app (sem caracteres vazios): " MEDICARE_DB_PASSWORD
    echo ""
    if [ -z "${MEDICARE_DB_PASSWORD}" ]; then
      echo "ERRO: Nenhuma senha foi informada."
      exit 1
    fi
  fi

  DB_NAME="${MEDICARE_DB_NAME:-medicare_db}"
  DB_USER="${MEDICARE_DB_USER:-medicare_app}"
  DB_PORT="${MEDICARE_DB_PORT:-5436}"
  CONTAINER_NAME="medicare_db"
  VOLUME_NAME="medicare_pgdata"

  # Verifica se a porta 5436 está livre (caso o container ainda não exista)
  if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    if ss -tuln | grep -q ":${DB_PORT} "; then
      echo "ERRO: A porta ${DB_PORT} já está em uso. Escolha outra via MEDICARE_DB_PORT."
      exit 1
    fi

    echo "Criando volume isolado ${VOLUME_NAME} e container ${CONTAINER_NAME} (postgres:16-alpine na porta ${DB_PORT})..."
    docker volume create "${VOLUME_NAME}" >/dev/null
    docker run -d \
      --name "${CONTAINER_NAME}" \
      --restart unless-stopped \
      --memory="256m" \
      --cpus="0.5" \
      -e POSTGRES_DB="${DB_NAME}" \
      -e POSTGRES_USER="${DB_USER}" \
      -e POSTGRES_PASSWORD="${MEDICARE_DB_PASSWORD}" \
      -e TZ="America/Sao_Paulo" \
      -p "127.0.0.1:${DB_PORT}:5432" \
      -v "${VOLUME_NAME}:/var/lib/postgresql/data" \
      postgres:16-alpine \
      postgres -c shared_buffers=64MB -c max_connections=50 -c work_mem=4MB
  else
    echo "Container ${CONTAINER_NAME} já existe. Garantindo que está em execução..."
    docker start "${CONTAINER_NAME}" >/dev/null || true
  fi

  echo "Aguardando ${CONTAINER_NAME} inicializar e aceitar comandos SQL..."
  READY=0
  for i in {1..30}; do
    if docker exec "${CONTAINER_NAME}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
      if docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" >/dev/null 2>&1; then
        READY=1
        break
      fi
    fi
    sleep 2
  done

  if [ "$READY" -ne 1 ]; then
    echo "Aviso: Container demorando a responder. Aguardando mais 5 segundos..."
    sleep 5
  fi

  echo "Aplicando isolamento de permissões e extensões (uuid-ossp, pgcrypto)..."
  MAX_TRIES=5
  for ((t=1; t<=MAX_TRIES; t++)); do
    if docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 <<EOSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
REVOKE ALL ON DATABASE ${DB_NAME} FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE ${DB_NAME} TO ${DB_USER};
EOSQL
    then
      break
    fi
    echo "Tentativa $t de $MAX_TRIES falhou (possível reinicialização pós-initdb). Aguardando 3s..."
    sleep 3
  done

  if [ -f "oracle-migration/02_schema_oracle_standalone.sql" ]; then
    echo "Aplicando schema standalone completo do MediCare (02_schema_oracle_standalone.sql)..."
    docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 < oracle-migration/02_schema_oracle_standalone.sql
  fi

  echo ""
  echo "======================================================================"
  echo "✓ SUCESSO: Container '${CONTAINER_NAME}' está ativo em 127.0.0.1:${DB_PORT}"
  echo "✓ Banco '${DB_NAME}' e Usuário '${DB_USER}' prontos e 100% isolados!"
  echo "======================================================================"
fi

