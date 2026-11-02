# Relatório de Testes, Segurança e Plano de Implantação — MediCare

**Versão:** 2.0 (Consolidada)  
**Escopo:** Validação do **MediCare Cuidador Web** (`src/app/cuidador/page.jsx`), compatibilidade do **MediCare Paciente Android** e infraestrutura **PostgreSQL 16 na Oracle Cloud**.

---

## 1. Matriz de Testes de Segurança e Funcionalidade

| Categoria | Cenário Validado | Resultado | Detalhes Técnicos |
| :--- | :--- | :--- | :--- |
| **Autenticação Web** | Login, renovação e logout via cookies `HttpOnly` | **Aprovado** | Cookies `medicare_access_token` e `medicare_refresh_token` com `HttpOnly; SameSite=Lax; Secure`; nenhum token salvo em `localStorage`. |
| **Proteção CSRF** | Mutação REST/RPC via cookie sem `X-CSRF-Token` ou `Origin` inválido | **Aprovado** | Bloqueado com `403 Forbidden` (`validateCsrfRequest` com comparação timing-safe). |
| **Compatibilidade Android** | Autenticação via `Authorization: Bearer <jwt>` | **Aprovado** | Mantida integralmente para o app Android em `/api/auth/v1/*`, `/api/rest/v1/*` e `/api/v1/sync`. |
| **Isolamento de Sessões** | Logout ou revogação de uma sessão (`sid`) | **Aprovado** | Revoga exclusivamente a sessão atual em `auth_sessions`, preservando sessões de outros dispositivos. |
| **Autorização & Anti-IDOR** | Acesso a `patient_id`, `user_id` ou `med_id` sem vínculo ativo | **Aprovado** | Bloqueado no backend com `403 Forbidden`; removido fallback que exibia perfis sem vínculo no frontend. |
| **Registros de Administração** | Separação temporal e cálculo de retroatividade | **Aprovado** | Horário previsto (`hora`), horário real (`administered_at`) e registro (`created_at`) separados; `is_retroactive` só é `true` quando fora da janela (> 30 min) ou em retificação. |
| **Idempotência de Doses** | Cliques repetidos para o mesmo horário/medicamento/data | **Aprovado** | Prevenção de duplicidade por slot `(user_id, med_id, dose_date, hora)` com trilha em `audit_logs`. |
| **Formulários Clínicos** | Cadastro de paciente dependente e medicamentos | **Aprovado** | Removidos defaults clínicos (`O+`, `1960-05-15`, `50mg`, `30`, `08:00, 20:00`); validação e confirmação obrigatórias antes de salvar. |
| **Migrações do Banco** | Separação entre request normal e execução de DDL | **Aprovado** | `ensureOraclePostgresSchema` apenas verifica prontidão; migrações versionadas em `database/migrations/03_incremental_compatibility.sql` via `scripts/run_migrations.js`. |

---

## 2. Procedimento de Verificação e Migração de Banco de Dados

Antes de atualizar a aplicação em produção, verifique o estado do esquema PostgreSQL de forma não destrutiva:

```bash
# 1. Verificar conectividade e versão do esquema (somente leitura)
node scripts/run_migrations.js --check

# 2. Aplicar migração incremental 03_incremental_compatibility.sql (somente com autorização explícita)
node scripts/run_migrations.js --apply
```

---

## 3. Procedimento de Publicação em Produção (Oracle Cloud Self-Hosted)

> ⚠️ **Aviso:** A execução de comandos no servidor de produção deve ocorrer somente mediante autorização explícita do administrador.

1. **Atualizar código-fonte no servidor:**
   ```bash
   cd /home/ubuntu/MediCare
   git pull origin main
   ```
2. **Verificar migrações do banco:**
   ```bash
   node scripts/run_migrations.js --check
   ```
3. **Instalar dependências e compilar o build de produção do Next.js:**
   ```bash
   npm install --production=false
   npm run build
   ```
4. **Reiniciar o serviço Systemd (`medicare-backend` na porta 3009):**
   ```bash
   sudo systemctl restart medicare-backend
   ```
5. **Validar saúde da API e carregamento de CSS:**
   ```bash
   curl -sS http://127.0.0.1:3009/api/v1/health
   ```
   - Portal público: `https://medicare-cuidador.duckdns.org/?portal=1`
   - MediCare Cuidador: `https://medicare-cuidador.duckdns.org/cuidador`
