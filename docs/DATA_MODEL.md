# Modelo de Dados e Identidade — MediCare

**Versão:** 2.2 (Atualizada)  
**Banco Alvo:** PostgreSQL 16 (Oracle Cloud — `medicare_db`)

---

## 1. Estrutura de Tabelas e Migrações Versionadas

O esquema do MediCare utiliza chaves `uuid` e integridade referencial, gerenciadas explicitamente em `database/migrations/`:

- `02_schema_oracle_standalone.sql`: Esquema standalone completo para PostgreSQL 16 na Oracle Cloud.
- `03_incremental_compatibility.sql`: Colunas de rastreabilidade de doses (`administered_at`, `confirmed_by_role`, `origin`, `atraso_minutos`), `approval_requests`, `notificacoes`, `push_subscriptions` e tabela de controle `schema_migrations`.
- `04_caregiver_management_settings.sql`: Cria `patient_care_settings` com parâmetros de acompanhamento clínico configuráveis pelo cuidador.
- `05_caregiver_groups_and_global_settings.sql`: Cria `caregiver_global_settings` e `caregiver_patient_groups`, adicionando `config_mode` (`global` | `group` | `custom`), `group_id` e `caregiver_id` em `patient_care_settings`.
- `06_caregiver_patient_chat.sql`: Cria `caregiver_chat_messages` e índices de leitura/cronologia para o chat direto entre paciente não-independente e cuidador ativo.

```text
app_users (Contas e Autenticação)
    ├── 1:N ── auth_sessions (Sessões Isoladas / sid)
    ├── 1:1 ── profiles (Dados Cadastrais, Papel e Pacientes Gerenciados)
    ├── 1:1 ── caregiver_global_settings (Padrão Global da Clínica/Cuidador)
    ├── 1:N ── caregiver_patient_groups (Grupos de Pacientes com Regras Próprias)
    ├── 1:1 ── patient_care_settings (Herança: global | group | custom)
    ├── 1:N ── medicamentos ── historico_doses & stock_movements
    ├── 1:N ── approval_requests & notificacoes & push_subscriptions
    ├── 1:N ── caregiver_relationships ── caregiver_notes, caregiver_chat_messages & caregiver_audit_log
    └── 1:N ── audit_logs (Trilha de Auditoria Imutável)
```

---

## 2. Dicionário das Tabelas Principais

### 2.1. `app_users`, `auth_sessions` e `profiles`
- `app_users`: Contas com senha criptografada (`pgcrypto`).
- `auth_sessions`: Sessões individuais (`id` / `sid`, `refresh_token_hash` SHA-256, `expires_at`, `revoked_at`).
- `profiles`: `id`, `nome`, `social_name`, `email`, `role` (`paciente`, `cuidador`, `independente`), `is_managed`, `managed_by`, `dob`, `sex`, `blood_type` (`NULL` quando não informado), `cpf`, `phone`, `address`, `weight`, `height`.

### 2.2. Gerenciamento Clínico (`caregiver_global_settings`, `caregiver_patient_groups`, `patient_care_settings`)
Campos compartilhados pelos 3 níveis (com precedência `custom` → `group` → `global`):
- `overdue_notify_minutes` (`int`, padrão `60`): Tempo em minutos após o horário previsto para notificar o cuidador caso não haja registro.
- `require_caregiver_confirm` (`boolean`, padrão `true`): Exige validação do cuidador quando o paciente dependente registra dose dentro da janela normal.
- `require_confirm_after_missed` (`boolean`, padrão `true`): Exige validação do cuidador quando a dose já ultrapassou a janela de dose perdida.
- `require_confirm_undo` (`boolean`, padrão `true`): Exige validação do cuidador para desfazer uma dose já confirmada.
- `missed_dose_minutes` (`int`, padrão `180`): Limite em minutos para considerar uma dose pendente como perdida.
- `allow_patient_med_edit` (`boolean`, padrão `true`): Permite ou bloqueia edição/cadastro de medicamentos pelo paciente.
- `notify_low_stock` (`boolean`, padrão `true`) e `low_stock_threshold` (`int`, padrão `5`): Alertas de reposição de estoque.
- `notify_sos_usage` (`boolean`, padrão `true`): Alerta imediato ao cuidador quando o paciente registra medicamento SOS.
- Em `patient_care_settings`: `config_mode` (`global` | `group` | `custom`), `group_id` (FK opcional para `caregiver_patient_groups`), `caregiver_id`.

### 2.3. `medicamentos`, `historico_doses` e `approval_requests`
- `medicamentos`: `id`, `user_id`, `nome`, `principio_ativo`, `dosagem`, `unidade`, `quantidade`, `horarios` (`text[]` em `HH:MM`), `treatment_type` (`continuous` | `temporary` | `sos`), `status`.
- `historico_doses`: Separa horário previsto (`hora`, `dose_date` em `America/Sao_Paulo`), horário real (`administered_at`), momento do registro (`created_at`, `corrected_at`), `status` (`confirmed` | `missed` | `pending` | `late`), `atraso_minutos`, `performed_by`, `confirmed_by_name`, `confirmed_by_role`, `origin`, `is_retroactive`, `correction_reason`.
- `approval_requests`: Solicitações de confirmação ou desfazimento (`confirm_dose` | `undo_dose`) com `status` (`pending` | `approved` | `rejected`).

### 2.4. `caregiver_chat_messages` e `schema_migrations`
- `caregiver_chat_messages`: `id` (`uuid`), `relationship_id`, `patient_id`, `caregiver_id`, `sender_id`, `sender_role` (`paciente` | `cuidador`), `message` (`text`), `read_at`, `created_at`. Uso restrito a vínculos `active` onde o paciente não possui perfil `independente`.
- `schema_migrations`: Registra todas as migrações aplicadas (`03_incremental_compatibility`, `04_caregiver_management_settings`, `05_caregiver_groups_and_global_settings`, `06_caregiver_patient_chat`).

---

## 3. Estados Clínicos de Administração de Doses

| Estado Clínico | Campo `status` | Condição Fática | Rastreabilidade |
| :--- | :--- | :--- | :--- |
| **Dose Prevista** | `pending` | Horário agendado futuro ou dentro da janela atual sem registro. | Calculada a partir de `medicamentos.horarios` no fuso `America/Sao_Paulo`. |
| **Dose Atrasada / Sem Confirmação** | `pending` (expirado) | Horário previsto ultrapassado há mais de 30 min (até `missed_dose_minutes`). | Gera alerta ao cuidador após `overdue_notify_minutes`. |
| **Dose Confirmada** | `confirmed` | Confirmada pelo paciente independente, diretamente pelo cuidador ou aprovada via solicitação. | `confirmed_by_role`, `origin`, `administered_at` preenchidos. |
| **Dose Atrasada Tomada** | `late` / `confirmed` | Confirmada com atraso significativo após o horário previsto. | `atraso_minutos` calculado em relação a `America/Sao_Paulo`. |
| **Dose Perdida / Não Administrada** | `missed` | Recusa explícita registrada ou janela `missed_dose_minutes` expirada. | `correction_reason` / `motivo` preservado. |
