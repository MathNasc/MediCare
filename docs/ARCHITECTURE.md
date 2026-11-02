# Arquitetura do Sistema MediCare

Este documento descreve a arquitetura consolidada do ecossistema MediCare e a separação de responsabilidades entre seus componentes em produção.

---

## 1. Visão Geral dos Componentes

O MediCare é estruturado como um monorepo self-hosted que integra o aplicativo nativo Android do paciente, a aplicação web oficial do cuidador e o backend compartilhado em Next.js com PostgreSQL 16:

```text
MediCare Monorepo
├── apps/
│   └── paciente-android/    # App nativo Android (Kotlin / Jetpack Compose) [ATIVO]
├── src-apk/                 # Empacotamento Dalvik, Manifesto e Recursos Android [ATIVO]
├── src/
│   ├── app/
│   │   ├── api/             # Endpoints REST e RPC (Next.js App Router)
│   │   ├── cuidador/        # Aplicação oficial MediCare Cuidador Web (page.jsx) [ATIVA]
│   │   └── page.jsx         # Portal institucional e distribuição do APK
│   ├── lib/                 # Autenticação (HttpOnly/Bearer + CSRF), PostgreSQL e domínio
│   ├── data/                # Catálogo farmacêutico estático
│   └── __tests__/           # Suíte de testes unitários e de integração (Jest)
├── database/migrations/     # Esquemas SQL e migrações versionadas do PostgreSQL
├── oracle-migration/        # Scripts de infraestrutura, systemd, Nginx e backup na Oracle Cloud
├── scripts/                 # Automação de migrações (run_migrations.js) e build do APK
└── MediCare-Paciente.apk    # Binário Android compilado e assinado na raiz
```

---

## 2. Componentes e Responsabilidades

### 2.1. MediCare Paciente Android (`apps/paciente-android` & `src-apk/`)
- **Papel:** Aplicação oficial para uso direto pelo paciente (em perfil Independente ou Paciente Dependente vinculado a cuidador).
- **Tecnologias:** Kotlin, Jetpack Compose, Android SDK (API 24+ a 33), `AlarmManager`.
- **Características:**
  - Operação offline-first com sincronização via `/api/v1/sync` e autenticação `Authorization: Bearer`.
  - Agendamento exato de alarmes com `AlarmManager.setExactAndAllowWhileIdle`.
  - Regra de negócio de perfil: apenas o paciente **Independente** confirma ou desfaz doses diretamente; o paciente **Dependente** envia solicitação de validação (`approval_requests`) com motivo ao cuidador responsável.

### 2.2. MediCare Cuidador Web (`src/app/cuidador/page.jsx`)
- **Papel:** Única aplicação web oficial dedicada a familiares e cuidadores.
- **Tecnologias:** Next.js 14 (App Router), React 18, Tailwind CSS, Lucide Icons.
- **Características:**
  - Sessão autenticada via cookies `HttpOnly`, `Secure`, `SameSite=Lax` e cabeçalho `X-CSRF-Token` (sem armazenamento de tokens em `localStorage`).
  - Gestão estrita de pacientes com vínculo ativo (`caregiver_relationships.status = 'active'`).
  - Central de Doses com distinção de 5 estados clínicos, aprovação/recusa de solicitações do paciente, prescrições, controle de estoque, agenda médica, indicadores e trilha de auditoria.

### 2.3. Backend & APIs Compartilhadas (`src/app/api` & `src/lib`)
- **Papel:** Servidor central de API REST/RPC, autenticação híbrida (Cookie HttpOnly + Bearer) e distribuição do instalador APK.
- **Principais Módulos:**
  - `/api/auth/v1/`: Cadastro, login, renovação rotativa de sessão, revogação isolada por `sid` e recuperação de senha (`src/lib/oracleAuth.js`).
  - `/api/rest/v1/`: Roteador REST compatível com PostgREST e procedimentos RPC com verificação de autorização por paciente e proteção contra IDOR.
  - `/api/v1/sync`: Sincronização bidirecional para o aplicativo Android.
  - `/api/apk`: Streaming do instalador `MediCare-Paciente.apk` assinado.
  - `/src/lib/oraclePostgres.js`: Pool PostgreSQL com separação estrita entre verificação de conexão, verificação de versão (`schema_migrations`) e execução explícita de migrações.

### 2.4. Banco de Dados PostgreSQL Standalone (`database/migrations`)
- **Hospedagem:** Instância PostgreSQL 16 isolada no servidor Oracle Cloud (`medicare_db`).
- **Tabelas Reais do Esquema:**
  - `app_users` & `auth_sessions` & `password_reset_tokens`: Identidade, sessões isoladas e credenciais (`pgcrypto`).
  - `profiles` & `roles`: Dados cadastrais, tipo de perfil (`paciente`, `cuidador`, `independente`) e flag de dependente gerenciado (`is_managed`, `managed_by`).
  - `medicamentos` & `stock_movements`: Tratamentos contínuos, temporários e SOS, horários (`text[]`) e movimentações de estoque.
  - `historico_doses` & `dose_observations`: Registros de administração com horário previsto (`hora`), horário real (`administered_at`), momento do registro (`created_at`), autor (`performed_by`, `confirmed_by_role`) e origem (`origin`).
  - `caregiver_relationships`, `caregiver_notes` & `caregiver_audit_log`: Vínculos N:M entre cuidadores e pacientes com níveis de permissão (`viewer`, `read_only`, `caregiver`, `read_write`, `admin`).
  - `approval_requests` & `notificacoes`: Solicitações de confirmação/desfazimento de dose enviadas por pacientes dependentes ao cuidador.
  - `health_events`, `notes`, `calendar_notes`, `allergies`, `health_conditions`, `emergency_contacts`, `healthcare_professionals`: Prontuário e rotina clínica.
  - `audit_logs` & `schema_migrations`: Auditoria clínica imutável e controle de versão das migrações SQL.
