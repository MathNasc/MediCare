# Auditoria Técnica do Backend — MediCare

**Versão:** 2.1 (Atualizada)  
**Contexto:** Integração consolidada entre o **MediCare Paciente Android**, o **MediCare Cuidador Web/Android** (`src/app/cuidador/page.jsx`) e o banco **PostgreSQL 16 na Oracle Cloud (`medicare_db`)**.

---

## 1. Arquitetura e Tecnologias

- **Runtime & Framework:** Node.js com Next.js 14 (App Router) servindo o Portal (`/`), o Painel do Cuidador (`/cuidador`) e as APIs compartilhadas (`/api/*`).
- **Banco de Dados:** PostgreSQL 16 standalone na Oracle Cloud (`medicare_db`).
- **Inicialização e Migrações (`src/lib/oraclePostgres.js`):**
  1. `verifyDatabaseConnection(client)`: Verifica conectividade com `SELECT 1`.
  2. `verifySchemaVersion(client)`: Consulta `schema_migrations` e tabelas essenciais em modo somente leitura, sem executar DDL em requisições HTTP.
  3. `runDatabaseMigrations(client, { authorized: true })`: Aplica migrações versionadas (`03`, `04` e `05`) dentro de transações explícitas.
  4. `ensureOraclePostgresSchema(client)`: Apenas valida prontidão do esquema durante requisições normais.
- **Fallback Proxy Anti-Loop (`src/lib/oracleProxy.js`):**
  - `connectPgOrFallback(req, targetPath)` usa conexão direta ao PostgreSQL quando acessível e encaminha automaticamente para `ORACLE_BACKEND_URL` caso o banco local não esteja configurado ou ocorra timeout/bloqueio TCP na porta `5432` (ex.: previews externos), impedindo loops por cabeçalho `x-medicare-proxy-hop: 1` e comparação de host.
- **Segurança de Autenticação (`src/lib/oracleAuth.js`):**
  - Cookies `HttpOnly`, `Secure`, `SameSite=Lax` + `X-CSRF-Token` timing-safe e checagem de `Origin`.
  - Compatibilidade integral com `Authorization: Bearer <jwt>` para o app Android.
  - Isolamento de sessões via `sid` na tabela `auth_sessions`.

---

## 2. Mapa de Endpoints Validados

### 2.1. Autenticação (`/api/auth/v1/[...action]`)
| Método | Rota | Descrição | Status |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/v1/signup` | Cadastro com criação de sessão isolada (`auth_sessions`) e cookies `HttpOnly`. | Validada |
| `POST` | `/api/auth/v1/token?grant_type=password` | Login `pgcrypto`, emissão de JWT (`sid`) e cookies `HttpOnly` + CSRF. | Validada |
| `POST` | `/api/auth/v1/token?grant_type=refresh_token` | Renovação rotativa via cookie `HttpOnly` ou corpo JSON. | Validada |
| `GET` | `/api/auth/v1/user` | Valida JWT e sessão ativa em `auth_sessions`. | Validada |
| `PUT` | `/api/auth/v1/user` | Atualização de perfil/senha com proteção CSRF. | Validada |
| `POST` | `/api/auth/v1/logout` | Revogação isolada da sessão `sid` e limpeza de cookies. | Validada |
| `POST` / `DELETE` | `/api/auth/v1/delete-account` | Exclusão autenticada de conta própria ou paciente gerenciado. | Validada |

### 2.2. Roteador REST (`/api/rest/v1/[...slug]`) e RPCs
Todas as tabelas e RPCs validam vínculo ativo (`caregiver_relationships.status = 'active'`) e nível de permissão (`viewer`/`read_only` vs `caregiver`/`read_write`/`admin`):
- Tabelas: `profiles`, `medicamentos`, `historico_doses`, `health_events`, `notes`, `calendar_notes`, `stock_movements`, `approval_requests`, `notificacoes`, `audit_logs`, `push_subscriptions`, `notification_logs`, `caregiver_relationships`, `caregiver_notes`, `allergies`, `health_conditions`, `emergency_contacts`, `healthcare_professionals`.
- RPCs: `confirm_dose_retroactive`, `record_dose_administration`, `resolve_dose_approval`, `create_managed_patient`, `accept_caregiver_invite`, `revoke_caregiver`, `record_stock_movement`, `get_stock_forecast`, `get_all_stock_forecasts`, `list_audit_logs`, `get_patient_summary`, `get_treatment_dashboard`.

### 2.3. Gerenciamento, Notificações, Sincronização e Distribuição
| Rota | Finalidade | Status |
| :--- | :--- | :--- |
| `GET`/`PUT`/`PATCH`/`POST`/`DELETE` `/api/v1/caregiver/settings` | Regras Globais (`caregiver_global_settings`), Grupos (`caregiver_patient_groups`) e regras por paciente (`patient_care_settings`) com herança e atribuição em lote. | Validada |
| `GET`/`PATCH` `/api/v1/caregiver/notifications` | Alertas do cuidador (solicitações de dose, atrasos, SOS) e marcação de leitura. | Validada |
| `GET`/`POST`/`DELETE` `/api/v1/sync` | Sincronização bidirecional Android preservando `care_settings`, `confirmed_by_role`, `origin`, `atraso_minutos` e `administered_at`. | Validada |
| `POST` `/api/v1/jobs/reminders` & `/api/v1/jobs/alert-caregiver` | Alertas automáticos de atraso configuráveis por `overdue_notify_minutes` e disparo Web Push (`web-push`). | Validada |
| `GET` `/api/v1/health` | Saúde do PostgreSQL local ou status do upstream Oracle via proxy. | Validada |
| `GET` `/api/system/versions`, `/api/apk`, `/api/apk/cuidador`, `/api/apk/version` | Metadados de versão e download dos APKs assinados de Paciente e Cuidador. | Validada |
