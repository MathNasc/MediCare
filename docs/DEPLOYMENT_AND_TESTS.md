# Relatório de Testes, Segurança e Plano de Implantação — MediCare

**Versão:** 2.2 (Atualizada)  
**Escopo:** Validação do **MediCare Cuidador Web/Android**, compatibilidade do **MediCare Paciente Android** e infraestrutura **PostgreSQL 16 na Oracle Cloud**.

---

## 1. Matriz de Testes de Segurança e Funcionalidade

A suíte automatizada (`npm test`) executa **64 testes em 7 arquivos** (`src/__tests__/`):

| Suíte | Escopo Validado | Resultado |
| :--- | :--- | :--- |
| `aiGuardrailsAndChat.test.js` | Guardrails OpenRouter (`/api/ai`: anti-prompt-injection, ofuscação/leetspeak, bloqueio de código/SQL/off-topic), sanitização pós-resposta e autorização do chat paciente ↔ cuidador (bloqueio de perfil `independente`). | **Aprovado** |
| `securityAndConsolidation.test.js` | Cookies `HttpOnly`, CSRF (`X-CSRF-Token` + `Origin`), Bearer Android, isolamento por `sid`, bloqueio anti-IDOR, separação DDL/requisições e fallback proxy anti-loop Oracle. | **Aprovado** |
| `careSettings.test.js` | Normalização, resolução de herança (`custom` → `group` → `global`), validação de confirmação em doses no horário/perdidas/desfazer e permissões de edição. | **Aprovado** |
| `brazilTime` & `auditAndNotifications.test.js` | Conversões no fuso `America/Sao_Paulo` (`-03:00`) e formatação legível de logs de auditoria clínica. | **Aprovado** |
| `caregiverCalendar.test.js` | Grade mensal, agrupamento diário de compromissos/notas/movimentações e leitura de eventos na agenda unificada do cuidador. | **Aprovado** |
| `appVersions.test.js` | Leitura dinâmica das versões Web, Service Worker (`sw.js`) e APKs Android de Paciente (`v2.9.1`) e Cuidador (`v2.0.0`). | **Aprovado** |
| `doseUtils.test.js` | Cálculo de status e janelas temporais das doses. | **Aprovado** |

---

## 2. Procedimento de Verificação e Migração de Banco de Dados

Antes ou durante a atualização do servidor, carregue o arquivo `.env.production` com segurança e execute:

```bash
cd ~/MediCare
set -a && for f in .env .env.production .env.local; do if [ -f "$f" ]; then . "./$f"; fi; done && set +a

# 1. Verificar conectividade e tabelas (somente leitura)
node scripts/run_migrations.js --check

# 2. Aplicar migrações pendentes (03, 04, 05 e 06)
node scripts/run_migrations.js --apply
```

---

## 3. Procedimento de Deploy em Produção (Oracle Cloud Self-Hosted)

O serviço web/API roda gerenciado pelo systemd **`medicare-backend.service`** na porta **`3009`** dentro de `/home/ubuntu/MediCare`.

1. **Atualizar repositório e dependências:**
   ```bash
   cd ~/MediCare
   git pull origin main
   npm install
   ```
2. **Aplicar migrações de banco:**
   ```bash
   set -a && for f in .env .env.production .env.local; do if [ -f "$f" ]; then . "./$f"; fi; done && set +a
   node scripts/run_migrations.js --apply
   ```
3. **Limpar `.next`, compilar produção e reiniciar serviço Systemd:**
   ```bash
   rm -rf .next
   npm run build
   sudo systemctl restart medicare-backend
   ```
4. **Atualizar APKs Android (quando houver alteração mobile):**
   ```bash
   bash scripts/rebuild_and_sign_apk.sh
   bash scripts/rebuild_and_sign_cuidador_apk.sh
   ```
5. **Validar variáveis OpenRouter no `.env` do servidor e endpoints ao vivo:**
   - Certifique-se de que `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (ex.: `openai/gpt-4o-mini`) e `OPENROUTER_SITE_URL` estejam definidas apenas no ambiente server-side (`.env` / `.env.production`).
   ```bash
   curl -sS http://127.0.0.1:3009/api/v1/health
   curl -s -o /dev/null -w "settings_http=%{http_code}\n" http://127.0.0.1:3009/api/v1/caregiver/settings
   curl -s -o /dev/null -w "chat_http=%{http_code}\n" http://127.0.0.1:3009/api/v1/chat
   # settings_http=401 e chat_http=401 confirmam que as rotas autenticadas estão ativas
   ```
   - Portal público: `https://medicare-cuidador.duckdns.org/?portal=1`
   - MediCare Cuidador: `https://medicare-cuidador.duckdns.org/cuidador`
