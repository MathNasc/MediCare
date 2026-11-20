# Revisão de Segurança e Conformidade LGPD — MediCare

**Versão:** 2.0 (Atualizada)  
**Escopo:** Proteção de dados entre **MediCare Paciente Android**, **MediCare Cuidador Web/Android**, **Backend API** e **PostgreSQL 16 na Oracle Cloud**.

---

## 1. Princípios de Segurança e Modelo de Ameaças

O MediCare manipula dados clínicos e medicamentosos classificados como **dados pessoais sensíveis** pela LGPD (Lei nº 13.709/2018, Art. 5º, II e Art. 11). A autorização e validação ocorrem obrigatoriamente no servidor antes de qualquer consulta ou mutação.

---

## 2. Controles de Segurança Auditados e Implementados

### 2.1. Autorização no Servidor e Prevenção contra IDOR
- Toda leitura ou modificação de prontuários, medicamentos, regras (`patient_care_settings`), grupos (`caregiver_patient_groups`) e doses valida se `user_id == current_user_id` OU se existe vínculo ativo em `caregiver_relationships` (`status = 'active'`) com nível de permissão compatível (`viewer`/`read_only` vs `caregiver`/`read_write`/`admin`).
- A variável transacional `app.current_user_id` é propagada ao PostgreSQL nas operações autenticadas.
- Removido qualquer fallback de frontend que listasse perfis sem vínculo explícito.

### 2.2. Autenticação, Sessões Isoladas e Proteção CSRF
- **Senhas:** Armazenadas com `pgcrypto` (`gen_salt('bf', 10)`).
- **Web (`HttpOnly` + CSRF):** Access token (`1h`) e refresh token (`30d`) gravados em cookies `HttpOnly`, `Secure` (em HTTPS) e `SameSite=Lax`, sem persistência de tokens sensíveis em `localStorage`. Mutações por cookie exigem `X-CSRF-Token` (comparação timing-safe) e validação de `Origin`/`Host`.
- **Android (`Bearer`):** Suporte preservado a `Authorization: Bearer <jwt>` para o aplicativo nativo.
- **Isolamento por `sid`:** Cada sessão possui identificador único em `auth_sessions`; refresh tokens são salvos apenas como hash SHA-256 e revogados individualmente com `revoked_at = NOW()`.
- **Rate Limiting e Segredos:** Endpoints críticos de autenticação possuem limitação de requisições e todas as chaves (`GEMINI_API_KEY`, `DATABASE_URL`, `VAPID_PRIVATE_KEY`, `ORACLE_JWT_SECRET`) residem exclusivamente no servidor.

### 2.3. Prevenção de SQL Injection e Loops de Proxy
- O roteador `/api/rest/v1/[...slug]` aplica `sanitizeIdentifier`, lista fechada `ALLOWED_TABLES` e queries 100% parametrizadas (`$1`, `$2`, ...).
- O fallback HTTP para `ORACLE_BACKEND_URL` (`src/lib/oracleProxy.js`) valida `x-medicare-proxy-hop` e o host de destino para impedir loops e encaminha credenciais apenas sobre transporte controlado.

### 2.4. Trilha de Auditoria Imutável (`audit_logs`)
- Toda confirmação retroativa, retificação de dose, validação de solicitação (`resolve_dose_approval`), vínculo/revogação de cuidador e alteração de regra no Painel de Gerenciamento registra ator (`performed_by`), ação, valores `old_value`/`new_value`, justificativa e timestamp do servidor em formato append-only.

---

## 3. Conformidade com a LGPD

| Princípio da LGPD | Aplicação no MediCare |
| :--- | :--- |
| **Finalidade e Necessidade** (Art. 6º, I e III) | Coleta estrita de dados necessários para posologia, acompanhamento clínico e emergência, sem preenchimento de valores clínicos fictícios padrão. |
| **Livre Acesso e Transparência** (Art. 6º, IV e VI) | Consulta transparente de doses, histórico, movimentações de estoque e trilha de auditoria. |
| **Segurança e Prevenção** (Art. 6º, VII e VIII) | Criptografia de credenciais, cookies `HttpOnly` + CSRF, HTTPS via Nginx/Let's Encrypt e isolamento de sessões. |
| **Revogação do Consentimento** (Art. 8º, § 5º) | Revogação imediata de vínculos de cuidadores (`revoke_caregiver`) e suporte completo a exclusão de conta (`/api/auth/v1/delete-account` e `/api/v1/sync` `DELETE`). |
| **Rastreabilidade e Não-Repúdio** (Art. 11) | Separação entre ações do paciente (`patient_app`) e do cuidador (`caregiver_web`) e preservação do histórico de alterações. |
