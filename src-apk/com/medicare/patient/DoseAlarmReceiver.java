package com.medicare.patient;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/* loaded from: classes.dex */
public class DoseAlarmReceiver extends BroadcastReceiver {
    @Override // android.content.BroadcastReceiver
    public void onReceive(Context context, Intent intent) {
        Notification.Builder builder;
        String stringExtra = intent.getStringExtra("med_name");
        String stringExtra2 = intent.getStringExtra("med_time");
        if (stringExtra == null) {
            stringExtra = "Medicamento";
        }
        if (stringExtra2 == null) {
            stringExtra2 = "Agora";
        }
        NotificationManager notificationManager = (NotificationManager) context.getSystemService("notification");
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel notificationChannel = new NotificationChannel("medicare_doses", "Lembretes de Medicamentos", 4);
            notificationChannel.enableVibration(true);
            notificationManager.createNotificationChannel(notificationChannel);
        }
        PendingIntent activity = PendingIntent.getActivity(context, 0, new Intent(context, (Class<?>) MainActivity.class), 201326592);
        if (Build.VERSION.SDK_INT >= 26) {
            builder = new Notification.Builder(context, "medicare_doses");
        } else {
            builder = new Notification.Builder(context);
        }
        builder.setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Hora do Medicamento: " + stringExtra).setContentText("Horário programado: " + stringExtra2 + " • Toque para registrar no MediCare").setContentIntent(activity).setAutoCancel(true);
        notificationManager.notify((int) (System.currentTimeMillis() % 10000), builder.build());
    }
}
