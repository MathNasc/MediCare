# 💊 MediCare — Ecossistema de Saúde e Cuidado Compartilhado

O **MediCare** é uma plataforma integrada de saúde voltada ao controle de adesão medicamentosa e ao acompanhamento compartilhado entre pacientes, cuidadores e clínicas.

O ecossistema em produção é 100% self-hosted na **Oracle Cloud** sobre um único backend **Next.js 14 (App Router)** e banco **PostgreSQL 16 (`medicare_db`)**:
1. **MediCare Paciente Android** (`apps/paciente-android` & `src-apk/` → `MediCare-Paciente.apk`, `v2.9.0`): Aplicativo nativo Android para pacientes (independentes ou dependentes).
2. **MediCare Cuidador Web & PWA** (`src/app/cuidador/page.jsx`, `v2.0.0`): Aplicação web oficial para cuidadores, familiares e clínicas autorizadas, operando no fuso oficial **`America/Sao_Paulo` (Brasília)**.
3. **MediCare Cuidador Android** (`src-apk-cuidador/` → `MediCare-Cuidador.apk`, `v2.0.0`): Empacotamento Android dedicado ao painel do cuidador.
4. **Portal MediCare** (`src/app/page.jsx`): Página institucional pública (`/`, `/?portal=1`) com acesso direto ao **MediCare Cuidador** e download das versões mobile (Android/PWA) para cuidador e paciente.

---

## 🏛️ Estrutura do Repositório

```text
MediCare/
├── apps/
│   └── paciente-android/          # Aplicativo Android nativo do Paciente (Kotlin / Jetpack Compose)
├── src-apk/                       # Empacotamento Java, Manifesto e Recursos -> MediCare-Paciente.apk
├── src-apk-cuidador/              # Empacotamento Java, Manifesto e Recursos -> MediCare-Cuidador.apk
├── src/
│   ├── app/
│   │   ├── api/                   # Rotas REST, RPC, Auth, Sync, Caregiver Settings/Notifs, AI, System & APK
│   │   ├── cuidador/
│   │   │   └── page.jsx           # Aplicação oficial MediCare Cuidador Web (Next.js App Router)
│   │   ├── CuidadorAutoRedirect.jsx
│   │   ├── CuidadorPortalActions.jsx
│   │   ├── layout.jsx             # Layout raiz e metadados PWA
│   │   └── page.jsx               # Portal institucional e distribuição dos aplicativos
│   ├── lib/
│   │   ├── appVersions.js         # Leitura dinâmica de versões Web, SW e APKs Android
│   │   ├── auditFormatter.js      # Formatação clínica e legível de logs de auditoria
│   │   ├── brazilTime.js          # Helpers determinísticos de fuso horário America/Sao_Paulo (-03:00)
│   │   ├── careSettings.js        # Regras de gerenciamento (Por Paciente, Global e Grupos) + herança
│   │   ├── caregiverCalendar.js   # Grade mensal e linha do dia para agenda do cuidador
│   │   ├── caregiverNotifications.js # Alertas persistentes e notificações push para cuidadores
│   │   ├── oracleAuth.js          # Autenticação híbrida (Cookies HttpOnly + Bearer + CSRF + sid)
│   │   ├── oraclePostgres.js      # Pool PostgreSQL com separação entre conexão, check e migrações
│   │   ├── oracleProxy.js         # Fallback HTTP automático anti-loop para o backend Oracle Cloud
│   │   ├── reminderWorker.js      # Agendamento e alertas automáticos de atraso de doses
│   │   ├── usePWA.js              # Registro de Service Worker (v7) e instalação PWA
│   │   └── webPush.js             # Assinatura e disparo Web Push (VAPID)
│   └── __tests__/                 # 6 suítes Jest (49 testes unitários e de integração)
├── database/
│   └── migrations/                # Esquemas e migrações incrementais (02, 03, 04 e 05)
├── oracle-migration/              # Scripts de infraestrutura Oracle, Nginx, systemd e backup
├── docs/                          # Documentação técnica consolidada
├── scripts/
│   ├── run_migrations.js          # Verificação (--check) e execução controlada (--apply) de migrações
│   ├── rebuild_and_sign_apk.sh          # Build e assinatura v1/v2/v3 do MediCare-Paciente.apk
│   └── rebuild_and_sign_cuidador_apk.sh # Build e assinatura v1/v2/v3 do MediCare-Cuidador.apk
├── public/                        # Manifesto, Service Worker (sw.js), ícones e assetlinks
├── MediCare-Paciente.apk          # Instalador Android do Paciente assinado na raiz
├── MediCare-Cuidador.apk          # Instalador Android do Cuidador assinado na raiz
├── AGENTS.md                      # Diretrizes permanentes de arquitetura e segurança
└── README.md                      # Visão geral do projeto
```

---

## ✨ Principais Funcionalidades Atuais

- **Central de Doses & Validações:** Linha do dia e ações rápidas em horário de Brasília (`America/Sao_Paulo`), aprovação/recusa de solicitações enviadas pelo app do paciente e avanço automático para a próxima dose no aplicativo.
- **Painel de Gerenciamento (Paciente / Global / Grupos):** Configuração granular ou em lote para clínicas e cuidadores com herança em 3 níveis (**Global da Clínica**, **Grupos de Pacientes** e **Individual por Paciente**), controlando tempo de atraso para notificação, exigência de confirmação em doses no horário/perdidas/desfazer, janela de dose perdida, edição de remédios pelo paciente, estoque baixo e alertas de uso SOS.
- **Calendário & Agenda Unificada:** Grade mensal com indicadores visuais, criação/edição/exclusão de consultas, exames, procedimentos e notas diárias diretamente por data selecionada.
- **Sobre & Apps:** Exibição dinâmica das versões Web, Paciente Android e Cuidador Android com links diretos de download de ambos os APKs e instalação PWA.

---

## 📱 Compilando os APKs Android

```bash
# MediCare Paciente (gera MediCare-Paciente.apk)
bash scripts/rebuild_and_sign_apk.sh

# MediCare Cuidador (gera MediCare-Cuidador.apk)
bash scripts/rebuild_and_sign_cuidador_apk.sh
```

---

## 🗄️ Banco de Dados e Migrações Versionadas

```bash
# Carregar variáveis (.env.production ou .env.local) e checar esquema (somente leitura)
node scripts/run_migrations.js --check

# Aplicar migrações pendentes (03, 04 e 05)
set -a && for f in .env .env.production .env.local; do if [ -f "$f" ]; then . "./$f"; fi; done && set +a
node scripts/run_migrations.js --apply
```

---

## 🚀 Executando Localmente & Deploy Oracle Cloud

```bash
npm install
npm run dev      # Desenvolvimento na porta 3000 (com assetPrefix exclusivo dev)
npm test         # 6 suítes / 49 testes Jest
npm run lint     # ESLint
npm run build    # Build de produção
```

**Deploy na VM Oracle (`~/MediCare`, serviço `medicare-backend.service` na porta `3009`):**

```bash
cd ~/MediCare && git pull && npm install && set -a && for f in .env .env.production .env.local; do if [ -f "$f" ]; then . "./$f"; fi; done && set +a && node scripts/run_migrations.js --apply && rm -rf .next && npm run build && sudo systemctl restart medicare-backend
```
