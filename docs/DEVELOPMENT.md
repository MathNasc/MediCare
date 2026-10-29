# Guia de Desenvolvimento — MediCare

Este documento reúne os requisitos técnicos, comandos e diretrizes para desenvolvimento, compilação e testes no projeto MediCare.

---

## 1. Requisitos do Ambiente

- **Node.js:** v18.0.0 ou superior (v20 recomendado).
- **NPM:** v9 ou superior.
- **Java Development Kit (JDK):** JDK 8 ou 11 (headless ou completo) para compilação Android.
- **Android SDK Tools:** `aapt`, `dalvik-exchange` (ou `d8`), `zipalign`, `apksigner`.
- **PostgreSQL:** Versão 15 ou 16 (local ou conexão com Oracle Cloud).

---

## 2. Configuração e Variáveis de Ambiente

Crie o arquivo `.env.local` na raiz do projeto com base no modelo `.env.example`:

```env
DATABASE_URL=postgresql://medicare_app:sua_senha@127.0.0.1:5436/medicare_db
ORACLE_PG_HOST=127.0.0.1
ORACLE_PG_PORT=5436
ORACLE_PG_DATABASE=medicare_db
ORACLE_PG_USER=medicare_app
ORACLE_PG_PASSWORD=sua_senha
ORACLE_PG_SSL=false
GEMINI_API_KEY=sua-chave-api-gemini
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 3. Comandos do Backend & Portal

```bash
# Instalar dependências
npm install

# Iniciar servidor em modo desenvolvimento (porta 3000)
npm run dev

# Compilar para produção
npm run build

# Iniciar servidor de produção
npm run start

# Executar suíte de testes unitários
npm test

# Executar linter
npm run lint
```

---

## 4. Pipeline de Compilação do APK Android

O build do aplicativo Android nativo é gerenciado pelo script automatizado:

```bash
bash scripts/rebuild_and_sign_apk.sh
```

### O que o pipeline executa:
1. **Verificação de ferramentas:** Checa `aapt`, `javac`, `dalvik-exchange`, `zipalign` e `apksigner`.
2. **Sincronização de recursos e ícones:** Empacota recursos XML e mipmaps de `/public` em `unsigned.apk`.
3. **Compilação Java:** Compila classes nativas de `/src-apk` em bytecode compatível com Android 7.0+ (API 24+).
4. **Geração Dalvik (`classes.dex`):** Converte bytecode em dex e injeta no arquivo ZIP.
5. **Alinhamento em 4 bytes (`zipalign`):** Garante alinhamento ótimo de memória.
6. **Assinatura v1, v2 e v3 (`apksigner`):** Assina o pacote com a chave de debug (`debug-keystore.bin`).
7. **Validação:** Valida assinaturas e atualiza `MediCare-Paciente.apk` na raiz somente se 100% íntegro.

---

## 5. Regras Críticas de Desenvolvimento

1. **MediCare Paciente Android** é a única aplicação ativa. Modificações funcionais de telas e fluxos de paciente devem ocorrer exclusivamente nele.
2. O antigo frontend web foi removido e não deve ser recriado.
3. Não modifique esquemas do banco ou configurações de produção sem validação prévia.
4. Mantenha o arquivo `MediCare-Paciente.apk` sempre atualizado na raiz após alterações relevantes.
