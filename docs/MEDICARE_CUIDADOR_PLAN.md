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

### Etapa 1 — Auditoria Técnica e Contrato da API (Próxima Etapa)
- Auditoria aprofundada dos endpoints do backend e tabelas do banco de dados PostgreSQL.
- Definição do modelo de identidade (cuidadores com múltiplos pacientes, pacientes com múltiplos cuidadores).
- Especificação formal do contrato da API em `docs/API_CONTRACT.md`.
- Modelagem de dados em `docs/DATA_MODEL.md`.
- Revisão de segurança e conformidade LGPD em `docs/SECURITY_REVIEW.md`.

### Etapa 2 — Fundação do MediCare Cuidador
- Inicialização da aplicação em `apps/cuidador-web/` com React, TypeScript, Vite, React Router e Tailwind CSS.
- Configuração de PWA (manifesto, service worker seguro para assets, suporte offline de leitura).
- Arquitetura de navegação (barra inferior mobile, layout expansível desktop).
- Setup de autenticação centralizada e TanStack Query.

### Etapa 3 — Funcionalidades do MVP
- **3.1 Pacientes e Cuidadores:** Vínculos, autorizações por convite, perfis.
- **3.2 Medicamentos e Tratamentos:** Visualização de prescrições, horários e posologia.
- **3.3 Central de Administração:** Timeline cronológica, registro de administrações com rastreabilidade de ator, proteção contra cliques duplicados.
- **3.4 Agenda:** Consultas médicas, exames e lembretes.
- **3.5 Indicadores e Relatórios:** Métricas oficiais de adesão calculadas pelo backend.
- **3.6 Histórico e Auditoria:** Trilha completa de alterações acessível a usuários autorizados.

### Etapa 4 — Testes, Segurança e Implantação
- Testes funcionais completos de fluxos e controle de acesso.
- Verificação de segurança contra IDOR (Insecure Direct Object Reference) e vazamento de dados.
- Testes de compatibilidade em múltiplos dispositivos.
- Preparação de deploy no servidor Oracle Cloud sem afetar os serviços existentes.
