# Relatório de Testes, Segurança e Plano de Implantação — MediCare

**Data:** 29 de Outubro de 2026  
**Versão:** 1.0  
**Escopo:** Validação completa do **MediCare Cuidador Web**, integridade do **MediCare Paciente Android** e infraestrutura **PostgreSQL na Oracle Cloud**.

---

## 1. Testes Funcionais Executados

| Fluxo Testado | Cenário de Teste | Resultado | Observações |
| :--- | :--- | :--- | :--- |
| **Autenticação** | Login com credenciais válidas (`/api/auth/v1/token`) | **Aprovado** | JWT emitido e armazenado de forma segura; redirecionamento instantâneo para a dashboard. |
| **Encerramento de Sessão** | Logout (`/api/auth/v1/logout`) | **Aprovado** | Sessão revogada em `auth_sessions`; token removido do armazenamento do cliente. |
| **Aceite de Convite de Paciente** | Cuidador informa token de 24 caracteres do app Android | **Aprovado** | RPC `accept_caregiver_invite` valida o token e cria vínculo `active` em `caregiver_relationships`. |
| **Cadastro de Paciente Dependente** | Cuidador cadastra familiar sem smartphone/e-mail | **Aprovado** | RPC `create_managed_patient` provisiona perfil e vincula imediatamente como `admin`. |
| **Revogação de Vínculo** | Cuidador desvincula paciente (`revoke_caregiver`) | **Aprovado** | Status passa a `revoked`; acesso futuro interrompido sem apagar dados anteriores. |
| **Cadastro de Prescrição** | Cuidador adiciona medicamento com horários e posologia | **Aprovado** | Salvo em `medicamentos` com vinculação estrita ao `patient_id`. |
| **Reposição de Estoque** | Cuidador registra compra de caixas (`record_stock_movement`) | **Aprovado** | Saldo atualizado e movimentação gravada para rastreabilidade de compras e custo. |
| **Confirmação de Dose pelo Cuidador** | Registro de administração de dose | **Aprovado** | RPC `confirm_dose_retroactive` marca `is_retroactive = true` e grava em `audit_logs`. |
| **Registro de Dose Não Tomada** | Paciente recusa dose | **Aprovado** | Registra `status = 'missed'` com justificativa clínica obrigatória arquivada. |
| **Prevenção de Duplicidades** | Cliques repetidos ou reenvios de formulário | **Aprovado** | Chaves idempotentes e desabilitação de botões durante transação (`actionLoading`). |
| **Agenda e Consultas** | Cadastro de retorno médico em `health_events` | **Aprovado** | Exibido na agenda médica com data, horário, especialista e local. |
| **Indicadores Oficiais** | Cálculo de taxa de adesão e doses pendentes | **Aprovado** | Doses sem confirmação não são tratadas como omitidas; taxa ponderada calculada no backend. |
| **Trilha de Auditoria** | Consulta de histórico de alterações (`list_audit_logs`) | **Aprovado** | Ações de doses, criação de pacientes e justificativas recuperadas com integridade. |

---

## 2. Testes de Segurança e Conformidade

### 2.1. Prevenção contra IDOR (Insecure Direct Object Reference)
- **Vetor Testado:** Tentativa de acesso a medicamentos ou doses informando um `patient_id` de um paciente sem vínculo ativo com o cuidador.
- **Resultado:** Acesso bloqueado pelo backend com status HTTP `403 Forbidden` / Lista vazia. A consulta direta a relacionamentos exige `status = 'active'` e `caregiver_id == current_user_id`.

### 2.2. Armazenamento de Credenciais e Proteção de Tokens
- **Senhas:** Criptografia irreversível via `pgcrypto` com salt Blowfish (`$2a$/$2b$`). Nenhuma senha em texto puro no banco.
- **Tokens:** Access token com validade de 1 hora. Refresh tokens armazenados exclusivamente como hash SHA-256 no banco (`auth_sessions.refresh_token_hash`).
- **Segredos:** A chave `GEMINI_API_KEY` e as credenciais de banco de dados residem no arquivo `.env` do servidor e nunca são expostas ao frontend.

### 2.3. Conformidade com a LGPD
- Consentimento explícito por token de convite com validade determinada (7 dias).
- Autonomia do paciente para revogação unilateral a qualquer momento pelo app Android.
- Trilha imutável em `audit_logs` garantindo rastreabilidade de quem alterou ou confirmou cada dose.

---

## 3. Testes de Interface e PWA

* **Smartphones Android (Mobile-First):**
  * Barra de navegação inferior (`Bottom Navigation Bar`) de fácil alcance com o polegar.
  * Modais com formulários adaptados para teclado virtual.
* **Tablets e Computadores (Desktop):**
  * Sidebar fixa expansível com dados do usuário logado e atalhos de navegação.
  * Grades responsivas de 2 a 4 colunas com redimensionamento fluido.
* **PWA:**
  * Manifesto válido (`manifest.json`) com `theme_color = #2563eb`, `background_color = #0b1120` e ícones de 192px e 512px.
  * Suporte a instalação direta na tela de início de dispositivos móveis.

---

## 4. Banco de Dados e Procedimentos de Manutenção na Oracle Cloud

* **Instância:** PostgreSQL 16 no container Docker isolado `medicare_db` na porta local `127.0.0.1:5436`.
* **Script de Backup Automatizado:**
  ```bash
  docker exec medicare_db pg_dump -U medicare_app -d medicare_db -Fc > /home/ubuntu/MediCare/backups/medicare_db_$(date +%Y%m%d_%H%M%S).dump
  ```
* **Plano de Rollback:**
  * O esquema é puramente aditivo (nenhuma coluna ou tabela existente foi deletada ou alterada destrutivamente).
  * Caso necessário reverter uma versão do código, a versão anterior do repositório pode ser reiniciada sem perda de integridade dos dados registrados em `medicare_db`.

---

## 5. Procedimento de Publicação em Produção (Oracle Cloud)

> ⚠️ **Aviso:** A implantação em produção só deve ser executada após autorização explícita do usuário.

### Passos de Publicação no Servidor:
1. Obter a versão mais recente do repositório:
   ```bash
   cd /home/ubuntu/MediCare
   git pull origin main
   ```
2. Instalar dependências e compilar a aplicação Next.js (API e Web):
   ```bash
   npm install --production=false
   npm run build
   ```
3. Reiniciar o serviço Systemd isolado na porta 3009:
   ```bash
   sudo systemctl restart medicare-backend
   ```
4. Verificar integridade da API:
   ```bash
   curl -sS http://127.0.0.1:3009/api/v1/health
   ```
5. Confirmar funcionamento da PWA no endereço:
   `http://144.22.160.191:3009/cuidador`
