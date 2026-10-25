# MediCare Paciente — Aplicativo Android Nativo (Kotlin + Jetpack Compose)

Este diretório (`/apps/paciente-android`) contém o projeto Android **100% nativo** do **MediCare Paciente**, desenvolvido em **Kotlin** com **Jetpack Compose**, **Clean Architecture + MVVM**, **Room (Offline-First)**, **Hilt**, **AlarmManager** e **WorkManager**.

---

## 1. Como Abrir e Compilar no Android Studio

1. Abra o **Android Studio Ladybug (2024.2.1)** ou superior (JDK 17 configurado).
2. Selecione **File → Open** e escolha a pasta `/apps/paciente-android`.
3. Crie (opcionalmente) o arquivo `/apps/paciente-android/local.properties` na raiz do projeto Android para apontar para o banco de dados compartilhado sem versionar credenciais:
   ```properties
   sdk.dir=/caminho/para/seu/Android/Sdk
   MEDICARE_BACKEND_URL=https://nmtgmulqvacdgniqfrjw.supabase.co
   MEDICARE_ANON_KEY=sua_anon_key_publica_aqui
   MEDICARE_AI_PROXY_URL=https://medicare-amber-five.vercel.app
   ```
   > **Segurança:** Nunca insira `SUPABASE_SERVICE_ROLE_KEY` ou `GEMINI_API_KEY` no projeto Android. O assistente de IA consome a rota `/api/ai` do servidor e os dados do paciente são protegidos por **Row Level Security (RLS)** via token JWT individual do usuário autenticado.

---

## 2. Como Gerar o APK Instalável (Debug e Release)

### 2.1 Gerar APK de Debug (Instalável diretamente no celular)

No terminal, dentro de `/apps/paciente-android`:

```bash
./gradlew assembleDebug
```

O APK será gerado em:
```text
apps/paciente-android/app/build/outputs/apk/debug/app-debug.apk
```

Para instalar em um aparelho Android conectado via USB (com Depuração USB ativa):
```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 2.2 Gerar APK de Release Assinado

1. No Android Studio, acesse **Build → Generate Signed App Bundle / APK → APK**.
2. Crie ou selecione sua Keystore (`.jks`) fora do repositório (nunca faça commit de arquivos `.jks` ou `.keystore`).
3. Ou via linha de comando:
   ```bash
   ./gradlew assembleRelease
   ```
   O APK otimizado com R8/ProGuard estará em `app/build/outputs/apk/release/app-release.apk`.

---

## 3. Permissões Utilizadas no AndroidManifest.xml

| Permissão | Finalidade |
| :--- | :--- |
| `INTERNET` / `ACCESS_NETWORK_STATE` | Sincronização com o banco PostgreSQL compartilhado e proxy do Assistente IA. |
| `POST_NOTIFICATIONS` | Exibição de notificações de medicamentos no Android 13 (API 33) ou superior. |
| `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` | Disparo de lembretes nos horários exatos (`setExactAndAllowWhileIdle`). |
| `RECEIVE_BOOT_COMPLETED` | Reagendamento automático de todos os alarmes ativos quando o celular é reiniciado. |
| `VIBRATE` / `WAKE_LOCK` | Alerta vibratório e despertar da tela no momento da dose. |

---

## 4. Arquitetura de Notificações e Limitações Documentadas do Android

- **Agendamento Exato (`DoseAlarmScheduler`)**: Utiliza `AlarmManager.setExactAndAllowWhileIdle(RTC_WAKEUP, ...)` para atravessar o *Doze Mode* do Android.
- **Repetição Automática de 15 Minutos**: Ao disparar o alarme no horário programado, caso a dose ainda não esteja confirmada, o `DoseAlarmReceiver` agenda automaticamente um lembrete de repetição para +15 minutos.
- **Cancelamento Imediato na Confirmação**: Quando o paciente confirma a dose (seja pelo botão `"✓ Tomei agora"` da própria notificação ou dentro do aplicativo), `onDoseConfirmed(medId, hora)` cancela o `PendingIntent` de repetição e remove a notificação ativa da barra de status.
- **Prevenção de Duplicidade**: Antes de exibir qualquer notificação, o `DoseAlarmReceiver` consulta o banco local Room (`isDoseConfirmedForToday`) — se o paciente já registrou a dose adiantada, a notificação é suprimida.
- **Limitações de OEMs / Sistema Operacional**:
  - Em aparelhos com gerenciadores agressivos de bateria (Xiaomi/MIUI, Samsung OneUI, Huawei, Oppo), caso o usuário force a parada manual do aplicativo (*Force Stop* nas configurações do sistema), o Android bloqueia todos os `AlarmManager` e `BroadcastReceiver` até que o app seja aberto novamente pelo usuário. Recomenda-se orientar o paciente a marcar a bateria do MediCare como **"Sem restrições"**.
