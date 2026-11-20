# MediCare — Banco de Dados & Migrações

Este diretório centraliza os scripts SQL versionados do banco de dados relacional **PostgreSQL 16 (`medicare_db`)**, hospedado de forma isolada na infraestrutura **Oracle Cloud** (`127.0.0.1:5436`).

## Estrutura de Migrações (`migrations/`)

- `02_schema_oracle_standalone.sql`: Esquema completo standalone (`app_users`, `auth_sessions`, `profiles`, `medicamentos`, `historico_doses`, `caregiver_relationships`, `audit_logs`, `health_events`, `stock_movements`, `approval_requests`, `notificacoes`, `push_subscriptions` e triggers/funções RBAC).
- `03_incremental_compatibility.sql`: Migração incremental não destrutiva que consolida colunas de rastreabilidade (`administered_at`, `confirmed_by_role`, `origin`, `atraso_minutos`), tabelas de validação/notificação e registro de versão em `schema_migrations`.
- `04_caregiver_management_settings.sql`: Cria a tabela `patient_care_settings` para o Painel de Gerenciamento do cuidador (tempo para alerta de atraso, confirmação obrigatória no horário/pós-perdida/desfazer, janela de dose perdida, edição pelo paciente, alertas de estoque baixo e SOS).
- `05_caregiver_groups_and_global_settings.sql`: Cria `caregiver_global_settings` e `caregiver_patient_groups` e adiciona `config_mode` (`global` | `group` | `custom`), `group_id` e `caregiver_id` em `patient_care_settings` para gerenciamento de clínicas e grupos.

## Execução Controlada

Use o utilitário explícito `scripts/run_migrations.js`:

```bash
# Verificar tabelas e versão (somente leitura)
node scripts/run_migrations.js --check

# Aplicar migrações pendentes (03, 04 e 05) carregando o .env ativo
set -a && for f in .env .env.production .env.local; do if [ -f "$f" ]; then . "./$f"; fi; done && set +a
node scripts/run_migrations.js --apply
```

## Infraestrutura de Produção

Os scripts complementares de container, systemd, Nginx e rollback estão em `/oracle-migration/`:
- `docker-compose.oracle.yml`
- `01_oracle_audit_and_isolation.sh`
- `05_oracle_systemd_and_rollback.md`
- `start_backend.sh`
