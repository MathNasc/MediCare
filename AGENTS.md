---
name: medicare-diretriz-permanente
description: "Diretriz permanente de desenvolvimento do MediCare: MediCare Paciente Android é a única aplicação ativa em desenvolvimento; código web legado foi removido."
---

# MEDICARE — DIRETRIZ PERMANENTE DE DESENVOLVIMENTO

As seguintes regras são **obrigatórias e permanentes** para todas as alterações neste projeto, inclusive quando não forem mencionadas explicitamente na solicitação do usuário.

## 1. Aplicação principal: MediCare Paciente Android
- O **MediCare Paciente Android** (`/apps/paciente-android` em Kotlin e Jetpack Compose, e empacotamento nativo Android em `/src-apk` / `MediCare-Paciente.apk`) é a **única aplicação ativa em desenvolvimento**.
- Todo o desenvolvimento deve ocorrer exclusivamente no aplicativo Android.
- Toda alteração, correção, melhoria, implementação de funcionalidade ou mudança de UI/UX deve ser realizada exclusivamente no aplicativo Android.

## 2. Todo o desenvolvimento deve ocorrer no aplicativo Android
- O app Android possui arquitetura nativa com suporte completo offline, notificações exatas via `AlarmManager`, sincronização com o banco e telas de auto-cuidado, estoque, doses e perfis.

## 3. Não implementar funcionalidades no frontend web
- Não crie novas interfaces React para usuários ou fluxos de paciente na web.
- A camada web atua unicamente como servidor de API (`/src/app/api`) e distribuição do instalador APK (`/api/apk`).

## 4. Código web legado foi removido e não deve ser recriado sem autorização
- As telas, componentes, hooks, contextos e estilos da antiga versão web/PWA foram totalmente auditados e removidos do repositório para evitar duplicidade e manter o projeto focado e limpo.
- Não recrie telas nem componentes React web sem autorização expressa.

## 5. MediCare Cuidador é um projeto futuro, a ser criado do zero apenas quando autorizado
- Futuramente, somente quando houver **autorização explícita do usuário**, será desenvolvido o **MediCare Cuidador**, uma aplicação web responsiva criada do zero e com arquitetura própria.
- Até essa autorização explícita, não inicie o desenvolvimento nem prepare telas para o cuidador web.

## 6. Backend e banco de dados só devem ser alterados quando necessário ao Android
- O backend compartilhado (`/src/app/api`), bibliotecas (`/src/lib`) e o banco de dados PostgreSQL na Oracle Cloud (`/oracle-migration`) só devem ser alterados quando estritamente necessário para o funcionamento do app Android, preservando a compatibilidade de dados e a segurança.

## 7. O APK MediCare-Paciente.apk deve ser mantido atualizado na raiz após cada alteração relevante
- Após qualquer alteração que afete o aplicativo Android, execute o pipeline de build:
  ```bash
  bash scripts/rebuild_and_sign_apk.sh
  ```
- O arquivo `MediCare-Paciente.apk` na raiz deve ser validado, assinado e mantido pronto para download e testes.

## 8. Antes de qualquer alteração, consultar e respeitar essas diretrizes
- Todo agente e desenvolvedor que interagir com o repositório deve consultar e respeitar rigorosamente essas diretrizes permanentes.

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
