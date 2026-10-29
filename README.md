# 💊 MediCare — Monorepo de Saúde

O **MediCare** é uma solução completa de saúde focada no controle de adesão medicamentosa e cuidado compartilhado.

A aplicação principal e ativa em desenvolvimento é o **MediCare Paciente Android**, integrada a um backend robusto em **Next.js API Routes** e banco de dados **PostgreSQL na Oracle Cloud**. A estrutura do monorepo está preparada para a implementação do **MediCare Cuidador Web**.

---

## 🏛️ Estrutura do Monorepo

```text
MediCare/
├── apps/
│   ├── paciente-android/       # Aplicativo Android nativo (Kotlin / Jetpack Compose) [ATIVO]
│   └── cuidador-web/           # Futura aplicação PWA Cuidador (Etapas 2, 3 e 4)
├── src-apk/                    # Código Java, Manifesto e Recursos de empacotamento Android
├── src/
│   ├── app/
│   │   ├── api/                # Endpoints REST compartilhados (/v1, /auth, /apk, /ai)
│   │   ├── layout.jsx          # Layout do portal de status e distribuição
│   │   └── page.jsx            # Portal de distribuição e download do APK
│   ├── lib/                    # Serviços de domínio, banco de dados e utilitários
│   ├── data/                   # Catálogo de medicamentos
│   └── __tests__/              # Testes automatizados de regras de negócio (Jest)
├── database/
│   └── migrations/             # Esquemas SQL e migrações do PostgreSQL
├── oracle-migration/           # Scripts de infraestrutura, Docker e deploy na Oracle Cloud
├── docs/                       # Documentação técnica e planos de arquitetura
│   ├── ARCHITECTURE.md         # Arquitetura e separação de responsabilidades
│   ├── DEVELOPMENT.md          # Guia de desenvolvimento e comandos
│   └── MEDICARE_CUIDADOR_PLAN.md # Visão e roadmap do MediCare Cuidador
├── scripts/
│   └── rebuild_and_sign_apk.sh # Script automatizado de compilação e assinatura do APK
├── public/                     # Ícones e imagens base do aplicativo
├── MediCare-Paciente.apk       # Instalador APK de debug final, validado e assinado na raiz
├── AGENTS.md                   # Regras de desenvolvimento para agentes de IA
└── README.md                   # Visão geral do repositório
```

---

## 📱 Compilando o MediCare Paciente (APK)

O pipeline automatizado compila os fontes nativos, gera o bytecode Dalvik (`classes.dex`), alinha em 4 bytes com `zipalign` e assina o pacote com esquemas v1, v2 e v3 via `apksigner`:

```bash
bash scripts/rebuild_and_sign_apk.sh
```

O arquivo `MediCare-Paciente.apk` atualizado e validado é gerado diretamente na raiz do repositório.

---

## 🚀 Executando o Backend Localmente

### 1. Instalação de Dependências

```bash
npm install
```

### 2. Variáveis de Ambiente

Configure o `.env.local` na raiz com base no `.env.example`:

```env
DATABASE_URL=postgresql://medicare_app:sua_senha@127.0.0.1:5436/medicare_db
GEMINI_API_KEY=sua-chave-api-gemini
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Iniciar Servidor de Desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) para conferir o status da API e realizar o download do APK.

---

## 🧪 Testes Automatizados

```bash
npm test
```

---

## 📌 Plano de Desenvolvimento (Roadmap)

- **Etapa 0 (Concluída):** Preparação do monorepo, auditoria, reorganização e documentação técnica.
- **Etapa 1 (Próxima):** Auditoria técnica aprofundada e especificação do contrato da API (`docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`).
- **Etapa 2:** Fundação do MediCare Cuidador Web (React, Vite, PWA, Tailwind, shadcn/ui).
- **Etapa 3:** Implementação das funcionalidades do MVP (Central de Administração, Pacientes, Tratamentos, Agenda, Indicadores).
- **Etapa 4:** Testes de segurança, validação de integridade e implantação no servidor Oracle Cloud.

---

## ⚠️ Diretrizes Permanentes de Desenvolvimento

1. O **MediCare Paciente Android** é a única aplicação ativa em desenvolvimento até nova autorização.
2. Todo o desenvolvimento atual deve ocorrer no aplicativo Android.
3. Não implementar funcionalidades no frontend web legado (removido).
4. Código web legado não deve ser recriado sem autorização.
5. MediCare Cuidador é um projeto futuro, a ser implementado estritamente conforme as etapas do plano.
6. Backend e banco de dados só devem ser alterados quando necessário ao Android ou expressamente especificado no plano.
7. O APK `MediCare-Paciente.apk` deve ser mantido atualizado na raiz após cada alteração relevante.
8. Antes de qualquer alteração, consultar e respeitar essas diretrizes.
