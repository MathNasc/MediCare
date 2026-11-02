# Auditoria Técnica do Backend — MediCare

**Versão:** 2.0 (Consolidada)  
**Contexto:** Integração consolidada entre o **MediCare Paciente Android**, o **MediCare Cuidador Web** (`src/app/cuidador/page.jsx`) e o banco **PostgreSQL 16 na Oracle Cloud**.

---

## 1. Arquitetura e Tecnologias

- **Runtime & Framework:** Node.js com Next.js 14 (App Router) servindo tanto a aplicação oficial do Cuidador (`/cuidador`), o Portal (`/`) e as rotas REST/RPC (`/api/*`).
- **Banco de Dados:** PostgreSQL 16 standalone na Oracle Cloud (`medicare_db`).
- **Inicialização e Migrações (`src/lib/oraclePostgres.js`):**
  - **Separação de Responsabilidades:**
    1. `verifyDatabaseConnection(client)`: Verifica conectividade com `SELECT 1`.
    2. `verifySchemaVersion(client)`: Consulta `schema_migrations` e tabelas essenciais em modo somente leitura, sem executar DDL em requisições HTTP.
    3. `runDatabaseMigrations(client, { authorized: true })`: Aplica migrações versionadas (`database/migrations/*.sql`) dentro de transações explícitas, falhando de forma visível caso ocorra qualquer erro.
    4. `ensureOraclePostgresSchema(client)`: Durante requisições normais da aplicação, apenas valida a prontidão do esquema, sem executar `ALTER TABLE` ou `CREATE TABLE` silenciosos.
- **Segurança de Autenticação (`src/lib/oracleAuth.js`):**
  - Sessão web baseada em cookies `HttpOnly`, `Secure`, `SameSite=Lax` + validação CSRF (`X-CSRF-Token` timing-safe e checagem de `Origin`).
  - Compatibilidade total com `Authorization: Bearer <jwt>` para o MediCare Paciente Android.
  - Isolamento de sessões via `sid` vinculado à tabela `auth_sessions`, garantindo expiração e revogação individual por sessão.

---

## 2. Mapa de Endpoints Validados

### 2.1. Autenticação (`/api/auth/v1/[...action]`)
| Método | Rota | Descrição | Status |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/v1/signup` | Cadastro de usuário com emissão de sessão isolada (`auth_sessions`) e cookies `HttpOnly`. | Implementada e validada |
| `POST` | `/api/auth/v1/token?grant_type=password` | Login com verificação `pgcrypto`, emissão de JWT (`sid`) e cookies `HttpOnly` + CSRF. | Implementada e validada |
| `POST` | `/api/auth/v1/token?grant_type=refresh_token` | Renovação rotativa de sessão via cookie `HttpOnly` ou corpo JSON. | Implementada e validada |
| `GET` | `/api/auth/v1/user` | Valida JWT e sessão ativa em `auth_sessions`, retornando dados do usuário e `csrf_token`. | Implementada e validada |
| `PUT` | `/api/auth/v1/user` | Atualização de perfil/senha com proteção CSRF e validação do usuário autenticado. | Implementada e validada |
| `POST` | `/api/auth/v1/logout` | Revogação isolada da sessão atual (`sid` / `refresh_token_hash`) e limpeza de cookies. | Implementada e validada |
| `POST` / `DELETE` | `/api/auth/v1/delete-account` | Exclusão autenticada da própria conta ou paciente gerenciado pelo cuidador. | Implementada e validada |

### 2.2. Roteador REST (`/api/rest/v1/[...slug]`) e RPCs (`/api/rest/v1/rpc/[fnName]`)
Todas as tabelas e RPCs aplicam verificação de vínculo ativo (`caregiver_relationships.status = 'active'`) e nível de permissão antes de qualquer leitura ou escrita:

| Recurso / RPC | Autorização Exigida | Status |
| :--- | :--- | :--- |
| `profiles`, `medicamentos`, `historico_doses`, `health_events`, `stock_movements`, `approval_requests`, `audit_logs` | Próprio usuário ou cuidador com vínculo `active` (escrita requer `caregiver`/`read_write`/`admin`). | Implementada e validada |
| `confirm_dose_retroactive` / `record_dose_administration` | Cuidador com permissão de escrita ou próprio paciente. Separa horário previsto, horário real (`administered_at`) e momento do registro (`NOW()`). | Implementada e validada |
| `resolve_dose_approval` | Cuidador com permissão de escrita aprova ou recusa solicitação de dose de paciente dependente. | Implementada e validada |
| `create_managed_patient` | Cria paciente dependente (`is_managed = true`) sem valores clínicos predefinidos e vincula ao cuidador como `admin`. | Implementada e validada |
| `accept_caregiver_invite` / `revoke_caregiver` | Aceite de convite por token e revogação verificando titularidade do vínculo. | Implementada e validada |
| `record_stock_movement` / `get_stock_forecast` / `get_all_stock_forecasts` | Valida propriedade do medicamento e vínculo com o paciente antes de consultar ou alterar estoque. | Implementada e validada |
| `list_audit_logs` / `get_patient_summary` / `get_treatment_dashboard` | Valida vínculo de leitura com o `p_patient_id` informado. | Implementada e validada |

### 2.3. Sincronização Mobile (`/api/v1/sync`)
- Sincroniza dados do MediCare Paciente Android preservando `confirmed_by_role`, `origin`, `atraso_minutos` e `administered_at` em `historico_doses`, sem sobrescrever `blood_type` com valores padrão fictícios.
