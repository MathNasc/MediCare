#!/usr/bin/env bash
# ==============================================================================
# MediCare — Auto-Pull & Build Automático no Servidor Oracle Cloud
# ==============================================================================
# Verifica novos commits no GitHub a cada ciclo. Se houver atualizações,
# sincroniza o código, compila o Next.js e reinicia o serviço medicare-backend.
# ==============================================================================

set -e

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/auto_pull.log"
LOCK_FILE="/tmp/medicare_auto_pull.lock"
STATE_FILE="${PROJECT_ROOT}/.last_built_commit"

# Evita execuções simultâneas caso um build demore mais de 2 minutos
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

cd "$PROJECT_ROOT"

if [ ! -d ".git" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') - [ERRO] Repositório Git não encontrado em $PROJECT_ROOT" >> "$LOG_FILE"
  exit 1
fi

git fetch origin main >/dev/null 2>&1 || exit 0

REMOTE_HASH=$(git rev-parse origin/main)
LAST_BUILT_HASH=""
if [ -f "$STATE_FILE" ]; then
  LAST_BUILT_HASH=$(cat "$STATE_FILE" 2>/dev/null || true)
else
  LAST_BUILT_HASH=$(git rev-parse HEAD 2>/dev/null || true)
fi

LOCAL_HASH=$(git rev-parse HEAD)

if [ "$LOCAL_HASH" != "$REMOTE_HASH" ] || [ "$LAST_BUILT_HASH" != "$REMOTE_HASH" ]; then
  echo "==========================================================" >> "$LOG_FILE"
  echo "$(date '+%Y-%m-%d %H:%M:%S') - [NOVA ATUALIZAÇÃO DETECTADA]" >> "$LOG_FILE"
  echo "Hash local:  $LOCAL_HASH" >> "$LOG_FILE"
  echo "Hash remoto: $REMOTE_HASH" >> "$LOG_FILE"

  # Verifica se package.json mudou entre os commits para só rodar npm install se necessário
  PKG_CHANGED=0
  if ! git diff --quiet "$LOCAL_HASH" "$REMOTE_HASH" -- package.json 2>/dev/null; then
    PKG_CHANGED=1
  fi

  git reset --hard origin/main >> "$LOG_FILE" 2>&1

  if [ "$PKG_CHANGED" -eq 1 ] || [ ! -d "node_modules" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Atualizando dependências (npm install)..." >> "$LOG_FILE"
    npm install --include=dev >> "$LOG_FILE" 2>&1
  fi

  echo "$(date '+%Y-%m-%d %H:%M:%S') - Compilando aplicação (npm run build)..." >> "$LOG_FILE"
  npm run build >> "$LOG_FILE" 2>&1

  echo "$(date '+%Y-%m-%d %H:%M:%S') - Reiniciando serviço medicare-backend..." >> "$LOG_FILE"
  sudo -n systemctl restart medicare-backend >> "$LOG_FILE" 2>&1 || systemctl restart medicare-backend >> "$LOG_FILE" 2>&1

  echo "$REMOTE_HASH" > "$STATE_FILE"
  echo "$(date '+%Y-%m-%d %H:%M:%S') - [✓ SUCESSO] Backend atualizado e reiniciado para commit $REMOTE_HASH" >> "$LOG_FILE"
fi

