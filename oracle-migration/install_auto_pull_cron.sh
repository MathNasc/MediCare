#!/usr/bin/env bash
# ==============================================================================
# MediCare — Instalador do Auto-Pull Automático no Servidor Oracle Cloud
# ==============================================================================
# Configura o script auto_pull_sync.sh para rodar periodicamente a cada 2 minutos
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

# 1. Configura permissão para o usuário ubuntu reiniciar o medicare-backend sem senha
if command -v sudo >/dev/null 2>&1; then
  echo "Configurando permissão de restart no systemctl para usuário ubuntu..."
  SUDOERS_FILE="/etc/sudoers.d/medicare-nopasswd"
  sudo bash -c "cat > '$SUDOERS_FILE'" <<EOF
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart medicare-backend, /bin/systemctl restart medicare-backend
EOF
  sudo chmod 440 "$SUDOERS_FILE"
  echo "✓ Regra de sudoers configurada sem necessidade de senha para o backend."
fi

# 2. Registra o cron job a cada 2 minutos
CRON_CMD="*/2 * * * * /bin/bash ${SYNC_SCRIPT} >/dev/null 2>&1"

(crontab -l 2>/dev/null | grep -v "auto_pull_sync.sh"; echo "$CRON_CMD") | crontab -

echo ""
echo "======================================================================"
echo "✓ AUTO-PULL CONFIGURADO COM SUCESSO!"
echo "• Frequência de verificação: A cada 2 minutos."
echo "• Script executado: ${SYNC_SCRIPT}"
echo "• Log de atualizações: ${PROJECT_ROOT}/auto_pull.log"
echo "======================================================================"
