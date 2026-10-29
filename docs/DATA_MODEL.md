# Modelo de Dados e Identidade — MediCare

**Data:** 29 de Outubro de 2026  
**Versão:** 1.0  
**Banco Alvo:** PostgreSQL 16 (Oracle Cloud — `medicare_db`)

---

## 1. Estrutura de Tabelas e Relacionamentos

O esquema do MediCare baseia-se em integridade referencial com chaves UUIDv4 e restrições de integridade:

```text
app_users (Contas e Autenticação)
    │
    ├── 1:1 ── profiles (Dados Cadastrais, Papel e Emergência)
    │
    ├── 1:N ── medicamentos (Tratamentos do Paciente)
    │              │
    │              ├── 1:N ── historico_doses (Registros de Administração)
    │              │              │
    │              │              └── 1:N ── dose_observations (Observações de Sintomas)
    │              │
    │              └── 1:N ── stock_movements (Histórico e Movimentação de Estoque)
    │
    ├── 1:N ── health_events (Consultas, Exames, Procedimentos)
    │
    ├── 1:N ── notes (Anotações Clínicas e Diárias)
    │
    ├── 1:N ── caregiver_relationships (Vínculos Cuidador <-> Paciente)
    │              │
    │              ├── 1:N ── caregiver_notes (Anotações do Cuidador)
    │              │
    │              └── 1:N ── caregiver_audit_log (Auditoria Específica de Ações do Cuidador)
    │
    └── 1:N ── audit_logs (Trilha de Auditoria Geral e Modificações de Doses)
```

---

## 2. Dicionário de Tabelas Principais

### 2.1. `app_users`
Contas de usuário e credenciais criptografadas.
- `id` (`uuid`, PK): Identificador universal do usuário.
- `email` (`text`, UNIQUE, NOT NULL): E-mail normalizado em minúsculas.
- `password_hash` (`text`, NOT NULL): Hash bcrypt gerado via `pgcrypto` (`crypt(password, gen_salt('bf', 10))`).
- `raw_user_meta_data` (`jsonb`): Metadados adicionais (`nome`, `role`, flags).
- `is_active` (`boolean`, DEFAULT true): Estado da conta.
- `created_at` / `updated_at` (`timestamptz`): Controle temporal.

### 2.2. `profiles`
Informações cadastrais e perfil de atuação na saúde.
- `id` (`uuid`, PK, FK `app_users.id` ON DELETE CASCADE).
- `nome` (`text`, NOT NULL): Nome completo do paciente ou cuidador.
- `social_name` (`text`): Nome social ou apelido.
- `role` (`text`, FK `roles.code`): `paciente`, `cuidador` ou `independente`.
- `is_managed` (`boolean`, DEFAULT false): Indica se o perfil foi criado e é administrado por um cuidador sem possuir credenciais próprias no momento.
- `managed_by` (`uuid`, FK `app_users.id`): Cuidador criador/responsável pelo paciente gerenciado.
- `dob` (`date`), `sex` (`text`), `blood_type` (`text`), `cpf` (`text`), `phone` (`text`), `address` (`text`), `weight` (`numeric`), `height` (`numeric`).
- `role_change_pin` (`text`): PIN de segurança para alteração de papéis sensíveis.

### 2.3. `medicamentos`
Prescrições e tratamentos cadastrados para o paciente.
- `id` (`uuid`, PK).
- `user_id` (`uuid`, FK `app_users.id`): Paciente titular do tratamento.
- `nome` (`text`, NOT NULL): Nome comercial do medicamento.
- `dosagem` (`text`, NOT NULL): Ex: "500mg", "1 gota", "10ml".
- `quantidade` (`int`, CHECK >= 0): Saldo atual em estoque.
- `unidade` (`text`): "comprimido", "gotas", "ampola", "ml", etc.
- `horarios` (`text[]`): Lista de horários diários (ex: `{"08:00", "20:00"}`).
- `treatment_type` (`text`): `continuous` (contínuo), `temporary` (temporário com data de início e fim) ou `sos` (sob demanda).
- `start_date` / `end_date` (`date`): Período do tratamento para medicamentos temporários.
- `status` (`text`): `ativo`, `pausado`, `concluido` ou `cancelado`.
- `ativo` (`boolean`): Flag de filtro rápido.

### 2.4. `historico_doses`
Registros históricos de administração de medicamentos.
- `id` (`uuid`, PK).
- `med_id` (`uuid`, FK `medicamentos.id` ON DELETE CASCADE).
- `user_id` (`uuid`, FK `app_users.id`): Paciente que recebeu o medicamento.
- `hora` (`text`, NOT NULL): Horário programado ou horário tomado (ex: "08:00").
- `dose_date` (`date`): Data da dose no calendário.
- `status` (`text`, NOT NULL): Status do registro (`confirmed`, `missed`, `pending`, `late`).
- `atraso_minutos` (`int`, DEFAULT 0): Minutos de tolerância decorridos até o registro.
- `performed_by` (`uuid`, FK `app_users.id`): Usuário efetivamente responsável pela confirmação (o próprio paciente ou o cuidador).
- `origin` (`text`, DEFAULT 'patient_app'): Origem da confirmação (`patient_app`, `caregiver_web`, `system_scheduler`).
- `is_retroactive` (`boolean`, DEFAULT false): Marcador de inserção ou ajuste posterior.
- `corrected_at` (`timestamptz`): Data e hora da última retificação.
- `correction_reason` (`text`): Justificativa obrigatória para alterações retroativas.
- `created_at` (`timestamptz`): Carimbo imutável do momento da transação.

### 2.5. `caregiver_relationships`
Vínculos de governança entre cuidadores e pacientes (relação N:M).
- `id` (`uuid`, PK).
- `patient_id` (`uuid`, FK `app_users.id` ON DELETE CASCADE): Paciente acompanhado.
- `caregiver_id` (`uuid`, FK `app_users.id` ON DELETE SET NULL): Cuidador responsável.
- `permission_level` (`text`, DEFAULT 'caregiver'): `viewer` (apenas leitura), `caregiver` (confirma doses e anotações), `admin` (gestão total de prescrições e estoque).
- `status` (`text`): `pending`, `active`, `declined`, `revoked`.
- `invite_token` (`text`, UNIQUE): Token aleatório seguro gerado para conexão.
- `invite_expires_at` (`timestamptz`): Expiração padrão de 7 dias para convites não aceitos.
- `accepted_at` / `revoked_at` (`timestamptz`): Registro temporal de vigência do vínculo.

### 2.6. `audit_logs`
Trilha imutável para conformidade clínica e segurança de dados.
- `id` (`uuid`, PK).
- `patient_id` (`uuid`, FK `app_users.id`).
- `performed_by` (`uuid`, FK `app_users.id`): Usuário que realizou a ação.
- `action` (`text`, NOT NULL): Ex: `dose_confirmed_retroactively`, `dose_status_updated`, `medication_created`, `caregiver_revoked`.
- `old_value` (`jsonb`): Snapshot do estado anterior.
- `new_value` (`jsonb`): Snapshot do estado atualizado.
- `reason` (`text`): Motivo informado pelo usuário.
- `created_at` (`timestamptz` DEFAULT now()): Timestamp não editável.

---

## 3. Modelo de Identidade e Cenários de Cuidado

O MediCare implementa um modelo de identidade relacional e flexível:

```text
   ┌────────────────┐                     ┌────────────────┐
   │    Cuidador    │                     │    Paciente    │
   │  (app_users)   │                     │  (app_users)   │
   └───────┬────────┘                     └────────┬───────┘
           │                                       │
           │ 1                                     │ 1
           ▼                                       ▼
     ┌───────────┐                           ┌───────────┐
     │  Vínculo  │◄──────── N : M ──────────►│  Vínculo  │
     │  (Ativo)  │                           │  (Ativo)  │
     └───────────┘                           └───────────┘
```

### Resolução dos 7 Cenários de Negócio:
1. **Um cuidador pode acompanhar vários pacientes:**  
   O cuidador possui registros múltiplos em `caregiver_relationships` com seu `caregiver_id` associado a diferentes `patient_id`.
2. **Um paciente pode ter vários cuidadores:**  
   O paciente possui múltiplos registros em `caregiver_relationships` para o mesmo `patient_id`, permitindo diferentes níveis de permissão (`permission_level`).
3. **Paciente sem conta própria (Paciente Gerenciado):**  
   Um cuidador pode criar um perfil para um dependente (ex: idoso ou criança que não utiliza smartphone). O sistema provisiona um registro com `is_managed = true` e `managed_by = cuidador_id`.
4. **Paciente com app Android autoriza cuidador:**  
   O paciente gera um código de convite no app (`invite_token`). O cuidador informa esse código no MediCare Cuidador, acionando `accept_caregiver_invite`, que valida o token e ativa o vínculo.
5. **Associação tardia de conta Android a paciente previamente gerenciado:**  
   Quando o paciente passa a utilizar o aplicativo nativo, um fluxo de associação segura (via e-mail ou código de claim) transfere as credenciais para o perfil existente, preservando 100% dos medicamentos, histórico e estoque acumulados.
6. **Revogação de vínculo:**  
   Ao revogar um acesso (`revoke_caregiver`), o registro passa para `status = 'revoked'` e grava `revoked_at = NOW()`. O cuidador perde imediatamente a permissão de visualização e edição.
7. **Preservação de histórico:**  
   O histórico em `historico_doses` e `audit_logs` **nunca é apagado** quando um vínculo é desfeito. O campo `performed_by` perpetua a identificação de quem registrou cada dose.

---

## 4. Classificação dos Estados de Administração de Doses

O sistema estabelece critérios objetivos para distinguir estados clínicos de administração:

| Estado Clínico | Campo `status` | Condição Fática | Rastreabilidade |
| :--- | :--- | :--- | :--- |
| **Dose Prevista** | `pending` | Horário agendado futuro ou recente (< 30 min) sem confirmação. | Gerada na visualização da agenda a partir da regra de horários do medicamento. |
| **Dose Confirmada pelo Paciente** | `confirmed` | Paciente confirmou a ingestão pelo aplicativo Android. | `performed_by = patient_id`, `origin = 'patient_app'`, `is_retroactive = false`. |
| **Dose Registrada pelo Cuidador** | `confirmed` | Cuidador registrou a administração em nome do paciente. | `performed_by = caregiver_id`, `origin = 'caregiver_web'`, `is_retroactive = true`. |
| **Dose Explicitamente Não Administrada** | `missed` | Paciente ou cuidador registrou recusa, indisposição ou suspensão médica. | `status = 'missed'`, `motivo` preenchido obrigatoriamente. |
| **Dose Atrasada** | `late` | Dose tomada com atraso superior à janela de tolerância (> 30 min). | `status = 'late'`, `atraso_minutos` calculado automaticamente. |
| **Dose sem Confirmação** | *Ausência de registro* ou `pending` expirado | Horário ultrapassado sem ação registrada. | **Importante:** A ausência de registro NÃO é tratada como "dose omitida" nem subtrai da taxa de adesão sem auditoria fática. |
