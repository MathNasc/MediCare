# Arquitetura do Sistema MediCare

Este documento descreve a arquitetura atual do ecossistema MediCare e a separação de responsabilidades entre os componentes.

---

## 1. Visão Geral dos Componentes

O MediCare é estruturado como um monorepo que suporta múltiplos clientes e serviços compartilhados:

```text
MediCare Monorepo
├── apps/
│   ├── paciente-android/    # App nativo Android (Kotlin / Jetpack Compose) [ATIVO]
│   └── cuidador-web/        # PWA Cuidador Web (React / Vite / TypeScript) [PLANEJADO]
├── src/
│   ├── app/api/             # Endpoints REST (Next.js App Router)
│   ├── lib/                 # Camada de serviços de domínio e acesso a dados (PostgreSQL)
│   └── data/                # Catálogos estáticos e referências médicas
├── database/migrations/     # Esquemas e migrações do PostgreSQL
├── oracle-migration/        # Scripts de infraestrutura e deployment no servidor Oracle
├── scripts/                 # Ferramentas de automação e compilação do APK nativo
└── MediCare-Paciente.apk    # Binário compilado e assinado na raiz
```

---

## 2. Componentes e Responsabilidades

### 2.1. MediCare Paciente Android (`apps/paciente-android` & `src-apk/`)
- **Papel:** Única aplicação ativa em produção para uso direto pelo paciente.
- **Tecnologias:** Kotlin, Jetpack Compose, Android SDK (API 24+ a 33), Dalvik Bytecode, `AlarmManager`.
- **Características:**
  - Suporte completo offline-first com sincronização periódica e sob demanda.
  - Agendamento exato de alarmes com `AlarmManager.setExactAndAllowWhileIdle`.
  - Telas dedicadas para: Hoje (doses do dia), Medicamentos, Calendário de doses, Assistente de saúde e Perfil.
  - Perfis de usuário com suporte a modo "Independente" e modo "Paciente vinculado a cuidador".

### 2.2. Backend & APIs Compartilhadas (`src/app/api` & `src/lib`)
- **Papel:** Servidor central de API REST e distribuição de instaladores.
- **Tecnologias:** Next.js (App Router), Node.js, driver `pg` para PostgreSQL.
- **Principais Módulos:**
  - `/api/auth/v1/`: Registro, login, sessões e validação de tokens (`app_users`, `auth_sessions`).
  - `/api/v1/`: Endpoints de domínio para pacientes, medicamentos, doses, estoque e histórico.
  - `/api/apk`: Rota de streaming otimizado para download do APK assinado com validação de cache.
  - `/api/ai/`: Integração de assistência de saúde com Google Gemini API.
  - `/src/lib/`: Serviços compartilhados de banco (`oraclePostgres.js`), regras de dose (`doseUtils.js`), estoque (`stockService.js`) e cuidadores (`caregiverService.js`).

### 2.3. Banco de Dados PostgreSQL Standalone (`database/migrations` & `oracle-migration`)
- **Papel:** Persistência relacional de alta confiabilidade.
- **Hospedagem:** Instância isolada no servidor Oracle Cloud (`medicare_db`).
- **Estrutura:**
  - `app_users`: Contas de usuários autenticados.
  - `patient_profiles` / `patients`: Dados de saúde, tipo de perfil e contatos de emergência.
  - `medications`: Medicamentos, posologia, horários e níveis de estoque.
  - `doses` & `dose_history`: Agenda e confirmações de administração.
  - `caregiver_patients`: Vínculos entre cuidadores e pacientes com papéis e autorizações.
  - `audit_logs`: Trilha de auditoria imutável com registro de ator, ação e timestamp.

### 2.4. MediCare Cuidador Web (`apps/cuidador-web`)
- **Papel:** Futura aplicação web responsiva (PWA) dedicada a familiares e cuidadores profissionais.
- **Status:** Estrutura preparada para implementação nas Etapas 2, 3 e 4.
