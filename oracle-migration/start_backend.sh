#!/usr/bin/env bash
# ==============================================================================
# MediCare — Ativação do Backend Compartilhado no Servidor Oracle (Porta 3009)
# ==============================================================================
# Inicia o backend conectado diretamente ao medicare_db (127.0.0.1:5436).
# Configura systemd para inicialização automática após reinicializações.
# ==============================================================================

set +H
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "======================================================================"
echo " MEDICARE — INICIALIZAÇÃO DO BACKEND (PORTA 3009) NA ORACLE CLOUD"
echo "======================================================================"

# 1. Garante que medicare_db está rodando
if ! docker ps --format '{{.Names}}' | grep -q "^medicare_db$"; then
  echo "Iniciando container medicare_db..."
  docker start medicare_db || true
fi

# 1.1 Garante Node.js >= 20 para Next.js
CURRENT_NODE_MAJOR=$(node -v 2>/dev/null | sed -E 's/v([0-9]+).*/\1/' || echo "0")
if [ "$CURRENT_NODE_MAJOR" -lt 20 ]; then
  echo "Node.js atual é $(node -v 2>/dev/null || echo 'desconhecido'). Next.js requer Node.js >= 20.9.0."
  if command -v sudo >/dev/null 2>&1; then
    echo "Atualizando Node.js para versão 20 LTS via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "✓ Node.js atualizado: $(node -v)"
  else
    echo "AVISO: Node.js está abaixo da versão 20 e não foi possível rodar sudo para atualizar automaticamente."
  fi
fi

# 2. Configura .env.production se não existir
ENV_PROD="${PROJECT_ROOT}/.env.production"
if [ ! -f "$ENV_PROD" ]; then
  echo "Arquivo .env.production não encontrado. Configurando ambiente de produção..."

  if [ -z "${MEDICARE_DB_PASSWORD:-}" ]; then
    read -rsp "Informe a senha do usuário 'medicare_app' no banco da Oracle: " MEDICARE_DB_PASSWORD
    echo ""
    if [ -z "$MEDICARE_DB_PASSWORD" ]; then
      echo "ERRO: A senha não pode ser vazia."
      exit 1
    fi
  fi

  cat > "$ENV_PROD" <<EOF
PORT=3009
NODE_ENV=production
DATABASE_URL=postgresql://medicare_app:${MEDICARE_DB_PASSWORD}@127.0.0.1:5436/medicare_db
ORACLE_PG_HOST=127.0.0.1
ORACLE_PG_PORT=5436
ORACLE_PG_DATABASE=medicare_db
ORACLE_PG_USER=medicare_app
ORACLE_PG_PASSWORD=${MEDICARE_DB_PASSWORD}
ORACLE_PG_SSL=false
NEXT_PUBLIC_APP_URL=http://144.22.160.191:3009
BACKEND_API_KEY=medicare_mobile_client
EOF
  chmod 600 "$ENV_PROD"
  echo "✓ Arquivo .env.production gerado com permissões restritas (chmod 600)."
fi

# 3. Compila a aplicação Next.js para produção
echo ""
echo "Compilando backend (npm run build)..."
npm run build

# 4. Configura serviço Systemd permanente se tiver permissão sudo
SERVICE_FILE="/etc/systemd/system/medicare-backend.service"
if command -v sudo >/dev/null 2>&1; then
  echo ""
  echo "Instalando serviço systemd 'medicare-backend' para execução contínua..."
  sudo bash -c "cat > '$SERVICE_FILE'" <<EOF
[Unit]
Description=MediCare Shared Backend (Paciente Android + Cuidador Web)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=${PROJECT_ROOT}
EnvironmentFile=${PROJECT_ROOT}/.env.production
Environment=PORT=3009
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start -- -p 3009 -H 0.0.0.0
Restart=always
RestartSec=5
MemoryMax=384M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable medicare-backend
  sudo systemctl restart medicare-backend

  # Libera a porta 3009 no firewall local do Ubuntu se iptables/ufw estiverem ativos
  sudo iptables -I INPUT -p tcp --dport 3009 -j ACCEPT 2>/dev/null || true
  sudo ufw allow 3009/tcp 2>/dev/null || true

  echo "Aguardando backend inicializar..."
  sleep 4

  echo ""
  echo "Verificando integridade da API (/api/v1/health):"
  curl -sS http://127.0.0.1:3009/api/v1/health || true
  echo ""
  echo "======================================================================"
  echo "✓ Backend MediCare ativo em: http://144.22.160.191:3009"
  echo "✓ Status do serviço: sudo systemctl status medicare-backend"
  echo "======================================================================"
else
  echo ""
  echo "Iniciando backend em primeiro plano na porta 3009..."
  npm run start -- -p 3009 -H 0.0.0.0
fi
