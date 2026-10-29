# MediCare — Isolamento no Servidor Oracle Cloud (`mathnasc-dev-srv`), Docker/Systemd e Rollback

## 1. Diagnóstico Real do Servidor (`mathnasc-dev-srv`) e Isolamento Garantido
A auditoria (`01_oracle_audit_and_isolation.sh --audit`) revelou a arquitetura exata do seu servidor:
- **Hardware**: Ubuntu 24.04.4 LTS (`aarch64` Neoverse-N1, 2 vCPUs), **11 GiB de RAM total** (**8.1 GiB livres**) e **42 GB de disco livre**.
- **Projetos coexistentes (Intocáveis)**:
  - `pricestack_*` (usa a porta `5432`, `3001`, `5173`, `5672`, `6379`, `8000`, `9090`, `9187`, `9419`, `15672`)
  - `vizinhanca_app` + `vizinhanca_db` (usa a porta `3008`)
  - `language_reader_db` (`postgres:16-alpine` na porta `5434`)
  - `securityroute_db` (`postgres:16-alpine` na porta `5435`)
- **Isolamento do MediCare**:
  - **Container de Banco Exclusivo (`medicare_db`)**: Imagem `postgres:16-alpine` (já em cache local no servidor!), mapeada exclusivamente em **`127.0.0.1:5436->5432/tcp`**, com volume próprio `medicare_pgdata`, banco `medicare_db` e usuário restrito `medicare_app` (`NOSUPERUSER NOCREATEDB NOCREATEROLE`).
  - **Porta dedicada do Backend Compartilhado**: **`3009`** (logo após `vizinhanca_app` na `3008`, 100% livre de conflitos).
  - **Controle de Recursos**: Limite de `256M` para `medicare_db` e `384M` para o backend Node.js.

---

## 2. Serviço Systemd Isolado (`/etc/systemd/system/medicare-backend.service`)

```ini
[Unit]
Description=MediCare Shared Backend (Paciente Android + Cuidador Web)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/MediCare
EnvironmentFile=/home/ubuntu/MediCare/.env.production
Environment=NODE_ENV=production
Environment=PORT=3009
ExecStart=/usr/bin/npm run start -- -p 3009 -H 0.0.0.0
Restart=on-failure
RestartSec=5
MemoryMax=384M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
```

---

## 3. Agendador Nativo de Lembretes e Tratamentos (`/etc/systemd/system/medicare-reminders.timer`)
Executa o worker de lembretes a cada minuto com consumo quase zero de RAM:

```ini
# /etc/systemd/system/medicare-reminders.service
[Unit]
Description=MediCare Minute Reminder & Treatment Expiration Job
After=medicare-backend.service

[Service]
Type=oneshot
EnvironmentFile=/home/ubuntu/MediCare/.env.production
ExecStart=/usr/bin/curl -sS -X POST http://127.0.0.1:3009/api/v1/jobs/reminders -H "x-api-key: ${BACKEND_API_KEY}"
```

```ini
# /etc/systemd/system/medicare-reminders.timer
[Unit]
Description=Run MediCare Reminder Worker every minute

[Timer]
OnCalendar=*-*-* *:*:00
Persistent=true
AccuracySec=5s

[Install]
WantedBy=timers.target
```

---

## 4. Backup Diário Isolado (`~/MediCare/oracle-migration/backup_oracle_medicare.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_PATH="/home/ubuntu/MediCare/backups/medicare_db_$(date -u +%Y%m%d_%H%M%S).dump"
mkdir -p /home/ubuntu/MediCare/backups
docker exec medicare_db pg_dump -U medicare_app -d medicare_db -Fc > "$BACKUP_PATH"
sha256sum "$BACKUP_PATH" > "${BACKUP_PATH}.sha256"
# Retém últimos 14 dias sem tocar em nenhum outro projeto
find /home/ubuntu/MediCare/backups -name "medicare_db_*.dump*" -mtime +14 -delete
```

---

## 5. Procedimento de Rollback com Reconciliação de Dados Pós-Cutover

Caso seja necessário retornar temporariamente para a infraestrutura anterior após o cutover, **nenhum registro criado no banco Oracle será perdido**:

1. Exportar o delta de registros criados/atualizados em `medicare_db` após o timestamp do cutover (`T_cutover`):
   ```sql
   \copy (SELECT * FROM public.historico_doses WHERE created_at >= :'T_cutover' OR corrected_at >= :'T_cutover') TO 'delta_historico_doses.csv' WITH CSV HEADER;
   \copy (SELECT * FROM public.medicamentos WHERE updated_at >= :'T_cutover') TO 'delta_medicamentos.csv' WITH CSV HEADER;
   \copy (SELECT * FROM public.stock_movements WHERE created_at >= :'T_cutover') TO 'delta_stock_movements.csv' WITH CSV HEADER;
   \copy (SELECT * FROM public.audit_logs WHERE created_at >= :'T_cutover') TO 'delta_audit_logs.csv' WITH CSV HEADER;
   ```
2. Fazer upsert (`ON CONFLICT (id) DO UPDATE`) desses deltas de volta no banco anterior antes de virar a chave de ambiente.
