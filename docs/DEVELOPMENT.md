# Guia de Desenvolvimento — MediCare

Este documento reúne os requisitos técnicos, comandos e diretrizes para desenvolvimento, compilação e testes no projeto MediCare.

---

## 1. Requisitos do Ambiente

- **Node.js:** v18.0.0 ou superior (v20 recomendado).
- **NPM:** v9 ou superior.
- **Java Development Kit (JDK):** JDK 8+ (para empacotamento Android).
- **Android SDK Tools:** `aapt`, `dalvik-exchange` (ou `d8`), `zipalign`, `apksigner`.
- **PostgreSQL:** Versão 15 ou 16 (local ou via `ORACLE_BACKEND_URL` no proxy fallback em ambientes externos).

---

## 2. Configuração e Variáveis de Ambiente

Crie `.env.local` (desenvolvimento) ou `.env.production` (VM Oracle) com base em `.env.example`:

```env
DATABASE_URL=postgresql://medicare_app:sua_senha@127.0.0.1:5436/medicare_db
ORACLE_PG_HOST=127.0.0.1
ORACLE_PG_PORT=5436
ORACLE_PG_DATABASE=medicare_db
ORACLE_PG_USER=medicare_app
ORACLE_PG_PASSWORD=sua_senha
ORACLE_PG_SSL=false
ORACLE_BACKEND_URL=http://144.22.160.191:3009
GEMINI_API_KEY=sua-chave-api-gemini
NEXT_PUBLIC_APP_URL=https://medicare-cuidador.duckdns.org
```

> Em ambientes de preview onde a porta TCP do PostgreSQL estiver inacessível, `connectPgOrFallback` (`src/lib/oracleProxy.js`) redireciona automaticamente as rotas de API para `ORACLE_BACKEND_URL`.

---

## 3. Comandos do Backend & Portal

```bash
# Instalar dependências
npm install

# Iniciar servidor em modo desenvolvimento (porta 3000, assetPrefix dev sem cache)
npm run dev

# Compilar para produção
npm run build

# Iniciar servidor de produção
npm run start

# Executar suíte de testes unitários (6 suítes / 49 testes)
npm test

# Executar linter (ESLint)
npm run lint
```

---

## 4. Pipeline de Compilação dos APKs Android

```bash
# Compila e assina MediCare-Paciente.apk (a partir de /src-apk)
bash scripts/rebuild_and_sign_apk.sh

# Compila e assina MediCare-Cuidador.apk (a partir de /src-apk-cuidador)
bash scripts/rebuild_and_sign_cuidador_apk.sh
```

Ambos os scripts verificam ferramentas (`aapt`, `javac`, `dalvik-exchange`, `zipalign`, `apksigner`), empacotam recursos e mipmaps, compilam Java compatível com API 24+, alinham em 4 bytes, assinam (v1/v2/v3) e validam o binário antes de substituir o `.apk` na raiz.

---

## 5. Regras Críticas de Desenvolvimento

1. **Aplicações Ativas Oficiais:** **MediCare Paciente Android** (`/apps/paciente-android` e `/src-apk`) e **MediCare Cuidador Web/Android** (`/src/app/cuidador/page.jsx` e `/src-apk-cuidador`).
2. O antigo frontend web de paciente e o projeto paralelo Vite foram removidos e **não devem ser recriados**.
3. Não execute DDL silencioso durante requisições HTTP; use sempre migrações explícitas em `/database/migrations` via `scripts/run_migrations.js`.
4. Mantenha `MediCare-Paciente.apk` e `MediCare-Cuidador.apk` atualizados na raiz após alterações nos respectivos pacotes Android.
