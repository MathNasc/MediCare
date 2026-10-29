# Revisão de Segurança e Conformidade LGPD — MediCare

**Data:** 29 de Outubro de 2026  
**Versão:** 1.0  
**Escopo:** Proteção de dados entre **MediCare Paciente Android**, **MediCare Cuidador Web**, **Backend API** e **PostgreSQL na Oracle Cloud**.

---

## 1. Princípios de Segurança e Modelo de Ameaças

O MediCare manipula dados clínicos e medicamentosos classificados como **dados pessoais sensíveis** pela LGPD (Lei nº 13.709/2018, Art. 5º, II e Art. 11). A segurança não pode depender unicamente de restrições na interface gráfica do frontend.

---

## 2. Vetores de Segurança Auditados e Medidas Implementadas

### 2.1. Autorização no Servidor e Prevenção contra IDOR
- **Vulnerabilidade Típica:** Um usuário autenticado alterar o parâmetro `patient_id` na URL ou no corpo da requisição para acessar prontuários e medicamentos de terceiros.
- **Mecanismo de Defesa do MediCare:**
  - Em todas as operações sobre dados de pacientes, o servidor valida se `user_id == current_user_id` OU se existe registro em `caregiver_relationships` com `status = 'active'` e `caregiver_id == current_user_id`.
  - A função de sessão `app_current_user_id()` é setada na transação PostgreSQL (`set_config('app.current_user_id', ...)`), garantindo que as políticas de linha e procedimentos RPC respeitem o ator autenticado.

### 2.2. Gestão de Credenciais e Autenticação
- **Armazenamento de Senhas:** Emprega a extensão nativa `pgcrypto` com algoritmo Blowfish (`gen_salt('bf', 10)`), padrão da indústria resistente a ataques de dicionário e rainbow tables.
- **Sessões e Tokens:**
  - Access Token JWT assinado criptograficamente com HMAC-SHA256, com tempo de vida curto (1 hora).
  - Refresh Tokens opacos armazenados em banco apenas como **hash SHA-256** (`refresh_token_hash`), impedindo que o vazamento do banco comprometa sessões ativas.
  - Revogação explícita: no logout ou rotação de tokens, a sessão é imediatamente invalidada no banco com carimbo `revoked_at = NOW()`.
- **Segredos da Aplicação:** Chaves de API (`GEMINI_API_KEY`, senhas de banco) residem exclusivamente no arquivo `.env` do servidor, nunca trafegando para o cliente ou sendo expostas em código client-side.

### 2.3. Prevenção de Injeção de SQL e Sanitização de Identificadores
- O roteador REST genérico (`/api/rest/v1/[...slug]`) implementa a função `sanitizeIdentifier`, validando rigorosamente nomes de colunas e tabelas contra expressões regulares estritas (`/^[a-zA-Z_][a-zA-Z0-9_]*$/`) e contra uma lista explícita de tabelas permitidas (`ALLOWED_TABLES`).
- Todas as consultas executam parametrização nativa (`$1`, `$2`, `$3`), prevenindo injeções SQL tanto em queries diretas quanto em procedimentos RPC.

### 2.4. Trilha de Auditoria Imutável (`audit_logs`)
- Toda retificação de dose, confirmação retroativa, alteração de prescrição ou troca de papel do paciente grava um registro em `audit_logs`.
- O registro armazena:
  - `performed_by`: Identificador UUID do ator responsável.
  - `action`: Código da ação executada.
  - `old_value` e `new_value`: Snapshots em JSON dos dados antes e depois da alteração.
  - `reason`: Justificativa clínica/operacional fornecida pelo usuário.
  - `created_at`: Timestamp UTC garantido pelo servidor.
- Os registros de auditoria são de inserção exclusiva (append-only), sem rotas de deleção ou edição expostas.

---

## 3. Conformidade com a LGPD (Lei Geral de Proteção de Dados)

| Princípio da LGPD | Aplicação no MediCare |
| :--- | :--- |
| **Finalidade e Necessidade** (Art. 6º, I e III) | O sistema coleta estritamente os dados essenciais para o controle de posologia, saúde do paciente e contato em caso de emergência. |
| **Livre Acesso e Transparência** (Art. 6º, IV e VI) | O paciente pode consultar integralmente seu prontuário, doses tomadas, histórico de estoque e profissionais cadastrados tanto no aplicativo quanto via API. |
| **Segurança e Prevenção** (Art. 6º, VII e VIII) | Criptografia em repouso de credenciais, tráfego HTTPS obrigatório em produção, rate limiting em rotas de autenticação (20 requisições/minuto) e isolamento relacional de perfis. |
| **Revogação do Consentimento** (Art. 8º, § 5º) | O paciente possui autonomia para revogar o vínculo de qualquer cuidador a qualquer momento (`revoke_caregiver`), cessando imediatamente o acesso aos seus dados clínicos. |
| **Rastreabilidade e Não-Repúdio** (Art. 11) | Distinção entre ações do paciente e do cuidador com registro explícito em auditoria, impedindo alterações silenciosas ou não autorizadas no prontuário. |

---

## 4. Recomendações para a Etapa 2 (Fundação do MediCare Cuidador)

1. **Tokens em Armazenamento Seguro:** Não armazenar tokens de acesso em `localStorage` aberto sem estratégia de expiração; preferir cookies `HttpOnly` com proteção `SameSite=Strict` ou armazenamento em memória gerenciado pelo TanStack Query com renovação via refresh token.
2. **Camada de Interceptação da API:** Centralizar chamadas HTTP em um cliente configurado (ex: Axios ou TanStack Query) que trate automaticamente respostas `401 Unauthorized` e realize a renovação transparente de sessão antes de desconectar o usuário.
3. **Máscaras e Tratamento de Exibição:** Mascarar dados pessoais como CPF e telefone na visualização de listas compartilhadas no navegador.
