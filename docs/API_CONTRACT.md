# Contrato da API — MediCare (Cuidador Web & Paciente Android)

**Versão:** 2.2 (Atualizada)  
**Base URL:** `/api`

---

## 1. Padrões Globais de Autenticação, Segurança e Fallback

1. **Sessão Web (MediCare Cuidador — `/cuidador`):**
   - **Cookies `HttpOnly`:** `medicare_access_token` (1h) e `medicare_refresh_token` (30 dias), com `HttpOnly; SameSite=Lax; Path=/` e `Secure` em HTTPS.
   - **Proteção CSRF:** Cookie legível `medicare_csrf_token` combinado com o header obrigatório `X-CSRF-Token` e validação de `Origin`/`Host` nas mutações autenticadas por cookie.
   - **Sem `localStorage`:** JWT e refresh tokens não ficam persistidos em `localStorage`.

2. **Autenticação Mobile (MediCare Paciente Android):**
   - Header `Authorization: Bearer <jwt_access_token>` sem exigência de CSRF.

3. **Isolamento de Sessões e Anti-Loop Proxy:**
   - Sessões isoladas por `sid` em `auth_sessions`.
   - `connectPgOrFallback` (`src/lib/oracleProxy.js`) encaminha automaticamente para `ORACLE_BACKEND_URL` caso o PostgreSQL local não esteja configurado ou esteja inacessível por rede (com proteção anti-loop via `x-medicare-proxy-hop: 1` e verificação de host).

---

## 2. Endpoints de Autenticação (`/api/auth/v1/[...action]`)

- `POST /api/auth/v1/signup` — Cadastro com criação de sessão isolada (`auth_sessions`) e cookies `HttpOnly`.
- `POST /api/auth/v1/token?grant_type=password` — Login `pgcrypto`, emissão de JWT (`sid`) e cookies.
- `POST /api/auth/v1/token?grant_type=refresh_token` — Renovação rotativa via cookie `HttpOnly` ou `refresh_token` JSON.
- `GET /api/auth/v1/user` — Retorna dados do usuário autenticado e `csrf_token`.
- `PUT /api/auth/v1/user` — Atualiza perfil/senha.
- `POST /api/auth/v1/logout` — Revoga a sessão `sid` em `auth_sessions` e limpa cookies.
- `POST /api/auth/v1/recover` — Solicitação de recuperação de senha.
- `POST` / `DELETE /api/auth/v1/delete-account` — Exclusão autenticada de conta própria ou paciente gerenciado.

---

## 3. Painel de Gerenciamento (`/api/v1/caregiver/settings`)

Gerencia regras clínicas com herança em 3 níveis (**Global da Clínica**, **Grupo de Pacientes** e **Individual por Paciente**):

- `GET /api/v1/caregiver/settings`:
  - Sem `patientId`: retorna visão consolidada da clínica (`globalSettings`, `groups`, `patientsOverview`, métricas por modo).
  - Com `?patientId=<uuid>`: retorna as regras efetivas resolvidas (`settings`) e metadados de herança (`meta.config_mode`: `global` | `group` | `custom`, `meta.group_id`, `meta.group_name`) após validar vínculo ativo.
- `PUT` / `PATCH` / `POST /api/v1/caregiver/settings`:
  - `scope: "global"` (com `applyToAll: true|false`): atualiza `caregiver_global_settings` e, opcionalmente, converte todos os pacientes vinculados para o modo `global`.
  - `scope: "group"`: cria ou edita grupo em `caregiver_patient_groups` e vincula os `patientIds` selecionados (`config_mode = 'group'`).
  - `scope: "assign_mode"`: altera rapidamente o modo (`global` | `group` | `custom`) de um paciente.
  - `scope: "patient"` (padrão): salva regras personalizadas para um paciente específico (`config_mode = 'custom'`) ou ajusta o modo vinculado.
- `DELETE /api/v1/caregiver/settings?groupId=<uuid>` (ou `?patientId=<uuid>`): exclui um grupo (retornando seus membros ao modo `global`) ou redefine o paciente para herdar o padrão `global`.

---

## 4. Notificações, Sincronização, Sistema e APKs

- `GET` / `PATCH` / `POST` / `DELETE` — Rotas complementares:
  - `GET /api/v1/caregiver/notifications` & `PATCH /api/v1/caregiver/notifications` — Lista alertas do cuidador autenticado e marca notificações como lidas.
  - `GET /api/v1/chat` (`?summary=1` ou `?patientId=<uuid>` / `?caregiverId=<uuid>`), `POST /api/v1/chat` (idempotente por UUID, com notificação Web Push) e `PATCH /api/v1/chat` (leitura) — Chat direto paciente ↔ cuidador, validando `caregiver_relationships.status = 'active'` e bloqueando perfis `independente` (`403`).
  - `GET /api/v1/chat/stream` — Stream SSE (`text/event-stream`) de mensagens e confirmações de leitura em tempo real para o MediCare Cuidador Web/Android.
  - `POST /api/ai` — Assistente de Saúde com OpenRouter (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, fallback opcional Gemini/proxy Oracle) protegido por guardrails (`src/lib/aiGuardrails.js`: domínio estrito de saúde, anti-prompt-injection e bloqueio de código/SQL).
  - `GET` / `POST` / `DELETE /api/v1/sync` — Sincronização bidirecional do app Android, incluindo retorno das regras efetivas `care_settings` e criação de `approval_requests` com alertas para cuidadores.
  - `GET /api/v1/health` — Saúde do PostgreSQL (`medicare_db`) ou status do upstream Oracle via proxy.
  - `POST /api/v1/jobs/reminders` & `POST /api/v1/jobs/alert-caregiver` — Disparo de alertas de atraso (respeitando `overdue_notify_minutes`) e Web Push.
  - `GET /api/system/versions` — Retorna versões atuais do MediCare Cuidador Web, `sw.js`, Paciente Android (`v2.9.1`) e Cuidador Android (`v2.0.0`).
  - `GET /api/apk` & `GET /api/apk/cuidador` & `GET /api/apk/version` — Download direto dos instaladores `MediCare-Paciente.apk` e `MediCare-Cuidador.apk` e metadados de versão.

---

## 5. Autorização REST e RPC (`/api/rest/v1/[...slug]`)

Todas as tabelas REST e RPCs exigem usuário autenticado (exceto leitura pública de catálogo/papéis) e validam vínculo ativo (`caregiver_relationships.status = 'active'`) + nível de permissão (`viewer`/`read_only` somente leitura; `caregiver`/`read_write`/`admin` escrita):
- `confirm_dose_retroactive` / `record_dose_administration`: Separa horário previsto (`hora`, `dose_date`), horário real (`administered_at`) e registro (`NOW()`), calculando `is_retroactive` apenas para data passada, retificação ou diferença > 30 minutos.
- `resolve_dose_approval`: Aprova ou recusa solicitação de paciente dependente (`approval_requests`).
- `create_managed_patient`: Cria dependente sem valores clínicos padrão (`blood_type`, `dob` permanecem `NULL` se não informados).
- `accept_caregiver_invite` / `revoke_caregiver`: Gerencia vínculos com auditoria em `audit_logs`.
- `record_stock_movement`, `get_stock_forecast`, `list_audit_logs`, `get_patient_summary`, `get_treatment_dashboard`.
