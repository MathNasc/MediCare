#!/usr/bin/env bash
# ==============================================================================
# MediCare — Auto-Pull & Build Automático no Servidor Oracle Cloud
# ==============================================================================
# Verifica novos commits no GitHub a cada ciclo. Se houver atualizações,
# executa git pull, compila o Next.js e reinicia o serviço medicare-backend.
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/auto_pull.log"

cd "$PROJECT_ROOT"

if [ ! -d ".git" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') - [ERRO] Repositório Git não encontrado em $PROJECT_ROOT" >> "$LOG_FILE"
  exit 1
fi

git fetch origin main >/dev/null 2>&1 || exit 0

LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse origin/main)

if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
  echo "==========================================================" >> "$LOG_FILE"
  echo "$(date '+%Y-%m-%d %H:%M:%S') - [NOVA ATUALIZAÇÃO DETECTADA]" >> "$LOG_FILE"
  echo "Hash local:  $LOCAL_HASH" >> "$LOG_FILE"
  echo "Hash remoto: $REMOTE_HASH" >> "$LOG_FILE"

  git stash >/dev/null 2>&1 || true
  git pull origin main >> "$LOG_FILE" 2>&1

  echo "$(date '+%Y-%m-%d %H:%M:%S') - Instalando dependências e recompilando..." >> "$LOG_FILE"
  npm install --include=dev >> "$LOG_FILE" 2>&1
  npm run build >> "$LOG_FILE" 2>&1

  if command -v systemctl >/dev/null 2>&1 && sudo systemctl is-active --quiet medicare-backend 2>/dev/null; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Reiniciando serviço medicare-backend..." >> "$LOG_FILE"
    sudo systemctl restart medicare-backend >> "$LOG_FILE" 2>&1
  fi

  echo "$(date '+%Y-%m-%d %H:%M:%S') - [✓ SUCESSO] Backend atualizado para commit $REMOTE_HASH" >> "$LOG_FILE"
fi
