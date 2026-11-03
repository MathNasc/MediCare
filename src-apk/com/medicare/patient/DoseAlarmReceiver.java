package com.medicare.patient;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/* loaded from: classes.dex */
public class DoseAlarmReceiver extends BroadcastReceiver {
    public static final String CHANNEL_ID = "medicare_doses_alarm_v2";
    public static final String ACTION_DOSE_ALARM = "br.com.medicare.paciente.ACTION_DOSE_ALARM";
    private static final String PREFS_NAME = "medicare_patient_store_v2";

    public static void ensureAlarmChannel(Context context) {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationManager nm = (NotificationManager) context.getSystemService("notification");
                if (nm == null) return;
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Alarmes Críticos de Medicamentos",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Alertas prioritários nos horários exatos das doses, inclusive em Economia de Bateria");
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0L, 400L, 200L, 400L, 200L, 600L});
                channel.enableLights(true);
                channel.setBypassDnd(true);
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                try {
                    Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                    if (soundUri == null) {
                        soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    }
                    AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                    channel.setSound(soundUri, attrs);
                } catch (Exception ignored) {}
                nm.createNotificationChannel(channel);
            }
        } catch (Exception ignored) {}
    }

    public static void scheduleAlarmClockSafe(Context context, AlarmManager am, long triggerAtMillis, PendingIntent operationPi) {
        if (am == null || operationPi == null) return;
        int showFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) {
            showFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        Intent showAppIntent = new Intent(context, MainActivity.class);
        showAppIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent showPi = PendingIntent.getActivity(context, 0, showAppIntent, showFlags);

        // AlarmManager.setAlarmClock is the only Android alarm primitive guaranteed to wake the device
        // at the exact minute even when Doze Mode and Battery Saver (Modo Economia de Bateria) are active.
        if (Build.VERSION.SDK_INT >= 21) {
            try {
                AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(triggerAtMillis, showPi);
                am.setAlarmClock(clockInfo, operationPi);
                return;
            } catch (SecurityException ignored) {
            } catch (Exception ignored) {}
        }
        if (Build.VERSION.SDK_INT >= 23) {
            try {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, operationPi);
                return;
            } catch (SecurityException ignored) {
            } catch (Exception ignored) {}
            try {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, operationPi);
                return;
            } catch (Exception ignored) {}
        }
        try {
            am.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, operationPi);
        } catch (Exception e) {
            try {
                am.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, operationPi);
            } catch (Exception ignored) {}
        }
    }

    public static void scheduleAlarmsFromStorage(Context context) {
        try {
            if (context == null) return;
            AlarmManager am = (AlarmManager) context.getSystemService("alarm");
            if (am == null) return;
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, 0);
            boolean isLoggedIn = prefs.getBoolean("is_logged_in", false);
            String profileRaw = prefs.getString("profile", null);
            String medsRaw = prefs.getString("meds", "[]");
            boolean prefNotifOn = true;
            if (profileRaw != null && !profileRaw.isEmpty()) {
                try {
                    JSONObject prof = new JSONObject(profileRaw);
                    prefNotifOn = prof.optBoolean("notifications_enabled", true);
                } catch (Exception ignored) {}
            }
            JSONArray meds = new JSONArray(medsRaw != null ? medsRaw : "[]");
            boolean enabled = isLoggedIn && prefNotifOn;
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            String todayIso = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());

            for (int i = 0; i < meds.length(); i++) {
                JSONObject med = meds.optJSONObject(i);
                if (med == null) continue;
                String medId = med.optString("id", "med_" + i);
                String medName = med.optString("nome", "Medicamento");
                String medDosage = med.optString("dosagem", "").trim();
                String medUnit = med.optString("unidade", "").trim();
                String doseLabel = medDosage.isEmpty() ? "" : (medUnit.isEmpty() ? medDosage : (medDosage + " " + medUnit));
                String tType = med.optString("treatment_type", med.optString("tipo_uso", "continuous"));
                String endDate = med.optString("end_date", med.optString("data_fim", "")).trim();
                boolean notExpired = endDate.isEmpty() || endDate.length() < 10 || todayIso.compareTo(endDate.substring(0, 10)) <= 0;
                boolean medActive = med.optBoolean("ativo", true) && !"sos".equalsIgnoreCase(tType) && notExpired;

                JSONArray horarios = med.optJSONArray("horarios");
                if (horarios == null) continue;
                for (int j = 0; j < horarios.length(); j++) {
                    String hStr = horarios.optString(j, "").trim();
                    if (!hStr.contains(":")) continue;
                    int reqCode = Math.abs((medId + "_" + hStr).hashCode() % 400000) + 10000;
                    Intent alarmIntent = new Intent(context, DoseAlarmReceiver.class);
                    alarmIntent.setAction(ACTION_DOSE_ALARM);
                    alarmIntent.putExtra("med_id", medId);
                    alarmIntent.putExtra("med_name", medName);
                    alarmIntent.putExtra("med_time", hStr);
                    alarmIntent.putExtra("med_dose", doseLabel);
                    alarmIntent.putExtra("is_snooze", false);
                    PendingIntent pi = PendingIntent.getBroadcast(context, reqCode, alarmIntent, flags);
                    if (!enabled || !medActive) {
                        am.cancel(pi);
                        continue;
                    }
                    String[] parts = hStr.split(":");
                    int hour = Integer.parseInt(parts[0].trim());
                    int minute = Integer.parseInt(parts[1].trim());
                    Calendar target = Calendar.getInstance();
                    target.set(Calendar.HOUR_OF_DAY, hour);
                    target.set(Calendar.MINUTE, minute);
                    target.set(Calendar.SECOND, 0);
                    target.set(Calendar.MILLISECOND, 0);
                    if (target.getTimeInMillis() <= System.currentTimeMillis()) {
                        target.add(Calendar.DAY_OF_YEAR, 1);
                    }
                    scheduleAlarmClockSafe(context, am, target.getTimeInMillis(), pi);
                }
            }
        } catch (Exception ignored) {}
    }

    public static void cancelSnoozeForDose(Context context, String medId, String medTime) {
        try {
            if (context == null || medId == null || medTime == null) return;
            AlarmManager am = (AlarmManager) context.getSystemService("alarm");
            if (am == null) return;
            int snoozeReqCode = Math.abs((medId + "_" + medTime).hashCode() % 400000) + 510000;
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            Intent snoozeIntent = new Intent(context, DoseAlarmReceiver.class);
            snoozeIntent.setAction(ACTION_DOSE_ALARM);
            PendingIntent snoozePi = PendingIntent.getBroadcast(context, snoozeReqCode, snoozeIntent, flags);
            am.cancel(snoozePi);
            NotificationManager nm = (NotificationManager) context.getSystemService("notification");
            if (nm != null) {
                int notifId = Math.abs((medId + "_" + medTime).hashCode() % 800000) + 20000;
                nm.cancel(notifId);
            }
        } catch (Exception ignored) {}
    }

    private static boolean isDoseAlreadyTakenToday(Context context, String medId, String medTime) {
        try {
            if (medId == null || medId.isEmpty() || medTime == null || medTime.isEmpty()) return false;
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, 0);
            String logsRaw = prefs.getString("dose_logs", "[]");
            JSONArray logs = new JSONArray(logsRaw != null ? logsRaw : "[]");
            String todayIso = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            String normHora = medTime.length() >= 5 && medTime.charAt(2) == ':' ? medTime.substring(0, 5) : medTime.trim();

            for (int i = logs.length() - 1; i >= 0; i--) {
                JSONObject log = logs.optJSONObject(i);
                if (log == null) continue;
                String logMedId = log.optString("med_id", log.optString("medId", "")).trim();
                if (!medId.trim().equalsIgnoreCase(logMedId)) continue;
                String logDate = log.optString("data", log.optString("dose_date", log.optString("date", ""))).trim();
                if (logDate.length() >= 10) logDate = logDate.substring(0, 10);
                String logTime = log.optString("horario", log.optString("hora", log.optString("horario_programado", ""))).trim();
                if (logTime.length() >= 5 && logTime.charAt(2) == ':') logTime = logTime.substring(0, 5);
                if (todayIso.equals(logDate) && normHora.equals(logTime)) {
                    String st = log.optString("status", "").trim().toLowerCase(Locale.ROOT);
                    return "tomado".equals(st) || "tomada".equals(st) || "confirmed".equals(st)
                        || "taken".equals(st) || "concluida".equals(st)
                        || "pulado".equals(st) || "pulada".equals(st) || "missed".equals(st);
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    @Override // android.content.BroadcastReceiver
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        PowerManager.WakeLock wakeLock = null;
        try {
            PowerManager pm = (PowerManager) context.getSystemService("power");
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "medicare:dose_alarm_wakelock");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(15000L);
            }
        } catch (Exception ignored) {}

        try {
            String action = intent.getAction();
            if (action != null && !ACTION_DOSE_ALARM.equals(action)) {
                // System boot, package update, time/timezone change, exact alarm permission grant, or battery saver toggle:
                // Immediately restore all medication alarms using setAlarmClock.
                ensureAlarmChannel(context);
                scheduleAlarmsFromStorage(context);
                return;
            }

            String medId = intent.getStringExtra("med_id");
            String medName = intent.getStringExtra("med_name");
            String medTime = intent.getStringExtra("med_time");
            String medDose = intent.getStringExtra("med_dose");
            boolean isSnooze = intent.getBooleanExtra("is_snooze", false);

            if (medName == null || medName.trim().isEmpty()) {
                medName = "Medicamento";
            }
            if (medTime == null || medTime.trim().isEmpty()) {
                medTime = "Agora";
            }
            if (medDose == null) {
                medDose = "";
            }

            // Always reschedule all active alarms for the next day so recurring daily doses never stop
            scheduleAlarmsFromStorage(context);

            // Do not notify if the patient already confirmed or skipped this dose today
            if (medId != null && !medId.isEmpty() && isDoseAlreadyTakenToday(context, medId, medTime)) {
                return;
            }

            ensureAlarmChannel(context);
            NotificationManager notificationManager = (NotificationManager) context.getSystemService("notification");
            if (notificationManager == null) return;

            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) {
                piFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            if (medId != null) openIntent.putExtra("med_id", medId);
            openIntent.putExtra("med_time", medTime);

            int notifId = (medId != null && !medId.isEmpty())
                ? (Math.abs((medId + "_" + medTime).hashCode() % 800000) + 20000)
                : (int) (System.currentTimeMillis() % 10000 + 20000);

            PendingIntent activityPi = PendingIntent.getActivity(context, notifId, openIntent, piFlags);

            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= 26) {
                builder = new Notification.Builder(context, CHANNEL_ID);
            } else {
                builder = new Notification.Builder(context);
            }

            String title = isSnooze
                ? ("⏰ Lembrete Pendente: " + medName)
                : ("💊 Hora do Medicamento: " + medName);
            String subtitle = "Horário programado: " + medTime
                + (medDose.isEmpty() ? "" : (" • Dose: " + medDose))
                + " • Toque para confirmar no MediCare";

            builder.setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(subtitle)
                .setStyle(new Notification.BigTextStyle().bigText(subtitle))
                .setContentIntent(activityPi)
                .setFullScreenIntent(activityPi, true)
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setPriority(Notification.PRIORITY_MAX)
                .setDefaults(Notification.DEFAULT_ALL)
                .setAutoCancel(true);

            notificationManager.notify(notifId, builder.build());

            // Schedule a 15-minute follow-up alarm in case the patient did not confirm the first alert
            if (!isSnooze && medId != null && !medId.isEmpty()) {
                AlarmManager am = (AlarmManager) context.getSystemService("alarm");
                if (am != null) {
                    int snoozeReqCode = Math.abs((medId + "_" + medTime).hashCode() % 400000) + 510000;
                    Intent snoozeIntent = new Intent(context, DoseAlarmReceiver.class);
                    snoozeIntent.setAction(ACTION_DOSE_ALARM);
                    snoozeIntent.putExtra("med_id", medId);
                    snoozeIntent.putExtra("med_name", medName);
                    snoozeIntent.putExtra("med_time", medTime);
                    snoozeIntent.putExtra("med_dose", medDose);
                    snoozeIntent.putExtra("is_snooze", true);
                    PendingIntent snoozePi = PendingIntent.getBroadcast(context, snoozeReqCode, snoozeIntent, piFlags);
                    scheduleAlarmClockSafe(context, am, System.currentTimeMillis() + 15L * 60000L, snoozePi);
                }
            }
        } finally {
            if (wakeLock != null) {
                try {
                    if (wakeLock.isHeld()) {
                        wakeLock.release();
                    }
                } catch (Exception ignored) {}
            }
        }
    }
}
