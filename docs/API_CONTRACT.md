# Contrato da API — MediCare (Cuidador Web & Paciente Android)

**Versão:** 2.0 (Consolidada)  
**Base URL:** `/api`

---

## 1. Padrões Globais de Autenticação e Segurança

O backend suporta dois mecanismos simultâneos e compatíveis de autenticação, ambos validados contra a tabela `auth_sessions` no PostgreSQL:

1. **Sessão Web (MediCare Cuidador — `/cuidador`):**
   - **Cookies `HttpOnly`:** `medicare_access_token` (validade de 1h) e `medicare_refresh_token` (validade de 30 dias), configurados com `HttpOnly; SameSite=Lax; Path=/` e `Secure` em HTTPS/produção.
   - **Proteção CSRF:** Cookie legível `medicare_csrf_token` combinado com o header obrigatório `X-CSRF-Token` e validação de `Origin`/`Host` em todas as requisições mutáveis (`POST`, `PUT`, `PATCH`, `DELETE`) autenticadas por cookie.
   - **Proibição de `localStorage`:** Tokens JWT e refresh tokens não são armazenados em `localStorage` na aplicação web.

2. **Autenticação Mobile (MediCare Paciente Android):**
   - **Header HTTP:** `Authorization: Bearer <jwt_access_token>`.
   - Requisições com header `Authorization: Bearer` explícito permanecem 100% compatíveis com o aplicativo Android e não exigem cookie CSRF.

3. **Isolamento de Sessões:**
   - Cada login gera um registro individual em `auth_sessions` cujo identificador (`sid`) é embutido nas claims do JWT. O logout ou revogação encerra apenas a sessão alvo, sem derrubar outros dispositivos do mesmo usuário.

---

## 2. Endpoints de Autenticação (`/api/auth/v1`)

### `POST /api/auth/v1/token?grant_type=password`
Autentica usuário por e-mail e senha via `pgcrypto`, cria sessão isolada em `auth_sessions`, define cookies `HttpOnly` + `medicare_csrf_token` e retorna os dados no corpo JSON (para compatibilidade Android).

### `POST /api/auth/v1/token?grant_type=refresh_token`
Renova a sessão ativa utilizando o cookie `HttpOnly` `medicare_refresh_token` (web) ou o campo `refresh_token` no corpo JSON (Android). Revoga o token anterior e rotaciona o par de tokens mantendo o isolamento da sessão.

### `GET /api/auth/v1/user`
Retorna os dados do usuário autenticado (validando assinatura do JWT e estado ativo da sessão `sid` em `auth_sessions`).

### `POST /api/auth/v1/logout`
Revoga a sessão atual em `auth_sessions` (`revoked_at = NOW()`) e limpa os cookies de autenticação.

---

## 3. Autorização de Pacientes (`/api/rest/v1`)

Todas as rotas REST (`/api/rest/v1/[table]`) e RPC (`/api/rest/v1/rpc/[fn]`) exigem usuário autenticado e aplicam controle estrito de acesso por paciente:

- **Acesso Próprio:** O usuário pode consultar/editar seus próprios registros (`user_id = currentUser.id`).
- **Acesso do Cuidador:** O cuidador só pode consultar dados de um `patient_id` se possuir registro em `caregiver_relationships` com `caregiver_id = currentUser.id` e `status = 'active'` (ou `profiles.managed_by = currentUser.id`).
- **Permissão de Escrita:** Operações `POST`, `PATCH`, `DELETE` e RPCs de modificação exigem `permission_level` em `('caregiver', 'read_write', 'admin')`. Vínculos `viewer` / `read_only` recebem `403 Forbidden` ao tentar modificar dados.
- **Proteção contra IDOR:** Tentativas de alterar `patient_id`, `user_id` ou `med_id` de pacientes sem vínculo ativo retornam `403 Forbidden`.

---

## 4. Procedimentos RPC Principais (`/api/rest/v1/rpc/[fnName]`)

### `POST /api/rest/v1/rpc/confirm_dose_retroactive`
Registra ou corrige uma administração de medicamento pelo cuidador ou paciente autorizado.
- **Request Body:**
  ```json
  {
    "p_patient_id": "b1b2c3d4-1111-2222-3333-444455556666",
    "p_med_id": "med-uuid-001",
    "p_hora": "08:00",
    "p_dose_date": "2026-10-29",
    "p_administered_time": "08:10",
    "p_new_status": "confirmed",
    "p_reason": "Administrada pelo cuidador após o café da manhã"
  }
  ```
- **Regras de Segurança e Semântica Temporal:**
  1. Valida permissão de escrita do ator sobre `p_patient_id` e propriedade de `p_med_id`.
  2. Separa:
     - **Horário previsto:** `hora` (`p_hora`) e `dose_date` (`p_dose_date`).
     - **Horário real da administração:** `administered_at` (calculado a partir de `p_administered_time` ou momento real da tomada).
     - **Momento do registro:** `created_at` / `corrected_at` (`NOW()`).
  3. **Cálculo de Retroatividade e Atraso:** Não define `is_retroactive = true` automaticamente para toda ação do cuidador. `is_retroactive` só é `true` quando o registro refere-se a data passada, corrige um registro anterior ou ocorre com diferença > 30 minutos em relação ao horário previsto.
  4. Preserva `performed_by`, `confirmed_by_name`, `confirmed_by_role` (`cuidador` vs `paciente`), `origin` (`caregiver_web` vs `patient_app`) e grava snapshot `old_value` / `new_value` em `audit_logs`.
  5. Garante idempotência para a chave lógica `(user_id, med_id, dose_date, hora)` (exceto doses `SOS`).

### `POST /api/rest/v1/rpc/resolve_dose_approval`
Permite ao cuidador aprovar (`approved`) ou recusar (`rejected`) uma solicitação de confirmação ou desfazimento de dose enviada por um paciente dependente (`approval_requests`).

### `POST /api/rest/v1/rpc/create_managed_patient`
Cadastra um paciente dependente sem conta própria (`is_managed = true`, `managed_by = caregiver_id`) e cria vínculo ativo em `caregiver_relationships`. Não aplica valores clínicos padrão (`blood_type` e `dob` permanecem `NULL` se não informados explicitamente).

### `POST /api/rest/v1/rpc/accept_caregiver_invite` & `revoke_caregiver`
Gerenciam o ciclo de vida do vínculo entre cuidador e paciente com registro em `audit_logs`.
