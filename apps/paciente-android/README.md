# MediCare Paciente — Aplicativo Android Nativo (Kotlin + Jetpack Compose)

Este diretório (`/apps/paciente-android`) contém o projeto Android **100% nativo** do **MediCare Paciente** (versão distribuída `v2.9.1` via `MediCare-Paciente.apk`), desenvolvido em **Kotlin** com **Jetpack Compose**, **Clean Architecture + MVVM**, **Room (Offline-First)**, **AlarmManager** e sincronização bidirecional com o backend compartilhado na Oracle Cloud.

---

## 1. Como Abrir e Compilar no Android Studio

1. Abra o **Android Studio Ladybug (2024.2.1)** ou superior (JDK 17 configurado).
2. Selecione **File → Open** e escolha `/apps/paciente-android`.
3. Configure (opcionalmente) `/apps/paciente-android/local.properties` sem versionar credenciais:
   ```properties
   sdk.dir=/caminho/para/seu/Android/Sdk
   MEDICARE_BACKEND_URL=https://medicare-cuidador.duckdns.org
   MEDICARE_AI_PROXY_URL=https://medicare-cuidador.duckdns.org
   ```
   > **Segurança:** Nunca insira senhas do banco PostgreSQL, `OPENROUTER_API_KEY` ou `GEMINI_API_KEY` no projeto Android. O assistente de IA consome `/api/ai` (roteado com OpenRouter e guardrails server-side) e a sincronização clínica/chat usam `Authorization: Bearer <jwt>` em `/api/v1/sync`, `/api/v1/chat` e `/api/rest/v1/*`.

---

## 2. Como Gerar o APK Instalável

### 2.1 Via Gradle (`/apps/paciente-android`)

```bash
./gradlew assembleDebug
# Saída: apps/paciente-android/app/build/outputs/apk/debug/app-debug.apk
```

### 2.2 Pipeline Automatizado do Empacotamento Nativo (`MediCare-Paciente.apk`)

Na raiz do repositório:

```bash
bash scripts/rebuild_and_sign_apk.sh
```

O script compila os recursos e código nativo de `/src-apk`, alinha com `zipalign`, assina (v1/v2/v3) e gera `MediCare-Paciente.apk` pronto para download em `/api/apk`.

---

## 3. Permissões Utilizadas no AndroidManifest.xml

| Permissão | Finalidade |
| :--- | :--- |
| `INTERNET` / `ACCESS_NETWORK_STATE` | Sincronização com o backend Oracle (`/api/v1/sync`) e proxy do Assistente IA (`/api/ai`). |
| `POST_NOTIFICATIONS` | Exibição de notificações de medicamentos no Android 13 (API 33) ou superior. |
| `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` | Disparo de lembretes nos horários exatos (`setExactAndAllowWhileIdle`). |
| `RECEIVE_BOOT_COMPLETED` | Reagendamento automático de alarmes ativos após reiniciar o aparelho. |
| `VIBRATE` / `WAKE_LOCK` | Alerta vibratório e despertar da tela no momento da dose. |

---

## 4. Regras de Negócio, Fluxo Dependente e Notificações

- **Sincronização de Regras do Cuidador (`care_settings`):** Ao sincronizar via `/api/v1/sync`, o aplicativo recebe as regras efetivas configuradas pelo cuidador/clínica no Painel de Gerenciamento (`require_caregiver_confirm`, `require_confirm_after_missed`, `require_confirm_undo`, `missed_dose_minutes`, `allow_patient_med_edit`, `notify_sos_usage`).
- **Envio de Solicitação e Avanço para Próxima Dose:** Quando um paciente dependente envia uma solicitação de confirmação ao cuidador (`pending_dose_requests`), a interface principal avança automaticamente para a próxima dose pendente da fila; caso o cuidador rejeite a solicitação e a dose ainda não tenha ultrapassado o limite de dose perdida, ela retorna para a fila ativa de tomada.
- **Agendamento Exato e Repetição (`DoseAlarmScheduler` / `DoseAlarmReceiver`):** Utiliza `AlarmManager.setExactAndAllowWhileIdle`, agenda repetição automática de 15 minutos enquanto não houver confirmação e suprime duplicidades consultando o banco local Room.
- **Assistente de Saúde (OpenRouter) & Chat Condicional com Cuidador:** Na aba do Assistente, todos os perfis contam com as ferramentas locais + conversa com a IA via `/api/ai` restrita estritamente à área da saúde. Quando o paciente possui vínculo ativo com um cuidador (e não está no perfil `independente`), é exibido também o botão **Falar com o Cuidador** conectado em `/api/v1/chat`. Perfis **Independentes** permanecem exclusivamente com o Assistente de Saúde e a IA.
- **Limitações de OEMs:** Em aparelhos Xiaomi/Samsung/Huawei, caso o usuário execute *Force Stop* manual nas configurações do Android, os alarmes ficam suspensos até a reabertura do app; recomenda-se configurar a bateria como **"Sem restrições"**.
