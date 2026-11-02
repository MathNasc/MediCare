# Modelo de Dados e Identidade — MediCare

**Versão:** 2.0 (Consolidada)  
**Banco Alvo:** PostgreSQL 16 (Oracle Cloud — `medicare_db`)

---

## 1. Estrutura de Tabelas e Relacionamentos

O esquema do MediCare utiliza chaves `uuid` e restrições de integridade referencial, gerenciadas por migrações versionadas em `database/migrations/`:

- `01_schema_completo.sql`: Esquema original com suporte Supabase/RLS.
- `02_schema_oracle_standalone.sql`: Esquema standalone para PostgreSQL 16 na Oracle Cloud.
- `03_incremental_compatibility.sql`: Migração incremental não destrutiva que consolida colunas de rastreabilidade de doses (`administered_at`, `confirmed_by_role`, `origin`, `atraso_minutos`), tabelas de validação (`approval_requests`, `notificacoes`) e controle de versão (`schema_migrations`).

```text
app_users (Contas e Autenticação)
    │
    ├── 1:N ── auth_sessions (Sessões Isoladas por Dispositivo / sid)
    │
    ├── 1:1 ── profiles (Dados Cadastrais, Papel e Pacientes Gerenciados)
    │
    ├── 1:N ── medicamentos (Tratamentos do Paciente)
    │              │
    │              ├── 1:N ── historico_doses (Registros de Administração)
    │              │              │
    │              │              └── 1:N ── dose_observations (Observações de Sintomas)
    │              │
    │              └── 1:N ── stock_movements (Histórico e Movimentação de Estoque)
    │
    ├── 1:N ── approval_requests (Solicitações de Validação de Dose do Paciente ao Cuidador)
    │
    ├── 1:N ── caregiver_relationships (Vínculos Cuidador <-> Paciente)
    │              │
    │              ├── 1:N ── caregiver_notes (Anotações do Cuidador)
    │              │
    │              └── 1:N ── caregiver_audit_log (Auditoria do Vínculo)
    │
    └── 1:N ── audit_logs (Trilha de Auditoria Geral e Histórico de Correções)
```

---

## 2. Dicionário das Tabelas Principais

### 2.1. `app_users` e `auth_sessions`
- `app_users`: Contas de usuário com `password_hash` bcrypt (`pgcrypto`).
- `auth_sessions`: Sessões ativas isoladas por `id` (`sid` no JWT), `refresh_token_hash` (SHA-256), `expires_at` e `revoked_at`.

### 2.2. `profiles`
- `id` (`uuid`, PK, FK `app_users.id` ON DELETE CASCADE).
- `nome` (`text`, NOT NULL), `social_name` (`text`), `email` (`text`).
- `role` (`text`, FK `roles.code`): `paciente`, `cuidador` ou `independente`.
- `is_managed` (`boolean`, DEFAULT false): Perfil criado e gerenciado por cuidador.
- `managed_by` (`uuid`, FK `app_users.id`): Cuidador responsável pelo cadastro.
- `dob` (`date`), `sex` (`text`), `blood_type` (`text` — opcional, `NULL` quando não informado; sem valor padrão fictício), `cpf` (`text`), `phone` (`text`), `address` (`text`), `weight` (`numeric`), `height` (`numeric`).

### 2.3. `medicamentos`
- `id` (`uuid`, PK), `user_id` (`uuid`, FK `app_users.id`).
- `nome` (`text`, NOT NULL), `principio_ativo` / `active_ingredient` (`text`, opcional).
- `dosagem` (`text`, NOT NULL), `unidade` (`text`), `quantidade` (`int`, CHECK >= 0).
- `horarios` (`text[]`): Horários diários previstos no formato `HH:MM`.
- `treatment_type` (`text`): `continuous`, `temporary` ou `sos`.
- `status` (`text`): `ativo`, `pausado`, `concluido`, `cancelado`.

### 2.4. `historico_doses`
Separa claramente o horário previsto, o horário real da administração e o momento em que o registro foi realizado:
- `id` (`uuid`, PK), `med_id` (`uuid`, FK `medicamentos.id`), `user_id` (`uuid`, FK `app_users.id`).
- `hora` (`text`, NOT NULL) e `dose_date` (`date`): **Horário e data previstos** na prescrição.
- `administered_at` (`timestamptz`): **Horário real da administração** da dose.
- `created_at` (`timestamptz`) e `corrected_at` (`timestamptz`): **Momento exato em que o registro ou retificação foi gravado** no sistema.
- `status` (`text`, NOT NULL): `confirmed`, `missed`, `pending`, `late`.
- `atraso_minutos` (`int`, DEFAULT 0): Diferença em minutos entre o horário previsto e a administração real.
- `performed_by` (`uuid`, FK `app_users.id`): Identificador do autor da ação.
- `confirmed_by_name` (`text`) e `confirmed_by_role` (`text`): Nome e papel do autor (`paciente` ou `cuidador`).
- `origin` (`text`): Origem da ação (`patient_app`, `caregiver_web`, `android_sync`).
- `is_retroactive` (`boolean`, DEFAULT false): Indica exclusivamente se o registro foi lançado retroativamente (> 30 min após o horário previsto, em data anterior ou como retificação de registro prévio). Não é ativado automaticamente apenas por ter sido registrado pelo cuidador.
- `correction_reason` / `motivo` (`text`): Justificativa clínica ou observação.

### 2.5. `approval_requests`
Solicitações enviadas por pacientes dependentes ao cuidador para confirmar ou desfazer uma dose:
- `id` (`uuid`, PK), `patient_id` (`uuid`), `caregiver_id` (`uuid`), `med_id` (`text`), `med_nome` (`text`).
- `dose_date` (`date`), `hora` (`text`), `action_type` (`confirm_dose` | `undo_dose`), `requested_status` (`text`), `reason` (`text`).
- `status` (`text`): `pending`, `approved`, `rejected`.

### 2.6. `schema_migrations`
Controle explícito de versão do esquema do banco de dados:
- `version` (`text`, PK), `description` (`text`), `applied_at` (`timestamptz`).

---

## 3. Classificação dos Estados de Administração de Doses

| Estado Clínico | Campo `status` | Condição Fática | Rastreabilidade |
| :--- | :--- | :--- | :--- |
| **Dose Prevista** | `pending` | Horário agendado futuro ou dentro da janela atual (≤ 30 min) sem registro. | Calculada a partir de `medicamentos.horarios`. |
| **Dose sem Confirmação** | `pending` (expirado) | Horário previsto ultrapassado há mais de 30 minutos sem confirmação nem recusa. | Exibida como `Sem Confirmação` para alerta ao cuidador, sem ser confundida com recusa explícita. |
| **Dose Confirmada pelo Paciente** | `confirmed` | Paciente independente confirmou no app (ou cuidador aprovou solicitação do paciente). | `confirmed_by_role = 'paciente'`, `origin = 'patient_app'`, `administered_at` preenchido. |
| **Dose Registrada pelo Cuidador** | `confirmed` | Cuidador registrou a administração em nome do paciente. | `confirmed_by_role = 'cuidador'`, `origin = 'caregiver_web'`. `is_retroactive = true` apenas se lançada fora da janela (> 30 min) ou em retificação. |
| **Dose Atrasada** | `late` (ou `confirmed` com `atraso_minutos > 15`) | Administração realizada com atraso significativo em relação ao horário previsto. | `atraso_minutos` calculado entre o horário previsto e `administered_at`. |
| **Dose Não Administrada** | `missed` | Paciente ou cuidador registrou recusa, suspensão ou impossibilidade clínica. | `status = 'missed'`, `correction_reason` / `motivo` obrigatório. |
