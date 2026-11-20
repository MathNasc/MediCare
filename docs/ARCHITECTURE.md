# Arquitetura do Sistema MediCare

Este documento descreve a arquitetura consolidada do ecossistema MediCare e a separação de responsabilidades entre seus componentes em produção.

---

## 1. Visão Geral dos Componentes

O MediCare é estruturado como um monorepo self-hosted que integra os aplicativos nativos Android, a aplicação web/PWA oficial do cuidador e o backend compartilhado em Next.js 14 com PostgreSQL 16:

```text
MediCare/
├── apps/
│   └── paciente-android/          # App nativo Android do Paciente (Kotlin / Jetpack Compose)
├── src-apk/                       # Empacotamento Dalvik, Manifesto e Recursos -> MediCare-Paciente.apk
├── src-apk-cuidador/              # Empacotamento Dalvik, Manifesto e Recursos -> MediCare-Cuidador.apk
├── src/
│   ├── app/
│   │   ├── api/                   # Endpoints REST, RPC, Auth, Sync, Caregiver, AI, System e APK
│   │   ├── cuidador/              # Aplicação oficial MediCare Cuidador Web/PWA (page.jsx)
│   │   ├── CuidadorAutoRedirect.jsx
│   │   ├── CuidadorPortalActions.jsx
│   │   └── page.jsx               # Portal institucional e distribuição mobile (/ e /?portal=1)
│   ├── lib/
│   │   ├── appVersions.js         # Versionamento dinâmico Web, SW e APKs Android
│   │   ├── auditFormatter.js      # Tradução amigável de logs de auditoria clínica
│   │   ├── brazilTime.js          # Fuso horário oficial America/Sao_Paulo (-03:00)
│   │   ├── careSettings.js        # Regras Global, Grupos e Por Paciente com resolução por herança
│   │   ├── caregiverCalendar.js   # Lógica de calendário mensal e eventos diários do cuidador
│   │   ├── caregiverNotifications.js # Notificações de atraso, solicitações e uso SOS
│   │   ├── oracleAuth.js          # Sessões isoladas (sid), cookies HttpOnly, CSRF e Bearer
│   │   ├── oraclePostgres.js      # Pool pg com verificação de esquema sem DDL implícito
│   │   ├── oracleProxy.js         # Fallback proxy anti-loop para a API Oracle Cloud em previews
│   │   ├── reminderWorker.js      # Worker de alertas de atraso respeitando overdue_notify_minutes
│   │   ├── usePWA.js              # Service Worker (v7) e prompt PWA
│   │   └── webPush.js             # Registro Web Push VAPID
│   └── __tests__/                 # Suíte Jest (6 arquivos, 49 testes)
├── database/migrations/           # Esquema standalone e migrações (02, 03, 04, 05)
├── oracle-migration/              # Infraestrutura Oracle Cloud, systemd, Nginx e backup
├── scripts/                       # Migrações (run_migrations.js) e builds dos 2 APKs
├── MediCare-Paciente.apk          # Binário Android do Paciente assinado na raiz
└── MediCare-Cuidador.apk          # Binário Android do Cuidador assinado na raiz
```

---

## 2. Componentes e Responsabilidades

### 2.1. MediCare Paciente Android (`apps/paciente-android` & `src-apk/`)
- **Papel:** Aplicação oficial para uso direto pelo paciente (Independente ou Dependente vinculado).
- **Características:**
  - Operação offline-first com sincronização via `/api/v1/sync` e autenticação `Authorization: Bearer`.
  - Consumo das regras clínicas efetivas (`care_settings`) para decidir se confirmação/desfazimento exige validação do cuidador (no horário ou após dose perdida).
  - Avanço automático para a próxima dose após enviar solicitação de validação ao cuidador, retornando à fila se rejeitada dentro da janela válida.

### 2.2. MediCare Cuidador Web & Android (`src/app/cuidador/page.jsx` & `src-apk-cuidador/`)
- **Papel:** Aplicação web/PWA e empacotamento Android oficial para cuidadores, familiares e clínicas.
- **Tecnologias:** Next.js 14 (App Router), React 18, Tailwind CSS, Lucide Icons, Service Worker (`sw.js` v7).
- **Características:**
  - Sessão autenticada via cookies `HttpOnly`, `Secure`, `SameSite=Lax` e cabeçalho `X-CSRF-Token`.
  - **Fuso horário Brasília (`America/Sao_Paulo`):** Cálculos de data, hora, atrasos e exibição padronizados em `-03:00` via `src/lib/brazilTime.js`.
  - **Central de Doses, Pacientes, Medicamentos & Estoque, Indicadores e Auditoria.**
  - **Calendário & Agenda Unificada:** Grade mensal completa com resumo diário de consultas, exames, procedimentos, anotações e movimentações (`src/lib/caregiverCalendar.js`).
  - **Painel de Gerenciamento:** Escopos **Por Paciente**, **Global (Clínica)** e **Grupos** (`caregiver_patient_groups`), com aplicação individual, em lote ou por herança automática.
  - **Sobre & Apps:** Informações de versão do Web App e download direto dos APKs de Paciente e Cuidador.

### 2.3. Backend, APIs Compartilhadas & Fallback Proxy (`src/app/api` & `src/lib`)
- `/api/auth/v1/*`: Cadastro, login, rotação de refresh token, perfil, alteração de senha, logout por `sid` e exclusão de conta.
- `/api/rest/v1/*`: Roteador REST e RPCs com autorização estrita por vínculo ativo (`caregiver_relationships.status = 'active'`) e proteção contra IDOR.
- `/api/v1/caregiver/settings`: CRUD de regras globais, grupos da clínica, regras por paciente e atribuição em massa.
- `/api/v1/caregiver/notifications`: Listagem e marcação de leitura de alertas de solicitação, atraso e uso SOS.
- `/api/v1/sync`: Sincronização bidirecional do app Android (incluindo `care_settings` efetivo e `pending_dose_requests`).
- `/api/apk`, `/api/apk/cuidador`, `/api/apk/version`, `/api/system/versions`: Distribuição dos binários APK e metadados de versão.
- `/api/v1/health`: Saúde do PostgreSQL local e fallback de status proxy.
- **`oracleProxy.js` (`connectPgOrFallback`):** Em ambientes externos de preview onde a porta TCP do PostgreSQL Oracle esteja bloqueada por firewall, detecta timeout/falha de rede (`isPgConnectionNetworkError`), faz cache negativo temporário (60s) e encaminha com proteção anti-loop (`x-medicare-proxy-hop: 1` e checagem de host) para o backend HTTP oficial da Oracle Cloud.

### 2.4. Banco de Dados PostgreSQL (`database/migrations`)
- **Hospedagem:** Container `postgres:16-alpine` (`medicare_db`) isolado em `127.0.0.1:5436` na VM Oracle Cloud.
- **Migrações aplicáveis:** `02_schema_oracle_standalone.sql`, `03_incremental_compatibility.sql`, `04_caregiver_management_settings.sql`, `05_caregiver_groups_and_global_settings.sql`.
