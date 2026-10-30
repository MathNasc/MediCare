#!/usr/bin/env bash
# ==============================================================================
# MediCare — Instalador do Auto-Pull Automático no Servidor Oracle Cloud
# ==============================================================================
# Configura o script auto_pull_sync.sh para rodar periodicamente a cada 1 minuto
# no crontab do usuário e permite reinício do serviço sem solicitar senha.
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SYNC_SCRIPT="${SCRIPT_DIR}/auto_pull_sync.sh"

echo "======================================================================"
echo " MEDICARE — INSTALAÇÃO DO AUTO-PULL AUTOMÁTICO (ORACLE CLOUD)"
echo "======================================================================"

chmod +x "$SYNC_SCRIPT"

# 1. Configura permissão para o usuário ubuntu gerenciar o medicare-backend sem senha
if command -v sudo >/dev/null 2>&1; then
  echo "Configurando permissão de restart no systemctl para usuário $(whoami)..."
  CURRENT_USER="$(whoami)"
  SUDOERS_FILE="/etc/sudoers.d/medicare-nopasswd"
  sudo bash -c "cat > '$SUDOERS_FILE'" <<EOF
${CURRENT_USER} ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart medicare-backend, /bin/systemctl restart medicare-backend, /usr/bin/systemctl status medicare-backend, /bin/systemctl status medicare-backend, /usr/bin/systemctl is-active medicare-backend, /bin/systemctl is-active medicare-backend
EOF
  sudo chmod 440 "$SUDOERS_FILE"
  sudo systemctl enable --now cron 2>/dev/null || true
  echo "✓ Regra de sudoers e serviço cron ativos."
fi

# 2. Registra o cron job a cada 1 minuto (protegido por flock contra concorrência)
CRON_CMD="* * * * * /bin/bash ${SYNC_SCRIPT} >/dev/null 2>&1"

(crontab -l 2>/dev/null | grep -v "auto_pull_sync.sh"; echo "$CRON_CMD") | crontab -

# 3. Força sincronização, build e restart imediato agora
echo "Executando sincronização e build imediato..."
rm -f "${PROJECT_ROOT}/.last_built_commit"
/bin/bash "$SYNC_SCRIPT"

echo ""
echo "======================================================================"
echo "✓ AUTO-PULL CONFIGURADO E SINCRONIZADO COM SUCESSO!"
echo "• Frequência de verificação: A cada 1 minuto (com proteção flock)."
echo "• Script executado: ${SYNC_SCRIPT}"
echo "• Log de atualizações: tail -f ${PROJECT_ROOT}/auto_pull.log"
echo "======================================================================"

