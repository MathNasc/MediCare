# Plano de Desenvolvimento — MediCare Cuidador

Este documento consolida a visão de produto, arquitetura planejada e o cronograma de implementação do **MediCare Cuidador**, conforme as diretrizes aprovadas.

---

## 1. Visão do Produto

O **MediCare Cuidador** será uma aplicação web progressiva (PWA), responsiva e mobile-first, desenvolvida para permitir que familiares e cuidadores acompanhem com segurança o tratamento de saúde de um ou múltiplos pacientes.

### Princípios Norteadores:
- **Separação de Papéis:** O paciente utiliza o aplicativo nativo Android (`MediCare Paciente`); o cuidador utiliza a aplicação web/PWA (`MediCare Cuidador`).
- **Veracidade de Registros:** Distinção rigorosa entre doses confirmadas pelo paciente, doses registradas pelo cuidador e doses explicitamente não tomadas. Doses pendentes ou sem confirmação nunca devem ser assumidas como omitidas sem confirmação fática.
- **Isolamento e Segurança:** Rígido controle de acesso baseado em vínculos autorizados (RBAC). Um cuidador só pode visualizar ou atuar sobre pacientes expressamente vinculados a ele.
- **Rastreabilidade e Auditoria:** Cada registro de dose, alteração de posologia ou ajuste de compromisso grava o identificador do autor e timestamp em `audit_logs`.

---

## 2. Cronograma de Etapas

### Etapa 0 — Preparação do Monorepo (Concluída)
- Auditoria do repositório e remoção completa do legado web obsoleto.
- Organização dos diretórios em `apps/`, `database/`, `docs/`, `scripts/`.
- Preservação do Android Paciente, APIs backend, migrações e infraestrutura Oracle.
- Elaboração da documentação técnica e governança em `AGENTS.md`.

### Etapa 1 — Auditoria Técnica e Contrato da API (Concluída)
- Auditoria aprofundada dos endpoints do backend e tabelas do banco de dados PostgreSQL.
- Definição do modelo de identidade (cuidadores com múltiplos pacientes, pacientes com múltiplos cuidadores).
- Especificação formal do contrato da API em `docs/API_CONTRACT.md`.
- Modelagem de dados em `docs/DATA_MODEL.md`.
- Revisão de segurança e conformidade LGPD em `docs/SECURITY_REVIEW.md`.

### Etapa 2 — Fundação do MediCare Cuidador (Concluída)
- Inicialização da aplicação em `apps/cuidador-web/` com React, TypeScript, Vite e Tailwind CSS.
- Configuração de PWA (manifesto, layout mobile-first, sidebar desktop).
- Setup de autenticação e cliente HTTP com Bearer token.

### Etapa 3 — Funcionalidades do MVP (Concluída)
- **3.1 Pacientes e Cuidadores:** Aceite de convites (`accept_caregiver_invite`), cadastro de dependentes (`create_managed_patient`), revogação de vínculos (`revoke_caregiver`).
- **3.2 Medicamentos e Tratamentos:** Cadastro de prescrições contínuas, temporárias e SOS, horários e reposição de estoque com movimentações (`record_stock_movement`).
- **3.3 Central de Administração:** Linha do tempo de doses, registro retroativo pelo cuidador (`confirm_dose_retroactive`), marcação explícita de recusa/omissão com justificativa.
- **3.4 Agenda:** Agendamento e visualização de consultas e exames por paciente (`health_events`).
- **3.5 Indicadores e Relatórios:** Taxa oficial de adesão ponderada, pontualidade e contagem fática de recusas.
- **3.6 Histórico e Auditoria:** Trilha imutável em `audit_logs` com autor, snapshot e justificativa clínica.

### Etapa 4 — Testes, Segurança e Implantação (Concluída)
- Testes funcionais completos de fluxos e controle de acesso (100% aprovados).
- Verificação de segurança contra IDOR e validação de isolamento de pacientes.
- Testes de compatibilidade responsiva em smartphones Android, tablets e computadores.
- Especificação de procedimentos de backup, rollback e publicação na Oracle Cloud em `docs/DEPLOYMENT_AND_TESTS.md`.
