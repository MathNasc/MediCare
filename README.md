# 💊 MediCare — Ecossistema de Saúde e Cuidado Compartilhado

O **MediCare** é uma plataforma integrada de saúde voltada ao controle de adesão medicamentosa e ao acompanhamento compartilhado entre pacientes e cuidadores.

O ecossistema em produção é composto por duas aplicações oficiais que compartilham o mesmo backend **Next.js (App Router)** e banco de dados **PostgreSQL 16 na Oracle Cloud** (100% self-hosted):
1. **MediCare Paciente Android** (`apps/paciente-android` & `src-apk/` → `MediCare-Paciente.apk`): Aplicativo nativo Android para pacientes (independentes ou acompanhados).
2. **MediCare Cuidador Web** (`src/app/cuidador/page.jsx`): Aplicação web responsiva oficial para cuidadores e familiares autorizados.

---

## 🏛️ Estrutura do Repositório

```text
MediCare/
├── apps/
│   └── paciente-android/       # Aplicativo Android nativo (Kotlin / Jetpack Compose) [ATIVO]
├── src-apk/                    # Código Java, Manifesto e Recursos de empacotamento Android
├── src/
│   ├── app/
│   │   ├── api/                # Endpoints REST/RPC compartilhados (/auth/v1, /rest/v1, /v1/sync, /apk, /ai)
│   │   ├── cuidador/
│   │   │   └── page.jsx        # Aplicação oficial MediCare Cuidador Web (Next.js) [ATIVA]
│   │   ├── layout.jsx          # Layout raiz do portal e aplicação web
│   │   └── page.jsx            # Portal institucional e download do APK (/ e /?portal=1)
│   ├── lib/                    # Autenticação (HttpOnly/Bearer + CSRF), PostgreSQL e serviços de domínio
│   ├── data/                   # Catálogo farmacêutico de medicamentos
│   └── __tests__/              # Testes automatizados de segurança, autorização e domínio (Jest)
├── database/
│   └── migrations/             # Esquemas SQL versionados (01, 02 e 03_incremental_compatibility.sql)
├── oracle-migration/           # Scripts de infraestrutura, Docker, Nginx e deploy na Oracle Cloud
├── docs/                       # Documentação técnica consolidada
│   ├── ARCHITECTURE.md         # Arquitetura e separação de responsabilidades
│   ├── API_CONTRACT.md         # Contratos REST, RPC, Autenticação Cookie/Bearer e CSRF
│   ├── DATA_MODEL.md           # Dicionário de dados PostgreSQL e estados de administração
│   ├── BACKEND_AUDIT.md        # Auditoria de endpoints, segurança e migrações
│   └── DEPLOYMENT_AND_TESTS.md # Procedimentos de migração, build, testes e deploy
├── scripts/
│   ├── run_migrations.js       # Verificação e execução controlada de migrações versionadas
│   └── rebuild_and_sign_apk.sh # Pipeline automatizado de compilação e assinatura do APK
├── public/                     # Manifesto, ícones e assets públicos
├── MediCare-Paciente.apk       # Instalador APK final, validado e assinado na raiz
├── AGENTS.md                   # Diretrizes de arquitetura e manutenção do repositório
└── README.md                   # Visão geral do projeto
```

---

## 📱 Compilando o MediCare Paciente (APK)

O pipeline automatizado compila os fontes nativos, gera o bytecode Dalvik (`classes.dex`), alinha em 4 bytes com `zipalign` e assina o pacote com esquemas v1, v2 e v3 via `apksigner`:

```bash
bash scripts/rebuild_and_sign_apk.sh
```

O arquivo `MediCare-Paciente.apk` atualizado e validado é gerado diretamente na raiz do repositório.

---

## 🗄️ Banco de Dados e Migrações Versionadas

A verificação de conexão, a checagem de versão do esquema (`schema_migrations`) e a execução de migrações são estritamente separadas do fluxo de requisições HTTP:

```bash
# Verificar estado do esquema (somente leitura)
node scripts/run_migrations.js --check

# Aplicar migrações pendentes (somente com autorização explícita)
node scripts/run_migrations.js --apply
```

---

## 🚀 Executando Localmente

### 1. Instalação de Dependências

```bash
npm install
```

### 2. Variáveis de Ambiente

Configure o `.env.local` na raiz com base no `.env.example`:

```env
DATABASE_URL=postgresql://medicare_app:sua_senha@127.0.0.1:5436/medicare_db
ORACLE_JWT_SECRET=segredo-hmac-sha256-producao
GEMINI_API_KEY=sua-chave-api-gemini
NEXT_PUBLIC_APP_URL=https://medicare-cuidador.duckdns.org
```

### 3. Iniciar Servidor de Desenvolvimento

```bash
npm run dev
```

- **Portal MediCare:** `http://localhost:3000/?portal=1`
- **MediCare Cuidador Web:** `http://localhost:3000/cuidador`
- **Download do APK Android:** `http://localhost:3000/api/apk`

---

## 🧪 Testes Automatizados

```bash
npm test
```

---

## 📌 Estado Consolidado do Projeto

- **Arquitetura Unificada do Cuidador:** `src/app/cuidador/page.jsx` é a única aplicação web oficial do MediCare Cuidador (a antiga estrutura paralela em Vite foi removida).
- **Segurança de Sessão:** Sessão web baseada em cookies `HttpOnly`, `Secure` e `SameSite=Lax` com proteção CSRF (`X-CSRF-Token` + validação de `Origin`), mantendo compatibilidade com `Authorization: Bearer` para o app Android.
- **Autorização Estrita de Pacientes:** Validação obrigatória de vínculo ativo (`caregiver_relationships.status = 'active'`) e nível de permissão em todas as rotas REST e RPCs, com bloqueio de IDOR.
- **Rastreabilidade Clínica de Doses:** Separação entre horário previsto, horário real de administração (`administered_at`) e momento do registro (`created_at`), preservando autor, papel e histórico de auditoria.
