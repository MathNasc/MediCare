# MediCare — Isolamento no Servidor Oracle Cloud Free Tier, Systemd, Nginx e Rollback

## 1. Isolamento Garantido (Sem Impacto em Outros Projetos)
- **Diretório exclusivo da aplicação**: `/opt/medicare` (ou `~/MediCare`)
- **Banco de dados isolado na instância PostgreSQL existente**: `medicare_db`
- **Usuário PostgreSQL restrito**: `medicare_app` (`NOSUPERUSER NOCREATEDB NOCREATEROLE`, sem permissão em nenhum outro banco)
- **Porta local dedicada do Backend Compartilhado**: `127.0.0.1:3080` (bind apenas em loopback para evitar conflito com portas de outros projetos e nunca expor o PostgreSQL na porta `5432` para a internet)
- **Controle de Recursos (Oracle Free Tier)**: `MemoryMax=384M` e `CPUQuota=50%` via systemd para nunca afetar outros serviços da VM.

---

## 2. Serviço Systemd Isolado (`/etc/systemd/system/medicare-backend.service`)

```ini
[Unit]
Description=MediCare Shared Backend (Paciente Android + Cuidador Web)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/medicare
EnvironmentFile=/opt/medicare/.env.production
Environment=NODE_ENV=production
Environment=PORT=3080
ExecStart=/usr/bin/npm run start -- -p 3080 -H 127.0.0.1
Restart=on-failure
RestartSec=5
MemoryMax=384M
CPUQuota=50%
StandardOutput=append:/var/log/medicare/backend.log
StandardError=append:/var/log/medicare/backend-error.log

[Install]
WantedBy=multi-user.target
```

---

## 3. Agendador Nativo de Lembretes e Tratamentos (`/etc/systemd/system/medicare-reminders.timer`)
Substitui o `pg_cron` + Edge Function do Supabase com consumo quase zero de RAM:

```ini
# /etc/systemd/system/medicare-reminders.service
[Unit]
Description=MediCare Minute Reminder & Treatment Expiration Job
After=medicare-backend.service

[Service]
Type=oneshot
EnvironmentFile=/opt/medicare/.env.production
ExecStart=/usr/bin/curl -sS -X POST http://127.0.0.1:3080/api/v1/jobs/reminders -H "x-api-key: ${BACKEND_API_KEY}"
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

## 4. Backup Diário Isolado (`/opt/medicare/scripts/backup_oracle_medicare.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_PATH="/var/backups/medicare/medicare_db_$(date -u +%Y%m%d_%H%M%S).dump"
mkdir -p /var/backups/medicare
pg_dump -U medicare_app -h 127.0.0.1 -d medicare_db -Fc -f "$BACKUP_PATH"
sha256sum "$BACKUP_PATH" > "${BACKUP_PATH}.sha256"
# Retém últimos 14 dias sem tocar em nenhum outro projeto
find /var/backups/medicare -name "medicare_db_*.dump*" -mtime +14 -delete
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
