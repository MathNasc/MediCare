---
name: medicare-diretriz-permanente
description: "Diretriz permanente de desenvolvimento do MediCare: MediCare Paciente Android e MediCare Cuidador Web oficial integrados ao backend Next.js e PostgreSQL Oracle."
---

# MEDICARE — DIRETRIZ PERMANENTE DE DESENVOLVIMENTO

As seguintes regras são **obrigatórias e permanentes** para todas as alterações neste projeto:

## 1. Aplicações Oficiais Ativas
- **MediCare Paciente Android** (`/apps/paciente-android` em Kotlin/Jetpack Compose e empacotamento nativo em `/src-apk` / `MediCare-Paciente.apk`): única aplicação para uso direto pelo paciente (independente ou dependente).
- **MediCare Cuidador Web** (`/src/app/cuidador/page.jsx`): única aplicação web oficial para cuidadores e familiares autorizados, servida diretamente pelo Next.js App Router.
- **Portal MediCare** (`/src/app/page.jsx`): página pública institucional com acesso ao MediCare Cuidador e download direto do instalador Android (`/api/apk`).

## 2. Proibição de Frontends Paralelos ou Duplicados
- Não crie aplicações paralelas (como projetos Vite separados em `/apps/cuidador-web`) nem recrie telas web legadas de paciente.
- Toda evolução do MediCare Cuidador deve ocorrer exclusivamente em `/src/app/cuidador/page.jsx` e seus módulos compartilhados em `/src/lib`.
- Toda evolução do fluxo do paciente deve ocorrer exclusivamente no aplicativo Android (`/apps/paciente-android` e `/src-apk`).

## 3. Segurança de Autenticação, Autorização e Dados Clínicos
- **Sessão Web:** Utiliza cookies `HttpOnly`, `Secure` e `SameSite=Lax` com proteção CSRF (`X-CSRF-Token`), sem armazenar JWT ou refresh tokens em `localStorage`.
- **Compatibilidade Mobile:** O backend preserva suporte completo a `Authorization: Bearer <token>` para o MediCare Paciente Android.
- **Autorização de Pacientes:** Toda consulta ou modificação de dados de pacientes no backend deve validar vínculo ativo (`caregiver_relationships.status = 'active'`) e permissão compatível. Nunca listar perfis sem vínculo explícito.
- **Formulários Clínicos:** Nunca utilizar valores clínicos predefinidos (como tipo sanguíneo `'O+'`, datas de nascimento fictícias ou dosagens padrão) em formulários de pacientes e medicamentos.

## 4. Banco de Dados e Migrações
- O banco PostgreSQL na Oracle Cloud (`medicare_db`) utiliza migrações explícitas, versionadas e não destrutivas em `/database/migrations`.
- Nenhuma alteração de esquema (`ALTER TABLE` / `CREATE TABLE`) deve ser executada silenciosamente durante requisições HTTP normais. Utilize `scripts/run_migrations.js`.

## 5. Atualização do APK Android
- Após qualquer alteração que afete o aplicativo Android (`/apps/paciente-android` ou `/src-apk`), execute obrigatoriamente:
  ```bash
  bash scripts/rebuild_and_sign_apk.sh
  ```
- Mantenha o arquivo `MediCare-Paciente.apk` validado e assinado na raiz do repositório.

---
name: cleanup-test-files
description: "Sempre que terminar testes ou investigações, limpe e delete arquivos temporários que foram gerados."
---

# Limpeza de Arquivos Temporários
Sempre que gerar arquivos temporários para testes (como scripts `test.js`, rotas de API de diagnóstico isoladas, arquivos `output.json`, patches experimentais, etc) e a investigação ou teste for concluída com sucesso, você **DEVE** deletar esses arquivos. Mantenha o repositório limpo, focado apenas no código final do produto.

---
name: premortem  
description: "Executa um premortem sobre qualquer plano, lançamento, produto, contratação, estratégia ou decisão. Assume que já falhou 6 meses depois e trabalha de trás para frente para encontrar todos os motivos. Produz um plano revisado com os pontos cegos expostos. GATILHOS OBRIGATÓRIOS: 'premortem isso', 'meu premortem', 'execute um premortem', 'o que poderia matar isso', 'teste de estresse neste plano', 'o que estou perdendo aqui', 'encontre os pontos cegos'."  
---

# Premortem

Um premortem é o oposto de um postmortem. Em vez de descobrir o que deu errado depois que algo falha, você imagina que já falhou e descobre o porquê antes de começar.
