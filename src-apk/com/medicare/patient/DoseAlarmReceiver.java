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

import android.service.notification.StatusBarNotification;
import java.util.HashSet;
import java.util.Set;

/* loaded from: classes.dex */
public class DoseAlarmReceiver extends BroadcastReceiver {
    public static final String CHANNEL_ID = "medicare_doses_alarm_v2";
    public static final String ACTION_DOSE_ALARM = "br.com.medicare.paciente.ACTION_DOSE_ALARM";
    private static final String PREFS_NAME = "medicare_patient_store_v2";
    private static final String PREF_SCHEDULED_ALARM_KEYS = "scheduled_alarm_keys_v1";

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

    private static String normalizeHora(String hStr) {
        if (hStr == null) return "";
        String t = hStr.trim();
        if (t.length() >= 5 && t.charAt(2) == ':') {
            return t.substring(0, 5);
        }
        return t;
    }

    public static void cancelDoseAndSnoozeAlarm(Context context, String medId, String medTime) {
        try {
            if (context == null || medId == null || medTime == null) return;
            AlarmManager am = (AlarmManager) context.getSystemService("alarm");
            NotificationManager nm = (NotificationManager) context.getSystemService("notification");
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            String normTime = normalizeHora(medTime);
            String[] timeVariants = normTime.equals(medTime.trim())
                    ? new String[]{normTime}
                    : new String[]{medTime.trim(), normTime};
            for (int v = 0; v < timeVariants.length; v++) {
                String t = timeVariants[v];
                if (t.isEmpty()) continue;
                int reqCode = Math.abs((medId + "_" + t).hashCode() % 400000) + 10000;
                int snoozeReqCode = Math.abs((medId + "_" + t).hashCode() % 400000) + 510000;
                int notifId = Math.abs((medId + "_" + t).hashCode() % 800000) + 20000;
                if (am != null) {
                    Intent alarmIntent = new Intent(context, DoseAlarmReceiver.class);
                    alarmIntent.setAction(ACTION_DOSE_ALARM);
                    PendingIntent pi = PendingIntent.getBroadcast(context, reqCode, alarmIntent, flags);
                    am.cancel(pi);
                    pi.cancel();

                    Intent snoozeIntent = new Intent(context, DoseAlarmReceiver.class);
                    snoozeIntent.setAction(ACTION_DOSE_ALARM);
                    PendingIntent snoozePi = PendingIntent.getBroadcast(context, snoozeReqCode, snoozeIntent, flags);
                    am.cancel(snoozePi);
                    snoozePi.cancel();
                }
                if (nm != null) {
                    nm.cancel(notifId);
                }
            }
        } catch (Exception ignored) {}
    }

    public static void cancelAllAlarmsForMed(Context context, JSONObject med) {
        try {
            if (context == null || med == null) return;
            String medId = med.optString("id", "").trim();
            if (medId.isEmpty()) return;
            JSONArray horarios = med.optJSONArray("horarios");
            if (horarios != null) {
                for (int j = 0; j < horarios.length(); j++) {
                    String hStr = horarios.optString(j, "").trim();
                    if (!hStr.isEmpty()) {
                        cancelDoseAndSnoozeAlarm(context, medId, hStr);
                    }
                }
            }
        } catch (Exception ignored) {}
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
            Set<String> deletedIds = new HashSet<>();
            try {
                JSONArray delArr = new JSONArray(prefs.getString("deleted_record_ids", "[]"));
                for (int d = 0; d < delArr.length(); d++) {
                    String did = delArr.optString(d, "").trim().toLowerCase(Locale.ROOT);
                    if (!did.isEmpty()) deletedIds.add(did);
                }
            } catch (Exception ignored) {}

            JSONArray meds = new JSONArray(medsRaw != null ? medsRaw : "[]");
            boolean enabled = isLoggedIn && prefNotifOn;
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            String todayIso = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());

            Set<String> activeMedIds = new HashSet<>();
            Set<String> newScheduledKeys = new HashSet<>();
            Set<Integer> validActiveNotifIds = new HashSet<>();

            for (int i = 0; i < meds.length(); i++) {
                JSONObject med = meds.optJSONObject(i);
                if (med == null) continue;
                String medId = med.optString("id", "med_" + i).trim();
                String medName = med.optString("nome", "Medicamento");
                String medDosage = med.optString("dosagem", "").trim();
                String medUnit = med.optString("unidade", "").trim();
                String doseLabel = medDosage.isEmpty() ? "" : (medUnit.isEmpty() ? medDosage : (medDosage + " " + medUnit));
                String tType = med.optString("treatment_type", med.optString("tipo_uso", "continuous"));
                String endDate = med.optString("end_date", med.optString("data_fim", "")).trim();
                boolean notExpired = endDate.isEmpty() || endDate.length() < 10 || todayIso.compareTo(endDate.substring(0, 10)) <= 0;
                boolean isDeleted = deletedIds.contains(medId.toLowerCase(Locale.ROOT));
                boolean medActive = !isDeleted && med.optBoolean("ativo", true) && !"sos".equalsIgnoreCase(tType) && notExpired;
                if (medActive) {
                    activeMedIds.add(medId);
                }

                JSONArray horarios = med.optJSONArray("horarios");
                if (horarios == null) continue;
                for (int j = 0; j < horarios.length(); j++) {
                    String rawH = horarios.optString(j, "").trim();
                    String hStr = normalizeHora(rawH);
                    if (!hStr.contains(":")) continue;
                    if (!enabled || !medActive) {
                        cancelDoseAndSnoozeAlarm(context, medId, rawH);
                        continue;
                    }
                    int reqCode = Math.abs((medId + "_" + hStr).hashCode() % 400000) + 10000;
                    int notifId = Math.abs((medId + "_" + hStr).hashCode() % 800000) + 20000;
                    newScheduledKeys.add(medId + "|" + hStr);
                    if (!isDoseAlreadyTakenToday(context, medId, hStr)) {
                        validActiveNotifIds.add(notifId);
                    }
                    Intent alarmIntent = new Intent(context, DoseAlarmReceiver.class);
                    alarmIntent.setAction(ACTION_DOSE_ALARM);
                    alarmIntent.putExtra("med_id", medId);
                    alarmIntent.putExtra("med_name", medName);
                    alarmIntent.putExtra("med_time", hStr);
                    alarmIntent.putExtra("med_dose", doseLabel);
                    alarmIntent.putExtra("is_snooze", false);
                    PendingIntent pi = PendingIntent.getBroadcast(context, reqCode, alarmIntent, flags);
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

            // 1. Cancel any previously scheduled alarm key that was removed, edited, or deactivated
            try {
                JSONArray prevKeys = new JSONArray(prefs.getString(PREF_SCHEDULED_ALARM_KEYS, "[]"));
                for (int k = 0; k < prevKeys.length(); k++) {
                    String key = prevKeys.optString(k, "");
                    if (!key.isEmpty() && !newScheduledKeys.contains(key)) {
                        int sep = key.lastIndexOf('|');
                        if (sep > 0 && sep < key.length() - 1) {
                            cancelDoseAndSnoozeAlarm(context, key.substring(0, sep), key.substring(sep + 1));
                        }
                    }
                }
            } catch (Exception ignored) {}

            // 2. Also scan dose_logs and stock_movements for any historical med_id that was deleted before key tracking
            try {
                JSONArray logs = new JSONArray(prefs.getString("dose_logs", "[]"));
                for (int l = 0; l < logs.length(); l++) {
                    JSONObject log = logs.optJSONObject(l);
                    if (log == null) continue;
                    String logMedId = log.optString("med_id", log.optString("medId", "")).trim();
                    if (logMedId.isEmpty() || activeMedIds.contains(logMedId)) continue;
                    String logHora = normalizeHora(log.optString("horario", log.optString("hora", log.optString("horario_programado", ""))));
                    if (logHora.contains(":")) {
                        cancelDoseAndSnoozeAlarm(context, logMedId, logHora);
                    }
                }
            } catch (Exception ignored) {}
            try {
                JSONArray moves = new JSONArray(prefs.getString("stock_movements", "[]"));
                for (int s = 0; s < moves.length(); s++) {
                    JSONObject sm = moves.optJSONObject(s);
                    if (sm == null) continue;
                    String smMedId = sm.optString("med_id", sm.optString("medication_id", "")).trim();
                    if (smMedId.isEmpty() || activeMedIds.contains(smMedId)) continue;
                    String mot = sm.optString("motivo", sm.optString("notes", ""));
                    int openP = mot.indexOf('(');
                    int closeP = mot.indexOf(')', openP + 1);
                    if (openP >= 0 && closeP > openP) {
                        String slotH = normalizeHora(mot.substring(openP + 1, closeP));
                        if (slotH.contains(":")) {
                            cancelDoseAndSnoozeAlarm(context, smMedId, slotH);
                        }
                    }
                }
            } catch (Exception ignored) {}

            // 3. Persist current active alarm keys
            JSONArray saveKeys = new JSONArray();
            for (String k : newScheduledKeys) {
                saveKeys.put(k);
            }
            prefs.edit().putString(PREF_SCHEDULED_ALARM_KEYS, saveKeys.toString()).apply();

            // 4. Dismiss any active status bar notifications belonging to deleted/inactive medications
            if (Build.VERSION.SDK_INT >= 23) {
                try {
                    NotificationManager nm = (NotificationManager) context.getSystemService("notification");
                    if (nm != null) {
                        StatusBarNotification[] activeNotifs = nm.getActiveNotifications();
                        if (activeNotifs != null) {
                            for (int n = 0; n < activeNotifs.length; n++) {
                                StatusBarNotification sbn = activeNotifs[n];
                                if (sbn != null && sbn.getId() >= 20000 && !validActiveNotifIds.contains(sbn.getId())) {
                                    nm.cancel(sbn.getId());
                                }
                            }
                        }
                    }
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
    }

    public static void cancelSnoozeForDose(Context context, String medId, String medTime) {
        try {
            if (context == null || medId == null || medTime == null) return;
            AlarmManager am = (AlarmManager) context.getSystemService("alarm");
            String normTime = normalizeHora(medTime);
            if (am != null) {
                int snoozeReqCode = Math.abs((medId + "_" + normTime).hashCode() % 400000) + 510000;
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= 23) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }
                Intent snoozeIntent = new Intent(context, DoseAlarmReceiver.class);
                snoozeIntent.setAction(ACTION_DOSE_ALARM);
                PendingIntent snoozePi = PendingIntent.getBroadcast(context, snoozeReqCode, snoozeIntent, flags);
                am.cancel(snoozePi);
                snoozePi.cancel();
            }
            NotificationManager nm = (NotificationManager) context.getSystemService("notification");
            if (nm != null) {
                int notifId = Math.abs((medId + "_" + normTime).hashCode() % 800000) + 20000;
                nm.cancel(notifId);
            }
        } catch (Exception ignored) {}
    }

    private static boolean isDoseAlarmStillValid(Context context, String medId, String medName, String medTime) {
        try {
            if (context == null) return false;
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, 0);
            if (!prefs.getBoolean("is_logged_in", false)) return false;
            String profileRaw = prefs.getString("profile", null);
            if (profileRaw != null && !profileRaw.isEmpty()) {
                try {
                    JSONObject prof = new JSONObject(profileRaw);
                    if (!prof.optBoolean("notifications_enabled", true)) return false;
                } catch (Exception ignored) {}
            }
            String cleanMedId = medId != null ? medId.trim() : "";
            if (!cleanMedId.isEmpty()) {
                try {
                    JSONArray delArr = new JSONArray(prefs.getString("deleted_record_ids", "[]"));
                    for (int d = 0; d < delArr.length(); d++) {
                        if (cleanMedId.equalsIgnoreCase(delArr.optString(d, "").trim())) {
                            return false;
                        }
                    }
                } catch (Exception ignored) {}
            }

            JSONArray meds = new JSONArray(prefs.getString("meds", "[]"));
            JSONObject matchedMed = null;
            for (int i = 0; i < meds.length(); i++) {
                JSONObject m = meds.optJSONObject(i);
                if (m == null) continue;
                String mId = m.optString("id", "").trim();
                if (!cleanMedId.isEmpty() && cleanMedId.equalsIgnoreCase(mId)) {
                    matchedMed = m;
                    break;
                }
            }
            if (matchedMed == null && cleanMedId.isEmpty() && medName != null && !medName.trim().isEmpty()) {
                for (int i = 0; i < meds.length(); i++) {
                    JSONObject m = meds.optJSONObject(i);
                    if (m != null && medName.trim().equalsIgnoreCase(m.optString("nome", "").trim())) {
                        matchedMed = m;
                        break;
                    }
                }
            }
            // If medication does not exist in active meds list (e.g. was deleted), block notification
            if (matchedMed == null) return false;
            if (!matchedMed.optBoolean("ativo", true)) return false;
            String tType = matchedMed.optString("treatment_type", matchedMed.optString("tipo_uso", "continuous"));
            if ("sos".equalsIgnoreCase(tType)) return false;

            String todayIso = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            String endDate = matchedMed.optString("end_date", matchedMed.optString("data_fim", "")).trim();
            if (!endDate.isEmpty() && endDate.length() >= 10 && todayIso.compareTo(endDate.substring(0, 10)) > 0) {
                return false;
            }

            String normTargetTime = normalizeHora(medTime);
            if (!normTargetTime.isEmpty() && normTargetTime.contains(":")) {
                JSONArray horarios = matchedMed.optJSONArray("horarios");
                if (horarios == null || horarios.length() == 0) return false;
                boolean slotFound = false;
                for (int j = 0; j < horarios.length(); j++) {
                    String h = normalizeHora(horarios.optString(j, ""));
                    if (normTargetTime.equals(h)) {
                        slotFound = true;
                        break;
                    }
                }
                if (!slotFound) return false;
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean isDoseAlreadyTakenToday(Context context, String medId, String medTime) {
        try {
            if (medId == null || medId.isEmpty() || medTime == null || medTime.isEmpty()) return false;
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, 0);
            String logsRaw = prefs.getString("dose_logs", "[]");
            JSONArray logs = new JSONArray(logsRaw != null ? logsRaw : "[]");
            String todayIso = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            String normHora = normalizeHora(medTime);

            for (int i = logs.length() - 1; i >= 0; i--) {
                JSONObject log = logs.optJSONObject(i);
                if (log == null) continue;
                String logMedId = log.optString("med_id", log.optString("medId", "")).trim();
                if (!medId.trim().equalsIgnoreCase(logMedId)) continue;
                String logDate = log.optString("data", log.optString("dose_date", log.optString("date", ""))).trim();
                if (logDate.length() >= 10) logDate = logDate.substring(0, 10);
                String logTime = normalizeHora(log.optString("horario", log.optString("hora", log.optString("horario_programado", ""))));
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
                // Immediately restore all medication alarms using setAlarmClock and purge deleted ones.
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

            // Verify if the medication and this scheduled time slot still exist and are active before notifying
            if (!isDoseAlarmStillValid(context, medId, medName, medTime)) {
                if (medId != null && !medId.isEmpty()) {
                    cancelDoseAndSnoozeAlarm(context, medId, medTime);
                }
                scheduleAlarmsFromStorage(context);
                return;
            }

            // Always reschedule all active alarms for the next day so recurring daily doses never stop
            scheduleAlarmsFromStorage(context);

            // Do not notify if the patient already confirmed or skipped this dose today
            if (medId != null && !medId.isEmpty() && isDoseAlreadyTakenToday(context, medId, medTime)) {
                cancelSnoozeForDose(context, medId, medTime);
                return;
            }

            ensureAlarmChannel(context);
            NotificationManager notificationManager = (NotificationManager) context.getSystemService("notification");
            if (notificationManager == null) return;

            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) {
                piFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            String normTime = normalizeHora(medTime);
            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            if (medId != null) openIntent.putExtra("med_id", medId);
            openIntent.putExtra("med_time", normTime);

            int notifId = (medId != null && !medId.isEmpty())
                ? (Math.abs((medId + "_" + normTime).hashCode() % 800000) + 20000)
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
            String subtitle = "Horário programado: " + normTime
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
                    int snoozeReqCode = Math.abs((medId + "_" + normTime).hashCode() % 400000) + 510000;
                    Intent snoozeIntent = new Intent(context, DoseAlarmReceiver.class);
                    snoozeIntent.setAction(ACTION_DOSE_ALARM);
                    snoozeIntent.putExtra("med_id", medId);
                    snoozeIntent.putExtra("med_name", medName);
                    snoozeIntent.putExtra("med_time", normTime);
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
