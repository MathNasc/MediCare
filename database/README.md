# MediCare — Banco de Dados & Migrações

Este diretório centraliza a documentação e os scripts de migração do banco de dados relacional **PostgreSQL** hospedado na infraestrutura **Oracle Cloud**.

## Estrutura

- `migrations/`: Scripts SQL canônicos de criação e evolução do esquema do banco de dados.
  - `02_schema_oracle_standalone.sql`: Esquema completo standalone (`app_users`, `patients`, `medications`, `prescriptions`, `doses`, `dose_history`, `appointments`, `audit_logs`, views e triggers de RBAC).

## Infraestrutura de Produção

Os scripts de execução direta com Docker e Systemd no servidor Oracle Cloud permanecem disponíveis e compatíveis também em `/oracle-migration/`:
- `docker-compose.oracle.yml`
- `01_oracle_audit_and_isolation.sh`
- `start_backend.sh`
