# Contrato da API — MediCare Cuidador Web

**Data:** 29 de Outubro de 2026  
**Versão:** 1.0  
**Base URL:** `/api`

---

## 1. Padrões Globais da API

- **Formato:** JSON em todas as requisições e respostas (`Content-Type: application/json`).
- **Autenticação:** Header HTTP `Authorization: Bearer <jwt_access_token>`.
- **Filtros REST:** Compatível com convenção PostgREST (`eq.<val>`, `neq.<val>`, `gte.<val>`, `lte.<val>`, `ilike.<val>`, `in.(val1,val2)`, `order=<col>.<asc|desc>`, `limit=<n>`).
- **Idempotência:** Procedimentos RPC com identificadores transacionais e prevenção de cliques repetidos.

---

## 2. Especificação dos Recursos

### 2.1. Autenticação e Sessão

#### `POST /api/auth/v1/token?grant_type=password`
Realiza login do cuidador por e-mail e senha.
- **Request Body:**
  ```json
  {
    "email": "cuidador@exemplo.com",
    "password": "senhaSegura123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "f47ac10b...",
    "token_type": "bearer",
    "expires_in": 3600,
    "user": {
      "id": "c0a80101-0000-0000-0000-000000000001",
      "email": "cuidador@exemplo.com",
      "user_metadata": { "nome": "Maria Silva", "role": "cuidador" }
    }
  }
  ```
- **Erros:** `400 Bad Request`, `401 Unauthorized`, `429 Too Many Requests`.
- **Status:** Implementada e validada.

#### `POST /api/auth/v1/token?grant_type=refresh_token`
Renova o token JWT de acesso utilizando um token de atualização ativo.
- **Request Body:**
  ```json
  {
    "refresh_token": "f47ac10b..."
  }
  ```
- **Response (200 OK):** Novo par `access_token` e `refresh_token`.
- **Status:** Implementada e validada.

#### `POST /api/auth/v1/logout`
Encerra a sessão e revoga o refresh token em `auth_sessions`.
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** `{ "ok": true }`
- **Status:** Implementada e validada.

---

### 2.2. Gestão de Pacientes e Vínculos

#### `GET /api/rest/v1/caregiver_relationships`
Lista todos os pacientes aos quais o cuidador autenticado possui vínculo ativo.
- **Query Params:** `caregiver_id=eq.<user_id>`, `status=eq.active`, `select=*`
- **Response (200 OK):**
  ```json
  [
    {
      "id": "rel-001",
      "patient_id": "b1b2c3d4-1111-2222-3333-444455556666",
      "caregiver_id": "c0a80101-0000-0000-0000-000000000001",
      "permission_level": "caregiver",
      "status": "active",
      "relationship_label": "Mãe",
      "accepted_at": "2026-10-20T10:00:00Z"
    }
  ]
  ```
- **Status:** Implementada e validada.

#### `POST /api/rest/v1/rpc/accept_caregiver_invite`
Associa o cuidador a um paciente utilizando o token de convite gerado pelo aplicativo Android.
- **Request Body:**
  ```json
  {
    "p_token": "a1b2c3d4e5f6789012345678"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "relationship_id": "rel-001",
    "patient_id": "b1b2c3d4-1111-2222-3333-444455556666"
  }
  ```
- **Erros:** `401 Unauthorized`, `400` ("Convite inválido ou expirado" / "Não pode aceitar seu próprio convite").
- **Status:** Implementada e validada.

#### `POST /api/rest/v1/rpc/get_patient_summary`
Retorna resumo clínico consolidado de um paciente vinculado.
- **Request Body:**
  ```json
  {
    "p_patient_id": "b1b2c3d4-1111-2222-3333-444455556666"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "profile": {
      "id": "b1b2c3d4-...",
      "nome": "João Ferreira",
      "email": "joao@exemplo.com",
      "role": "paciente",
      "foto_url": null
    },
    "meds_count": 4,
    "last_dose": {
      "hora": "08:00",
      "at": "2026-10-29T08:05:00Z",
      "status": "confirmed"
    }
  }
  ```
- **Status:** Implementada e validada.

---

### 2.3. Medicamentos e Tratamentos

#### `GET /api/rest/v1/medicamentos`
Consulta as prescrições do paciente especificado.
- **Query Params:** `user_id=eq.<patient_id>`, `ativo=eq.true`, `order=created_at.asc`
- **Response (200 OK):**
  ```json
  [
    {
      "id": "med-uuid-001",
      "user_id": "b1b2c3d4-...",
      "nome": "Losartana Potássica",
      "dosagem": "50mg",
      "quantidade": 24,
      "unidade": "comprimido",
      "horarios": ["08:00", "20:00"],
      "treatment_type": "continuous",
      "status": "ativo",
      "ativo": true
    }
  ]
  ```
- **Status:** Implementada e validada.

#### `POST /api/rest/v1/medicamentos`
Cadastra novo tratamento para o paciente.
- **Autorização:** Cuidador com permissão `caregiver` ou `admin`.
- **Status:** Implementada e validada.

---

### 2.4. Central de Administração de Doses

#### `GET /api/rest/v1/historico_doses`
Histórico e registros de confirmação de doses.
- **Query Params:** `user_id=eq.<patient_id>`, `order=created_at.desc`, `limit=100`
- **Status:** Implementada e validada.

#### `POST /api/rest/v1/rpc/confirm_dose_retroactive`
Registra ou corrige uma administração de medicamento em nome do paciente com trilha de auditoria automática.
- **Request Body:**
  ```json
  {
    "p_patient_id": "b1b2c3d4-1111-2222-3333-444455556666",
    "p_med_id": "med-uuid-001",
    "p_hora": "08:00",
    "p_dose_date": "2026-10-29",
    "p_new_status": "confirmed",
    "p_reason": "Administrado pessoalmente pelo cuidador durante a visita matinal."
  }
  ```
- **Comportamento no Backend:**
  1. Identifica se já existe registro prévio para o paciente naquela data/hora.
  2. Grava evento em `audit_logs` registrando `performed_by = cuidador_id` e snapshot `old_value` e `new_value`.
  3. Atualiza ou insere em `historico_doses` marcando `is_retroactive = true` e `performed_by = cuidador_id`.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "id": "dose-hist-uuid",
    "action": "created"
  }
  ```
- **Status:** Implementada e validada.

---

### 2.5. Agenda (Consultas e Exames)

#### `GET /api/rest/v1/health_events`
Retorna compromissos médicos agendados para o paciente.
- **Query Params:** `user_id=eq.<patient_id>`, `date=gte.<hoje>`, `order=date.asc`
- **Status:** Implementada e validada.

#### `POST /api/rest/v1/health_events`
Cria nova consulta, exame ou procedimento para o paciente vinculado.
- **Request Body:**
  ```json
  {
    "id": "event-uuid",
    "user_id": "b1b2c3d4-...",
    "type": "consulta",
    "title": "Cardiologista - Dr. Feres",
    "description": "Retorno semestral e revisão de exames",
    "date": "2026-11-15",
    "time": "14:30",
    "doctor": "Dr. Feres Chaddad Neto",
    "location": "Hospital São Paulo"
  }
  ```
- **Status:** Implementada e validada.

---

### 2.6. Estoque de Medicamentos

#### `POST /api/rest/v1/rpc/record_stock_movement`
Registra compra, reposição ou ajuste de estoque para um medicamento.
- **Request Body:**
  ```json
  {
    "p_medication_id": "med-uuid-001",
    "p_movement_type": "purchase",
    "p_quantity_before": 10,
    "p_quantity_after": 40,
    "p_purchase_price": 28.50,
    "p_purchase_location": "Drogaria São Paulo",
    "p_notes": "Compra de 1 caixa com 30 comprimidos"
  }
  ```
- **Response (200 OK):** `{ "success": true, "movement_id": "mov-uuid" }`
- **Status:** Implementada e validada.

#### `POST /api/rest/v1/rpc/get_all_stock_forecasts`
Retorna dias restantes de estoque e data prevista de término para cada medicamento do paciente.
- **Status:** Implementada e validada.

---

### 2.7. Indicadores e Relatórios Oficiais (Backend-Calculated)

#### `POST /api/rest/v1/rpc/get_treatment_dashboard`
Retorna indicadores quantitativos agregados para a visão geral do cuidador.
- **Response (200 OK):**
  ```json
  {
    "continuous_count": 3,
    "active_treatments": 1,
    "finished_treatments": 2,
    "sos_uses_this_month": 4
  }
  ```
- **Status:** Implementada e validada.

---

### 2.8. Trilha de Auditoria

#### `POST /api/rest/v1/rpc/list_audit_logs`
Retorna histórico detalhado de alterações clínicas e de doses do paciente.
- **Request Body:**
  ```json
  {
    "p_patient_id": "b1b2c3d4-...",
    "p_limit": 50
  }
  ```
- **Response (200 OK):** Lista de eventos com `action`, `performed_by`, `old_value`, `new_value`, `reason` e `created_at`.
- **Status:** Implementada e validada.
