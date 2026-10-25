#!/usr/bin/env bash
# ==============================================================================
# MediCare — Assistente Automatizado de Migração de Dados
# ==============================================================================
# Trata automaticamente caracteres especiais (!, @, #, etc.) nas senhas
# e instala as dependências necessárias (pg) caso não existam.
# ==============================================================================

set +H # Desativa expansão de histórico do bash para proteger senhas com '!'
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "======================================================================"
echo " MEDICARE — MIGRAÇÃO DE DADOS (SUPABASE -> ORACLE CLOUD)"
echo "======================================================================"

# 1. Verifica Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "ERRO: Node.js não foi encontrado no servidor."
  exit 1
fi

# 2. Verifica se a biblioteca 'pg' está instalada no diretório
if ! node -e "require('pg')" >/dev/null 2>&1; then
  echo "Instalando dependência necessária (pg)..."
  npm install pg --no-audit --no-fund --loglevel=error
  echo "✓ Dependência 'pg' instalada com sucesso."
fi

# 3. Solicita a URL do Supabase caso não esteja definida
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo ""
  echo "Por favor, informe a URL do Supabase (ex: postgresql://postgres:senha@db.ref.supabase.co:5432/postgres):"
  read -r RAW_SUPABASE_URL
  # Remove espaços no início e no final, e aspas se houver
  SUPABASE_DB_URL="$(echo "$RAW_SUPABASE_URL" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
fi

if [ -z "$SUPABASE_DB_URL" ]; then
  echo "ERRO: A URL do Supabase não pode ser vazia."
  exit 1
fi

# 4. Solicita a senha do Oracle medicare_app caso ORACLE_DB_URL não esteja definida
if [ -z "${ORACLE_DB_URL:-}" ]; then
  echo ""
  echo "Digite a senha do usuário 'medicare_app' no banco da Oracle:"
  read -rsp "Senha: " ORACLE_PASS
  echo ""
  if [ -z "$ORACLE_PASS" ]; then
    echo "ERRO: A senha não pode ser vazia."
    exit 1
  fi
  ORACLE_DB_URL="postgresql://medicare_app:${ORACLE_PASS}@127.0.0.1:5436/medicare_db"
fi

export SUPABASE_DB_URL
export ORACLE_DB_URL

echo ""
echo "Iniciando migração de usuários e tabelas com validação de paridade..."
node oracle-migration/04_import_and_validate_oracle.js --migrate
