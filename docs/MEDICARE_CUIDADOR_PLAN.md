# Plano de Desenvolvimento — MediCare Cuidador

Este documento registra a visão de produto, a arquitetura consolidada e as etapas concluídas do **MediCare Cuidador** e de sua integração com o **MediCare Paciente Android**.

---

## 1. Visão do Produto

O **MediCare Cuidador** é uma aplicação web progressiva (PWA) e empacotada para Android (`MediCare-Cuidador.apk`), responsiva e mobile-first, desenvolvida para que familiares, cuidadores e clínicas acompanhem o tratamento de saúde de um ou múltiplos pacientes com segurança e rastreabilidade.

### Princípios Norteadores:
- **Separação de Papéis:** O paciente utiliza o aplicativo nativo Android (`MediCare Paciente`); o cuidador utiliza o painel oficial (`src/app/cuidador/page.jsx` / `MediCare-Cuidador.apk`).
- **Veracidade de Registros:** Distinção rigorosa entre doses confirmadas pelo paciente, doses registradas pelo cuidador e doses explicitamente perdidas/recusadas, sempre em horário de Brasília (`America/Sao_Paulo`).
- **Isolamento e Segurança:** Controle de acesso baseado em vínculos ativos (`caregiver_relationships.status = 'active'`), cookies `HttpOnly` + CSRF (`X-CSRF-Token`) na Web e Bearer JWT no Android.
- **Rastreabilidade e Auditoria:** Todo registro de dose, validação, alteração de regra clínica ou ajuste de agenda grava ator e snapshot em `audit_logs`.

---

## 2. Histórico de Etapas Executadas

### Etapa 0 — Consolidação do Monorepo (Concluída)
- Remoção completa do legado web de paciente e eliminação de frontends paralelos (`apps/cuidador-web`), consolidando a interface do cuidador diretamente no Next.js App Router (`src/app/cuidador/page.jsx`).
- Organização de `/apps/paciente-android`, `/src-apk`, `/src-apk-cuidador`, `/database/migrations`, `/docs`, `/scripts` e `/oracle-migration`.

### Etapa 1 — Auditoria Técnica, Segurança e Modelo de Dados (Concluída)
- Implementação de sessões isoladas (`auth_sessions.sid`), cookies `HttpOnly` + proteção CSRF e prevenção contra IDOR nas rotas REST/RPC.
- Especificação técnica em `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md` e `docs/SECURITY_REVIEW.md`.

### Etapa 2 — Funcionalidades Base do MediCare Cuidador (Concluída)
- Central de Doses com aprovação/recusa de solicitações de pacientes dependentes (`approval_requests`).
- Pacientes e Cuidadores (`accept_caregiver_invite`, `create_managed_patient`, `revoke_caregiver`).
- Medicamentos contínuos, temporários e SOS com movimentações de estoque (`record_stock_movement`).
- Indicadores de adesão, notificações Web Push e trilha de auditoria (`audit_logs`).

### Etapa 3 — Evoluções Clínicas, Fuso Horário, Gerenciamento de Clínica e Apps (Concluída)
- **Horário de Brasília (`America/Sao_Paulo`):** Padronização de cálculos de datas, horários, atrasos e exibição temporal no cuidador (`src/lib/brazilTime.js`).
- **Calendário & Agenda Unificada:** Reformulação da aba Agenda no formato de calendário mensal interativo com resumo diário de consultas, exames, procedimentos e notas (`src/lib/caregiverCalendar.js`).
- **Painel de Gerenciamento (Paciente / Global / Grupos):** Configuração granular ou em lote para clínicas e cuidadores (`src/lib/careSettings.js`, `/api/v1/caregiver/settings`, migrações `04` e `05`), incluindo tempo de alerta de atraso, confirmação obrigatória no horário/pós-perdida/desfazer, janela de dose perdida, edição pelo paciente e alertas de estoque/SOS.
- **Portal, Aba Sobre e Apps Android:** Novo Portal (`/?portal=1`) com acesso Web e download mobile; aba **Sobre & Apps** com versões do sistema e download de `MediCare-Paciente.apk` e `MediCare-Cuidador.apk`.
- **Resiliência de Preview e Cache:** Proxy fallback anti-loop (`src/lib/oracleProxy.js`), `sw.js` `v7` com `no-store` para chunks Next.js e `assetPrefix` isolado para desenvolvimento.
