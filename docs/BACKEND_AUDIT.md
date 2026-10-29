# Auditoria Técnica do Backend — MediCare

**Data:** 29 de Outubro de 2026  
**Versão:** 1.0  
**Contexto:** Preparação da integração entre o **MediCare Paciente Android**, o futuro **MediCare Cuidador Web** e o banco **PostgreSQL na Oracle Cloud**.

---

## 1. Arquitetura e Tecnologias

- **Linguagem & Runtime:** Node.js (v18+) com JavaScript/TypeScript.
- **Framework Web:** Next.js (App Router) atuando como API Gateway e camada de orquestração REST/RPC.
- **Banco de Dados:** PostgreSQL 16 standalone hospedado em Oracle Cloud Compute (`medicare_db`).
- **Driver de Conexão:** Pool nativo `pg` (`node-postgres`) com suporte a SSL configurável, transações ACID e pooling de conexões (`src/lib/oraclePostgres.js`).
- **Segurança de Autenticação:** Implementação nativa (`src/lib/oracleAuth.js`) baseada no padrão GoTrue / Supabase Auth compatível, utilizando criptografia `pgcrypto` (`crypt` com salt Blowfish `$2a$/$2b$`), tokens JWT com assinatura HMAC-SHA256 e tokens de atualização opacos armazenados em `auth_sessions`.

---

## 2. Mapa de Endpoints Existentes

### 2.1. Autenticação e Sessão (`/api/auth/v1/[...action]`)
| Método | Rota | Descrição | Status de Implementação |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/v1/signup` | Cadastro de usuário (`app_users` + `profiles`) com emissão de JWT e refresh token. | Implementada e validada |
| `POST` | `/api/auth/v1/token?grant_type=password` | Autenticação por email e senha via `pgcrypto`. | Implementada e validada |
| `POST` | `/api/auth/v1/token?grant_type=refresh_token` | Rotação segura de refresh token com revogação da sessão anterior. | Implementada e validada |
| `GET` | `/api/auth/v1/user` | Retorna claims do usuário autenticado a partir do token Bearer. | Implementada e validada |
| `PUT` | `/api/auth/v1/user` | Atualização de perfil, senha ou metadados do usuário autenticado. | Implementada e validada |
| `POST` | `/api/auth/v1/logout` | Revogação de sessões ativas do usuário em `auth_sessions`. | Implementada e validada |
| `POST` | `/api/auth/v1/recover` | Solicitação de recuperação de senha gerando token em `password_reset_tokens`. | Implementada e validada |

### 2.2. Roteador REST Genérico (`/api/rest/v1/[...slug]`)
Compatível com a interface PostgREST, permitindo consultas filtradas com operadores (`eq`, `neq`, `gte`, `lte`, `ilike`, `fts`, `in`, `or`).

| Tabela Autorizada | Operações Suportadas | Descrição | Status |
| :--- | :--- | :--- | :--- |
| `profiles` | `GET`, `POST`, `PATCH` | Perfil do paciente e cuidador (dados pessoais, tipo de perfil). | Implementada e validada |
| `medicamentos` | `GET`, `POST`, `PATCH`, `DELETE` | Gestão de tratamentos contínuos, temporários e SOS. | Implementada e validada |
| `historico_doses` | `GET`, `POST`, `PATCH` | Registro e consulta de administrações de doses. | Implementada e validada |
| `caregiver_relationships` | `GET`, `POST`, `PATCH` | Vínculos de acompanhamento entre cuidadores e pacientes. | Implementada e validada |
| `health_events` | `GET`, `POST`, `PATCH`, `DELETE` | Consultas médicas, exames e compromissos clínicos. | Implementada e validada |
| `notes` / `calendar_notes` | `GET`, `POST`, `DELETE` | Anotações diárias do paciente. | Implementada e validada |
| `stock_movements` | `GET`, `POST` | Movimentações de entrada, saída e ajuste de estoque. | Implementada e validada |
| `audit_logs` | `GET`, `POST` | Trilha de auditoria e conformidade. | Implementada e validada |
| `medication_catalog` | `GET` | Catálogo de busca de medicamentos com `tsvector`. | Implementada e validada |
| `allergies` & `health_conditions` | `GET`, `POST`, `DELETE` | Alergias e condições clínicas crônicas do paciente. | Implementada e validada |
| `emergency_contacts` | `GET`, `POST`, `PATCH`, `DELETE` | Contatos de emergência e familiares imediatos. | Implementada e validada |
| `healthcare_professionals` | `GET`, `POST`, `PATCH`, `DELETE` | Médicos, terapeutas e especialistas do paciente. | Implementada e validada |

### 2.3. Procedimentos Remotos (RPC) em `/api/rest/v1/rpc/[fnName]`
| Procedimento | Descrição | Status de Implementação |
| :--- | :--- | :--- |
| `confirm_dose_retroactive` | Confirmação ou correção de dose retroativa com gravação automática em `audit_logs` e identificação do ator (`performed_by`). | Implementada e validada |
| `record_stock_movement` | Registro de movimentação de estoque (compra, ajuste, reposição) e atualização do saldo em `medicamentos`. | Implementada e validada |
| `get_all_stock_forecasts` | Cálculo e previsão de esgotamento de estoque para todos os medicamentos ativos do paciente. | Implementada e validada |
| `get_stock_forecast` | Previsão detalhada de esgotamento e histórico de compras de um medicamento específico. | Implementada e validada |
| `accept_caregiver_invite` | Aceite de convite por token opaco, vinculando o cuidador autenticado ao paciente. | Implementada e validada |
| `revoke_caregiver` | Revogação do vínculo entre cuidador e paciente. | Implementada e validada |
| `get_patient_summary` | Resumo de perfil, contagem de medicamentos ativos e última dose tomada. | Implementada e validada |
| `repeat_treatment` | Reinício de tratamento temporário (ex: antibióticos) gerando novo ciclo e preservando o anterior. | Implementada e validada |
| `get_treatment_dashboard` | Agregação de medicamentos contínuos, temporários ativos/concluídos e usos de SOS no mês. | Implementada e validada |
| `search_medications` | Busca textual no catálogo de medicamentos com ranking de relevância. | Implementada e validada |
| `change_role_with_pin` | Troca de perfil do paciente protegida por PIN mestre. | Implementada e validada |
| `list_audit_logs` | Consulta histórica de eventos de auditoria por paciente. | Implementada e validada |

### 2.4. Sincronização Mobile & Suporte Offline (`/api/v1/sync`)
- `GET /api/v1/sync`: Retorna o snapshot completo de todos os registros do paciente (perfil, medicamentos, histórico de doses, eventos, notas, alergias, condições, contatos, profissionais e cuidadores vinculados).
- `POST /api/v1/sync`: Recebe payloads em lote enviados pelo aplicativo Android, executando resolução determinística de IDs, inserções e upserts com tratamento de concorrência.
- **Status:** Implementada e validada com o MediCare Paciente Android.

### 2.5. Outros Serviços
- `POST /api/ai`: Proxy seguro para inferência com Google Gemini API mantendo a chave no servidor. (Implementada e validada).
- `GET /api/apk`: Rota otimizada para download e streaming do binário `MediCare-Paciente.apk`. (Implementada e validada).
- `GET /api/v1/health`: Verificação de saúde da API e conectividade com o PostgreSQL. (Implementada e validada).
- `GET /api/v1/jobs/reminders`: Worker agendado via cron/systemd para processamento de lembretes e alertas escalonados. (Implementada, mas precisa de testes com push real no Cuidador).
- `GET /api/v1/jobs/alert-caregiver`: Alerta automático ao cuidador caso dose esteja atrasada há mais de 30 minutos. (Parcialmente implementada; lógica pronta no backend, aguarda interface do Cuidador).

---

## 3. Matriz de Classificação de Funcionalidades

| Funcionalidade de Backend | Classificação | Observações |
| :--- | :--- | :--- |
| Autenticação (Login, Registro, Refresh, Logout) | **Implementada e validada** | Testada no app Android e no portal. Criptografia `pgcrypto`. |
| Gestão de Perfis de Usuário (Paciente / Cuidador) | **Implementada e validada** | Suporta fotos, PIN de segurança, dados de emergência. |
| Cadastro e Gestão de Medicamentos | **Implementada e validada** | Tratamentos contínuos, temporários e SOS suportados. |
| Agendamento e Registro de Doses | **Implementada e validada** | Horários, repetições, verificação de conflitos. |
| Registro Retroativo de Doses com Auditoria | **Implementada e validada** | Distingue autor e grava antes/depois em `audit_logs`. |
| Controle e Previsão de Estoque | **Implementada e validada** | Movimentações, previsão de término e histórico de compras. |
| Agenda Médica (Consultas e Exames) | **Implementada e validada** | Suportada em `health_events` com alertas de data/hora. |
| Catálogo Farmacêutico Nacional | **Implementada e validada** | Busca indexada via `medication_catalog`. |
| Sincronização Bidirecional Offline/Online | **Implementada e validada** | Utilizada continuamente pelo app Android. |
| Geração e Aceite de Convite de Cuidador | **Implementada e validada** | Procedimento `accept_caregiver_invite` funcional no banco. |
| Dashboard Oficial de Adesão e KPIs | **Parcialmente implementada** | Endpoint `get_treatment_dashboard` existe; cálculo detalhado de % de adesão com janela temporal deve ser padronizado para o Cuidador. |
| Alertas Push para Cuidadores em Atrasos | **Parcialmente implementada** | Script de job existe em `/api/v1/jobs/alert-caregiver`, necessita de integração com a PWA do Cuidador. |
| Gestão de Pacientes sem Conta Própria | **Inexistente no backend direto** | Atualmente, todo paciente possui registro em `app_users` ou `profiles`. Para permitir pacientes sem login próprio criados pelo cuidador, deve ser padronizado o conceito de "perfil dependente gerenciado". |

---

## 4. Conclusão da Auditoria do Backend

O backend existente é maduro, robusto e perfeitamente estruturado para servir de base tanto para o aplicativo Android quanto para o novo MediCare Cuidador Web. A utilização de rotas REST compatíveis e RPCs parametrizadas garante que novas interfaces web consumam os mesmos dados sem redundância ou duplicação de regras de negócio.
