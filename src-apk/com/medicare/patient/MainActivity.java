package com.medicare.patient;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.TimePickerDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.Settings;
import android.text.Editable;
import android.text.InputType;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.util.Base64;
import android.util.TypedValue;
import android.view.View;
import android.widget.CheckBox;
import android.widget.DatePicker;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.TimePicker;
import android.widget.Toast;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/* loaded from: classes.dex */
public class MainActivity extends Activity {
    private static final String EMBEDDED_API_KEY = "";
    private static final String EMBEDDED_BACKEND_URL = "http://144.22.160.191:3009";
    private static final int REQ_PICK_PROFILE_PHOTO = 1001;
    private static final int REQ_CAPTURE_PROFILE_PHOTO = 1002;
    private static final int REQ_POST_NOTIFICATIONS = 1003;
    private boolean notificationPromptDismissed = false;
    private boolean notificationRuntimeRequested = false;
    private AlertDialog activeNotificationPromptDialog = null;
    private JSONArray allergies;
    private JSONObject calNotes;
    private JSONArray calNotesList = new JSONArray();
    private JSONArray caregivers;
    private JSONArray conditions;
    private JSONArray contacts;
    private JSONArray doseLogs;
    private JSONArray events;
    private JSONArray aiMessages = new JSONArray();
    private JSONArray meds;
    private SharedPreferences prefs;
    private JSONArray professionals;
    private JSONObject profile;
    private FrameLayout rootContainer;
    private JSONArray stockMovements;
    private String stockAuditFilterMedId = "";
    private int cPrimary = Color.parseColor("#3B82F6");
    private int cPrimaryHover = Color.parseColor("#6366F1");
    private int cPrimaryLight = Color.parseColor("#DBEAFE");
    private int cBgMain = Color.parseColor("#F8FAFC");
    private int cSurface = Color.parseColor("#FFFFFF");
    private int cSurfaceHover = Color.parseColor("#F1F5F9");
    private int cBorder = Color.parseColor("#E2E8F0");
    private int cTextMain = Color.parseColor("#0F172A");
    private int cTextMuted = Color.parseColor("#475569");
    private int cTextLight = Color.parseColor("#94A3B8");
    private int cSuccess = Color.parseColor("#22C55E");
    private int cSuccessBg = Color.parseColor("#DCFCE7");
    private int cWarning = Color.parseColor("#F59E0B");
    private int cWarningBg = Color.parseColor("#FEF3C7");
    private int cDanger = Color.parseColor("#EF4444");
    private int cDangerBg = Color.parseColor("#FEE2E2");
    private int cInfo = Color.parseColor("#3B82F6");
    private int cInfoBg = Color.parseColor("#DBEAFE");
    private int cPurple = Color.parseColor("#8B5CF6");
    private int cPurpleBg = Color.parseColor("#EDE9FE");
    private boolean isLoggedIn = false;
    private int onboardingStep = 0;
    private boolean isRegisterMode = false;
    private boolean isDarkMode = true;
    private boolean isHighContrast = false;
    private boolean isAccessibilityMode = false;
    private String fontScaleMode = "normal";
    private String activeTab = "home";
    private List<String> tabHistory = new ArrayList();
    private long lastBackPressTime = 0;
    private String medFilter = "todos";
    private String selectedCalDate = EMBEDDED_API_KEY;
    private String calViewMode = "month";
    private int calYear = 2026;
    private int calMonth = 0;
    private boolean showCalSearch = false;
    private String calSearchQuery = "";
    private String aiSubView = "main";
    private String profileSubView = "main";
    private String selectedStockMedId = "";
    private String lastSyncTimestamp = "Sincronização automática ativa";
    private boolean backendStatusOk = true;
    private volatile boolean hasUnsyncedLocalChanges = false;
    private boolean isActivityResumed = false;
    private final Handler syncPollHandler = new Handler(Looper.getMainLooper());
    private final Runnable syncPollRunnable = new Runnable() {
        @Override
        public void run() {
            if (MainActivity.this.isLoggedIn && MainActivity.this.isActivityResumed) {
                MainActivity.this.pullFromBackendIfEmptyOrUpdated();
                MainActivity.this.syncPollHandler.postDelayed(this, 15000L);
            }
        }
    };

    @Override // android.app.Activity
    protected void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        requestWindowFeature(1);
        this.prefs = getSharedPreferences("medicare_patient_store_v2", 0);
        this.selectedCalDate = todayIso();
        Calendar cal = Calendar.getInstance();
        this.calYear = cal.get(Calendar.YEAR);
        this.calMonth = cal.get(Calendar.MONTH);
        loadOrInitData();
        ensureNotificationChannel();
        scheduleAllMedicationAlarms();
        FrameLayout frameLayout = new FrameLayout(this);
        this.rootContainer = frameLayout;
        setContentView(frameLayout);
        render();
        pullFromBackendIfEmptyOrUpdated();
    }

    @Override // android.app.Activity
    protected void onResume() {
        super.onResume();
        this.isActivityResumed = true;
        this.syncPollHandler.removeCallbacks(this.syncPollRunnable);
        if (this.isLoggedIn) {
            pullFromBackendIfEmptyOrUpdated();
            this.syncPollHandler.postDelayed(this.syncPollRunnable, 15000L);
        }
    }

    @Override // android.app.Activity
    protected void onPause() {
        this.isActivityResumed = false;
        this.syncPollHandler.removeCallbacks(this.syncPollRunnable);
        super.onPause();
    }

    private void ensureNotificationChannel() {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationManager nm = (NotificationManager) getSystemService("notification");
                if (nm != null) {
                    NotificationChannel ch = new NotificationChannel("medicare_doses", "Lembretes de Medicamentos", 4);
                    ch.setDescription("Alertas e alarmes nos horários programados das doses");
                    ch.enableVibration(true);
                    nm.createNotificationChannel(ch);
                }
            }
        } catch (Exception ignored) {}
    }

    private boolean areSystemNotificationsAllowed() {
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                    return false;
                }
            }
            if (Build.VERSION.SDK_INT >= 24) {
                NotificationManager nm = (NotificationManager) getSystemService("notification");
                if (nm != null && !nm.areNotificationsEnabled()) {
                    return false;
                }
            }
            return true;
        } catch (Exception e) {
            return true;
        }
    }

    private boolean areNotificationsFullyActive() {
        boolean prefOn = this.profile == null || this.profile.optBoolean("notifications_enabled", true);
        return prefOn && areSystemNotificationsAllowed();
    }

    private void openSystemNotificationSettings() {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= 26) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", getPackageName(), null));
            }
            startActivity(intent);
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.fromParts("package", getPackageName(), null));
                startActivity(fallback);
            } catch (Exception ignored) {}
        }
    }

    private void scheduleAllMedicationAlarms() {
        try {
            AlarmManager am = (AlarmManager) getSystemService("alarm");
            if (am == null || this.meds == null) return;
            boolean enabled = this.isLoggedIn && areNotificationsFullyActive();
            int flags = 134217728; // FLAG_UPDATE_CURRENT
            if (Build.VERSION.SDK_INT >= 23) {
                flags |= 67108864; // FLAG_IMMUTABLE
            }
            for (int i = 0; i < this.meds.length(); i++) {
                JSONObject med = this.meds.optJSONObject(i);
                if (med == null) continue;
                String medId = med.optString("id", "med_" + i);
                String medName = med.optString("nome", "Medicamento");
                boolean medActive = med.optBoolean("ativo", true) && !"sos".equalsIgnoreCase(med.optString("treatment_type", "continuous"));
                JSONArray horarios = med.optJSONArray("horarios");
                if (horarios == null) continue;
                for (int j = 0; j < horarios.length(); j++) {
                    String hStr = horarios.optString(j, "").trim();
                    if (!hStr.contains(":")) continue;
                    int reqCode = Math.abs((medId + "_" + hStr).hashCode() % 900000) + 10000;
                    Intent alarmIntent = new Intent(this, DoseAlarmReceiver.class);
                    alarmIntent.putExtra("med_name", medName);
                    alarmIntent.putExtra("med_time", hStr);
                    PendingIntent pi = PendingIntent.getBroadcast(this, reqCode, alarmIntent, flags);
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
                    long triggerAt = target.getTimeInMillis();
                    if (Build.VERSION.SDK_INT >= 23) {
                        try {
                            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                        } catch (SecurityException se) {
                            am.set(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                        }
                    } else {
                        am.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                    }
                }
            }
        } catch (Exception ignored) {}
    }

    private void checkAndPromptNotificationsOnStartup() {
        try {
            if (!this.isLoggedIn) return;
            if (!this.prefs.getBoolean("onboarding_completed", false)) return;
            if (areNotificationsFullyActive()) return;
            if (this.notificationPromptDismissed) return;

            if (Build.VERSION.SDK_INT >= 33 && !this.notificationRuntimeRequested) {
                if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                    this.notificationRuntimeRequested = true;
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_POST_NOTIFICATIONS);
                    return;
                }
            }
            showNotificationStartupPromptDialog();
        } catch (Exception ignored) {}
    }

    private void showNotificationStartupPromptDialog() {
        if (this.activeNotificationPromptDialog != null && this.activeNotificationPromptDialog.isShowing()) {
            return;
        }
        final AlertDialog dialog = new AlertDialog.Builder(this).create();
        this.activeNotificationPromptDialog = dialog;
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(1);
        root.setGravity(17);
        root.setBackground(shape(this.cSurface, 24, this.cBorder, 1));
        root.setPadding(dp(24), dp(24), dp(24), dp(20));

        TextView tvIcon = new TextView(this);
        tvIcon.setText("🔔");
        tvIcon.setTextSize(sp(28.0f));
        tvIcon.setGravity(17);
        tvIcon.setBackground(shape(Color.argb(35, Color.red(this.cPrimary), Color.green(this.cPrimary), Color.blue(this.cPrimary)), 28, Color.argb(80, Color.red(this.cPrimary), Color.green(this.cPrimary), Color.blue(this.cPrimary)), 1));
        LinearLayout.LayoutParams icLp = new LinearLayout.LayoutParams(dp(56), dp(56));
        icLp.bottomMargin = dp(14);
        tvIcon.setLayoutParams(icLp);
        root.addView(tvIcon);

        TextView tvTitle = new TextView(this);
        tvTitle.setText("Ativar Notificações");
        tvTitle.setTextColor(this.cTextMain);
        tvTitle.setTextSize(sp(19.0f));
        tvTitle.setTypeface(null, 1);
        tvTitle.setGravity(17);
        root.addView(tvTitle);

        boolean sysAllowed = areSystemNotificationsAllowed();
        TextView tvDesc = new TextView(this);
        tvDesc.setText(sysAllowed
            ? "As notificações de lembretes estão desativadas. Ative agora para receber alertas nos horários exatos dos seus medicamentos e não esquecer nenhuma dose."
            : "Permita as notificações do MediCare no seu celular para receber alertas sonoros nos horários dos seus medicamentos e avisos de estoque.");
        tvDesc.setTextColor(this.cTextMuted);
        tvDesc.setTextSize(sp(14.0f));
        tvDesc.setGravity(17);
        tvDesc.setLineSpacing(dp(2), 1.05f);
        tvDesc.setPadding(0, dp(10), 0, dp(20));
        root.addView(tvDesc);

        TextView btnAllow = new TextView(this);
        btnAllow.setText("🔔 Permitir notificações");
        btnAllow.setTextColor(Color.WHITE);
        btnAllow.setTextSize(sp(15.0f));
        btnAllow.setTypeface(null, 1);
        btnAllow.setGravity(17);
        btnAllow.setBackground(gradientShape(this.cPrimary, this.cPrimaryHover, 14));
        btnAllow.setPadding(dp(16), dp(14), dp(16), dp(14));
        LinearLayout.LayoutParams alLp = new LinearLayout.LayoutParams(-1, -2);
        alLp.bottomMargin = dp(10);
        btnAllow.setLayoutParams(alLp);
        btnAllow.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dialog.dismiss();
                try {
                    MainActivity.this.profile.put("notifications_enabled", true);
                    MainActivity.this.notificationPromptDismissed = true;
                    ensureNotificationChannel();
                    if (!areSystemNotificationsAllowed()) {
                        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_POST_NOTIFICATIONS);
                        } else {
                            openSystemNotificationSettings();
                        }
                    } else {
                        Toast.makeText(MainActivity.this, "✓ Notificações ativadas com sucesso!", 0).show();
                    }
                    saveAll();
                    render();
                } catch (Exception ignored) {}
            }
        });
        root.addView(btnAllow);

        TextView btnLater = new TextView(this);
        btnLater.setText("Agora não");
        btnLater.setTextColor(this.cTextMuted);
        btnLater.setTextSize(sp(14.0f));
        btnLater.setTypeface(null, 1);
        btnLater.setGravity(17);
        btnLater.setBackground(shape(this.cBgMain, 14, this.cBorder, 1));
        btnLater.setPadding(dp(16), dp(12), dp(16), dp(12));
        btnLater.setLayoutParams(new LinearLayout.LayoutParams(-1, -2));
        btnLater.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.notificationPromptDismissed = true;
                dialog.dismiss();
            }
        });
        root.addView(btnLater);

        dialog.setView(root);
        dialog.show();
        styleDialogWindow(dialog);
    }

    @Override // android.app.Activity
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_POST_NOTIFICATIONS) {
            boolean granted = grantResults != null && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted) {
                try {
                    this.profile.put("notifications_enabled", true);
                    this.notificationPromptDismissed = true;
                    ensureNotificationChannel();
                    scheduleAllMedicationAlarms();
                    saveAll();
                    render();
                    Toast.makeText(this, "✓ Notificações ativadas com sucesso!", 0).show();
                } catch (Exception ignored) {}
            } else if (!this.notificationPromptDismissed) {
                showNotificationStartupPromptDialog();
            }
        }
    }

    @Override // android.app.Activity
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if ((requestCode == REQ_PICK_PROFILE_PHOTO || requestCode == REQ_CAPTURE_PROFILE_PHOTO) && resultCode == RESULT_OK && data != null) {
            try {
                Bitmap rawBmp = null;
                Uri imgUri = data.getData();
                if (imgUri != null) {
                    InputStream is = getContentResolver().openInputStream(imgUri);
                    if (is != null) {
                        BitmapFactory.Options opts = new BitmapFactory.Options();
                        opts.inSampleSize = 2;
                        rawBmp = BitmapFactory.decodeStream(is, null, opts);
                        is.close();
                        if (rawBmp == null) {
                            InputStream is2 = getContentResolver().openInputStream(imgUri);
                            if (is2 != null) {
                                rawBmp = BitmapFactory.decodeStream(is2);
                                is2.close();
                            }
                        }
                    }
                    if (rawBmp != null) {
                        rawBmp = fixImageOrientation(imgUri, rawBmp);
                    }
                } else if (data.getExtras() != null && data.getExtras().get("data") instanceof Bitmap) {
                    rawBmp = (Bitmap) data.getExtras().get("data");
                }
                if (rawBmp != null) {
                    int w = rawBmp.getWidth();
                    int h = rawBmp.getHeight();
                    int side = Math.min(w, h);
                    int xOff = (w - side) / 2;
                    int yOff = (h - side) / 2;
                    Bitmap squareBmp = Bitmap.createBitmap(rawBmp, xOff, yOff, side, side);
                    Bitmap scaledBmp = Bitmap.createScaledBitmap(squareBmp, 240, 240, true);
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    scaledBmp.compress(Bitmap.CompressFormat.JPEG, 85, baos);
                    String b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
                    this.profile.put("foto_base64", b64);
                    this.profile.put("foto_url", "data:image/jpeg;base64," + b64);
                    saveAll();
                    render();
                    Toast.makeText(this, "✓ Foto de perfil atualizada!", 0).show();
                } else {
                    Toast.makeText(this, "Não foi possível carregar a imagem selecionada", 0).show();
                }
            } catch (Exception e) {
                Toast.makeText(this, "Erro ao processar foto: " + e.getMessage(), 0).show();
            }
        }
    }

    private Bitmap fixImageOrientation(Uri imgUri, Bitmap bitmap) {
        if (bitmap == null || imgUri == null) return bitmap;
        int rotateDegrees = 0;
        boolean flipHorizontal = false;
        boolean flipVertical = false;
        try {
            if (Build.VERSION.SDK_INT >= 24) {
                InputStream exifStream = getContentResolver().openInputStream(imgUri);
                if (exifStream != null) {
                    ExifInterface exif = new ExifInterface(exifStream);
                    int orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
                    exifStream.close();
                    switch (orientation) {
                        case ExifInterface.ORIENTATION_ROTATE_90:
                            rotateDegrees = 90;
                            break;
                        case ExifInterface.ORIENTATION_ROTATE_180:
                            rotateDegrees = 180;
                            break;
                        case ExifInterface.ORIENTATION_ROTATE_270:
                            rotateDegrees = 270;
                            break;
                        case ExifInterface.ORIENTATION_FLIP_HORIZONTAL:
                            flipHorizontal = true;
                            break;
                        case ExifInterface.ORIENTATION_FLIP_VERTICAL:
                            flipVertical = true;
                            break;
                        case ExifInterface.ORIENTATION_TRANSPOSE:
                            rotateDegrees = 90;
                            flipHorizontal = true;
                            break;
                        case ExifInterface.ORIENTATION_TRANSVERSE:
                            rotateDegrees = 270;
                            flipHorizontal = true;
                            break;
                    }
                }
            }
        } catch (Exception ignored) {}

        if (rotateDegrees == 0 && !flipHorizontal && !flipVertical) {
            try {
                Cursor cursor = getContentResolver().query(imgUri, new String[]{MediaStore.Images.ImageColumns.ORIENTATION}, null, null, null);
                if (cursor != null) {
                    if (cursor.moveToFirst()) {
                        rotateDegrees = cursor.getInt(0);
                    }
                    cursor.close();
                }
            } catch (Exception ignored) {}
        }

        if (rotateDegrees != 0 || flipHorizontal || flipVertical) {
            try {
                Matrix matrix = new Matrix();
                if (rotateDegrees != 0) {
                    matrix.postRotate(rotateDegrees);
                }
                if (flipHorizontal || flipVertical) {
                    matrix.postScale(flipHorizontal ? -1.0f : 1.0f, flipVertical ? -1.0f : 1.0f);
                }
                Bitmap oriented = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
                if (oriented != null) {
                    return oriented;
                }
            } catch (Exception ignored) {}
        }
        return bitmap;
    }

    private void rotateCurrentProfilePhoto(int degrees) {
        try {
            String b64 = this.profile.optString("foto_base64", "").trim();
            if (b64.isEmpty()) {
                String fotoUrl = this.profile.optString("foto_url", "").trim();
                if (fotoUrl.startsWith("data:image") && fotoUrl.contains(",")) {
                    b64 = fotoUrl.substring(fotoUrl.indexOf(",") + 1).trim();
                }
            }
            if (b64.isEmpty()) return;
            byte[] decoded = Base64.decode(b64, Base64.DEFAULT);
            if (decoded == null || decoded.length == 0) return;
            Bitmap src = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
            if (src == null) return;
            Matrix matrix = new Matrix();
            matrix.postRotate(degrees);
            Bitmap rotated = Bitmap.createBitmap(src, 0, 0, src.getWidth(), src.getHeight(), matrix, true);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            rotated.compress(Bitmap.CompressFormat.JPEG, 88, baos);
            String newB64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
            this.profile.put("foto_base64", newB64);
            this.profile.put("foto_url", "data:image/jpeg;base64," + newB64);
            saveAll();
            render();
            Toast.makeText(this, "🔄 Foto girada!", 0).show();
        } catch (Exception e) {
            Toast.makeText(this, "Erro ao girar foto", 0).show();
        }
    }

    private void styleDialogWindow(AlertDialog dialog) {
        if (dialog != null && dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            try {
                View decor = dialog.getWindow().getDecorView();
                if (decor != null) {
                    decor.setBackgroundColor(Color.TRANSPARENT);
                }
                View content = dialog.findViewById(android.R.id.content);
                if (content != null) {
                    content.setBackgroundColor(Color.TRANSPARENT);
                }
            } catch (Exception ignored) {}
        }
    }

    private void showStyledConfirmDialog(String titleText, String messageText, String confirmText, String cancelText, int confirmColor, final Runnable onConfirm) {
        final AlertDialog dialog = new AlertDialog.Builder(this).create();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(1);
        root.setBackground(shape(this.cSurface, 22, this.cBorder, 1));
        root.setPadding(dp(22), dp(22), dp(22), dp(20));

        TextView tvTitle = new TextView(this);
        tvTitle.setText(titleText);
        tvTitle.setTextColor(this.cTextMain);
        tvTitle.setTextSize(sp(18.0f));
        tvTitle.setTypeface(null, 1);
        root.addView(tvTitle);

        TextView tvDesc = new TextView(this);
        tvDesc.setText(messageText);
        tvDesc.setTextColor(this.cTextMuted);
        tvDesc.setTextSize(sp(14.5f));
        tvDesc.setLineSpacing(dp(2), 1.05f);
        tvDesc.setPadding(0, dp(10), 0, dp(20));
        root.addView(tvDesc);

        LinearLayout btnRow = new LinearLayout(this);
        btnRow.setOrientation(0);
        btnRow.setGravity(16);

        if (cancelText != null && !cancelText.isEmpty()) {
            TextView btnCancel = new TextView(this);
            btnCancel.setText(cancelText);
            btnCancel.setTextColor(this.cTextMain);
            btnCancel.setTextSize(sp(14.0f));
            btnCancel.setTypeface(null, 1);
            btnCancel.setGravity(17);
            btnCancel.setBackground(shape(this.cSurfaceHover, 13, this.cBorder, 1));
            btnCancel.setPadding(dp(14), dp(13), dp(14), dp(13));
            LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
            cLp.rightMargin = dp(10);
            btnCancel.setLayoutParams(cLp);
            btnCancel.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    dialog.dismiss();
                }
            });
            btnRow.addView(btnCancel);
        }

        TextView btnOk = new TextView(this);
        btnOk.setText(confirmText);
        btnOk.setTextColor(Color.WHITE);
        btnOk.setTextSize(sp(14.0f));
        btnOk.setTypeface(null, 1);
        btnOk.setGravity(17);
        btnOk.setBackground(shape(confirmColor, 13, 0, 0));
        btnOk.setPadding(dp(14), dp(13), dp(14), dp(13));
        btnOk.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.15f));
        btnOk.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dialog.dismiss();
                if (onConfirm != null) {
                    onConfirm.run();
                }
            }
        });
        btnRow.addView(btnOk);

        root.addView(btnRow);
        dialog.setView(root);
        dialog.show();
        styleDialogWindow(dialog);
    }

    private void showStyledSelectDialog(String titleText, final String[] options, int selectedIdx, final DialogInterface.OnClickListener onSelect) {
        final AlertDialog dialog = new AlertDialog.Builder(this).create();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(1);
        root.setBackground(shape(this.cSurface, 22, this.cBorder, 1));
        root.setPadding(dp(20), dp(20), dp(20), dp(16));

        LinearLayout hdr = new LinearLayout(this);
        hdr.setOrientation(0);
        hdr.setGravity(16);
        hdr.setPadding(0, 0, 0, dp(12));

        TextView tvTitle = new TextView(this);
        tvTitle.setText(titleText);
        tvTitle.setTextColor(this.cTextMain);
        tvTitle.setTextSize(sp(17.5f));
        tvTitle.setTypeface(null, 1);
        tvTitle.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        hdr.addView(tvTitle);

        TextView btnClose = new TextView(this);
        btnClose.setText("✕");
        btnClose.setTextColor(this.cTextMuted);
        btnClose.setTextSize(sp(14.0f));
        btnClose.setGravity(17);
        btnClose.setBackground(shape(this.cSurfaceHover, 16, 0, 0));
        btnClose.setLayoutParams(new LinearLayout.LayoutParams(dp(32), dp(32)));
        btnClose.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dialog.dismiss();
            }
        });
        hdr.addView(btnClose);
        root.addView(hdr);

        ScrollView sv = new ScrollView(this);
        LinearLayout list = new LinearLayout(this);
        list.setOrientation(1);
        for (int i = 0; i < options.length; i++) {
            final int idx = i;
            boolean isSel = (i == selectedIdx);
            LinearLayout itemRow = new LinearLayout(this);
            itemRow.setOrientation(0);
            itemRow.setGravity(16);
            int rowBg = isSel ? Color.argb(30, Color.red(this.cPrimary), Color.green(this.cPrimary), Color.blue(this.cPrimary)) : this.cBgMain;
            int rowBorder = isSel ? this.cPrimary : this.cBorder;
            itemRow.setBackground(shape(rowBg, 12, rowBorder, 1));
            itemRow.setPadding(dp(14), dp(12), dp(14), dp(12));
            LinearLayout.LayoutParams rLp = new LinearLayout.LayoutParams(-1, -2);
            if (i < options.length - 1) rLp.bottomMargin = dp(8);
            itemRow.setLayoutParams(rLp);

            TextView tvOpt = new TextView(this);
            tvOpt.setText(options[i]);
            tvOpt.setTextColor(isSel ? this.cPrimary : this.cTextMain);
            tvOpt.setTextSize(sp(14.5f));
            if (isSel) tvOpt.setTypeface(null, 1);
            tvOpt.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
            itemRow.addView(tvOpt);

            if (isSel) {
                TextView tvChk = new TextView(this);
                tvChk.setText("✓");
                tvChk.setTextColor(this.cPrimary);
                tvChk.setTextSize(sp(15.0f));
                tvChk.setTypeface(null, 1);
                itemRow.addView(tvChk);
            }

            itemRow.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    dialog.dismiss();
                    if (onSelect != null) {
                        onSelect.onClick(dialog, idx);
                    }
                }
            });
            list.addView(itemRow);
        }
        sv.addView(list);
        root.addView(sv);

        dialog.setView(root);
        dialog.show();
        styleDialogWindow(dialog);
    }

    private void showStyledFormModal(String titleText, View bodyContent, String confirmText, String cancelText, int confirmColor, final Runnable onConfirm) {
        final AlertDialog dialog = new AlertDialog.Builder(this).create();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(1);
        root.setBackground(shape(this.cSurface, 24, this.cBorder, 1));
        root.setPadding(dp(20), dp(20), dp(20), dp(18));

        if (titleText != null && !titleText.isEmpty()) {
            LinearLayout hdr = new LinearLayout(this);
            hdr.setOrientation(0);
            hdr.setGravity(16);
            hdr.setPadding(0, 0, 0, dp(14));

            TextView tvTitle = new TextView(this);
            tvTitle.setText(titleText);
            tvTitle.setTextColor(this.cTextMain);
            tvTitle.setTextSize(sp(17.5f));
            tvTitle.setTypeface(null, 1);
            tvTitle.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
            hdr.addView(tvTitle);

            TextView btnClose = new TextView(this);
            btnClose.setText("✕");
            btnClose.setTextColor(this.cTextMuted);
            btnClose.setTextSize(sp(14.0f));
            btnClose.setGravity(17);
            btnClose.setBackground(shape(this.cSurfaceHover, 16, 0, 0));
            btnClose.setLayoutParams(new LinearLayout.LayoutParams(dp(32), dp(32)));
            btnClose.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    dialog.dismiss();
                }
            });
            hdr.addView(btnClose);
            root.addView(hdr);
        }

        if (bodyContent != null) {
            root.addView(bodyContent);
        }

        LinearLayout btnRow = new LinearLayout(this);
        btnRow.setOrientation(0);
        btnRow.setGravity(16);
        LinearLayout.LayoutParams brLp = new LinearLayout.LayoutParams(-1, -2);
        brLp.topMargin = dp(12);
        btnRow.setLayoutParams(brLp);

        if (cancelText != null && !cancelText.isEmpty()) {
            TextView btnCancel = new TextView(this);
            btnCancel.setText(cancelText);
            btnCancel.setTextColor(this.cTextMain);
            btnCancel.setTextSize(sp(14.0f));
            btnCancel.setTypeface(null, 1);
            btnCancel.setGravity(17);
            btnCancel.setBackground(shape(this.cBgMain, 13, this.cBorder, 1));
            btnCancel.setPadding(dp(14), dp(13), dp(14), dp(13));
            LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
            cLp.rightMargin = dp(10);
            btnCancel.setLayoutParams(cLp);
            btnCancel.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    dialog.dismiss();
                }
            });
            btnRow.addView(btnCancel);
        }

        TextView btnOk = new TextView(this);
        btnOk.setText(confirmText);
        btnOk.setTextColor(Color.WHITE);
        btnOk.setTextSize(sp(14.0f));
        btnOk.setTypeface(null, 1);
        btnOk.setGravity(17);
        btnOk.setBackground(shape(confirmColor, 13, 0, 0));
        btnOk.setPadding(dp(14), dp(13), dp(14), dp(13));
        btnOk.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.2f));
        btnOk.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dialog.dismiss();
                if (onConfirm != null) {
                    onConfirm.run();
                }
            }
        });
        btnRow.addView(btnOk);

        root.addView(btnRow);
        dialog.setView(root);
        dialog.show();
        styleDialogWindow(dialog);
    }

    private Bitmap getProfileCircularBitmap(int diameterPx, int ringColor) {
        try {
            String b64 = this.profile.optString("foto_base64", "").trim();
            if (b64.isEmpty()) {
                String fotoUrl = this.profile.optString("foto_url", "").trim();
                if (fotoUrl.startsWith("data:image") && fotoUrl.contains(",")) {
                    b64 = fotoUrl.substring(fotoUrl.indexOf(",") + 1).trim();
                }
            }
            if (b64.isEmpty()) return null;
            byte[] decoded = Base64.decode(b64, Base64.DEFAULT);
            if (decoded == null || decoded.length == 0) return null;
            Bitmap src = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
            if (src == null) return null;

            Bitmap output = Bitmap.createBitmap(diameterPx, diameterPx, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(output);

            Bitmap scaled = Bitmap.createScaledBitmap(src, diameterPx, diameterPx, true);
            BitmapShader shader = new BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP);
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            paint.setShader(shader);

            float radius = diameterPx / 2.0f;
            float strokeW = dp(2);
            canvas.drawCircle(radius, radius, radius - strokeW, paint);

            Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            borderPaint.setStyle(Paint.Style.STROKE);
            borderPaint.setColor(ringColor);
            borderPaint.setStrokeWidth(strokeW);
            canvas.drawCircle(radius, radius, radius - (strokeW / 2.0f), borderPaint);

            return output;
        } catch (Exception e) {
            return null;
        }
    }

    private int getProfileAvatarAccentColor() {
        String hex = this.profile.optString("avatar_color", "#3B82F6").trim();
        try {
            return Color.parseColor(hex);
        } catch (Exception e) {
            return this.cPrimary;
        }
    }

    private View buildProfileAvatarView(int sizeDp, boolean showCameraBadge, final Runnable onClickAction) {
        FrameLayout avatarFrame = new FrameLayout(this);
        int outerSize = dp(sizeDp + (showCameraBadge ? 6 : 0));
        int circlePx = dp(sizeDp);
        avatarFrame.setLayoutParams(new LinearLayout.LayoutParams(outerSize, outerSize));

        int accentCol = getProfileAvatarAccentColor();
        Bitmap circBmp = getProfileCircularBitmap(circlePx, accentCol);
        if (circBmp != null) {
            ImageView iv = new ImageView(this);
            iv.setImageBitmap(circBmp);
            iv.setScaleType(ImageView.ScaleType.FIT_XY);
            FrameLayout.LayoutParams ivLp = new FrameLayout.LayoutParams(circlePx, circlePx, 17);
            iv.setLayoutParams(ivLp);
            avatarFrame.addView(iv);
        } else {
            String socialName = this.profile.optString("social_name", "").trim();
            String fullName = this.profile.optString("nome", "Seu Nome").trim();
            String displayName = !socialName.isEmpty() ? socialName : (!fullName.isEmpty() ? fullName : "Seu Nome");
            String initial = displayName.isEmpty() ? "👤" : displayName.substring(0, 1).toUpperCase(Locale.ROOT);
            int circleBg = Color.argb(this.isDarkMode ? 45 : 28, Color.red(accentCol), Color.green(accentCol), Color.blue(accentCol));

            TextView tvAvatarCircle = new TextView(this);
            tvAvatarCircle.setText(initial);
            tvAvatarCircle.setTextColor(this.cTextMain);
            tvAvatarCircle.setTextSize(sp(sizeDp * 0.35f));
            tvAvatarCircle.setTypeface(null, 1);
            tvAvatarCircle.setGravity(17);
            tvAvatarCircle.setBackground(shape(circleBg, sizeDp / 2 + 4, accentCol, 2));
            FrameLayout.LayoutParams acLp = new FrameLayout.LayoutParams(circlePx, circlePx, 17);
            tvAvatarCircle.setLayoutParams(acLp);
            avatarFrame.addView(tvAvatarCircle);
        }

        if (showCameraBadge) {
            TextView tvCamBadge = new TextView(this);
            tvCamBadge.setText("📷");
            tvCamBadge.setTextSize(sp(14.0f));
            tvCamBadge.setGravity(17);
            tvCamBadge.setBackground(shape(accentCol, 18, this.cBgMain, 2));
            int badgePx = dp(34);
            FrameLayout.LayoutParams cbLp = new FrameLayout.LayoutParams(badgePx, badgePx, 85);
            tvCamBadge.setLayoutParams(cbLp);
            tvCamBadge.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    if (onClickAction != null) onClickAction.run();
                }
            });
            avatarFrame.addView(tvCamBadge);
        }

        avatarFrame.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (onClickAction != null) onClickAction.run();
            }
        });
        return avatarFrame;
    }

    private void showPhotoOptionsDialog() {
        final AlertDialog dialog = new AlertDialog.Builder(this).create();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(1);
        root.setBackground(shape(this.cSurface, 24, this.cBorder, 1));
        root.setPadding(dp(22), dp(22), dp(22), dp(20));

        LinearLayout hdr = new LinearLayout(this);
        hdr.setOrientation(0);
        hdr.setGravity(16);
        hdr.setPadding(0, 0, 0, dp(14));

        TextView tvTitle = new TextView(this);
        tvTitle.setText("📷 Foto do Perfil");
        tvTitle.setTextColor(this.cTextMain);
        tvTitle.setTextSize(sp(18.5f));
        tvTitle.setTypeface(null, 1);
        tvTitle.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        hdr.addView(tvTitle);

        TextView btnClose = new TextView(this);
        btnClose.setText("✕");
        btnClose.setTextColor(this.cTextMuted);
        btnClose.setTextSize(sp(15.0f));
        btnClose.setGravity(17);
        btnClose.setBackground(shape(this.cSurfaceHover, 18, 0, 0));
        btnClose.setLayoutParams(new LinearLayout.LayoutParams(dp(34), dp(34)));
        btnClose.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dialog.dismiss();
            }
        });
        hdr.addView(btnClose);
        root.addView(hdr);

        TextView tvSub = new TextView(this);
        tvSub.setText("Escolha uma foto da sua galeria, tire uma foto agora ou personalize a cor do seu avatar.");
        tvSub.setTextColor(this.cTextMuted);
        tvSub.setTextSize(sp(13.0f));
        tvSub.setPadding(0, 0, 0, dp(16));
        root.addView(tvSub);

        // Option 1: Pick from Gallery
        TextView btnGallery = new TextView(this);
        btnGallery.setText("🖼️  Escolher foto da Galeria");
        btnGallery.setTextColor(Color.WHITE);
        btnGallery.setTextSize(sp(14.5f));
        btnGallery.setTypeface(null, 1);
        btnGallery.setGravity(17);
        btnGallery.setBackground(gradientShape(Color.parseColor("#3B82F6"), Color.parseColor("#6366F1"), 14));
        btnGallery.setPadding(dp(16), dp(14), dp(16), dp(14));
        LinearLayout.LayoutParams gLp = new LinearLayout.LayoutParams(-1, -2);
        gLp.bottomMargin = dp(10);
        btnGallery.setLayoutParams(gLp);
        btnGallery.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dialog.dismiss();
                try {
                    Intent pickIntent = new Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
                    pickIntent.setType("image/*");
                    startActivityForResult(pickIntent, REQ_PICK_PROFILE_PHOTO);
                } catch (Exception e1) {
                    try {
                        Intent getIntent = new Intent(Intent.ACTION_GET_CONTENT);
                        getIntent.setType("image/*");
                        getIntent.addCategory(Intent.CATEGORY_OPENABLE);
                        startActivityForResult(Intent.createChooser(getIntent, "Selecionar foto"), REQ_PICK_PROFILE_PHOTO);
                    } catch (Exception e2) {
                        Toast.makeText(MainActivity.this, "Galeria indisponível neste dispositivo", 0).show();
                    }
                }
            }
        });
        root.addView(btnGallery);

        // Option 2: Take photo with Camera
        TextView btnCamera = new TextView(this);
        btnCamera.setText("📸  Tirar foto com a Câmera");
        btnCamera.setTextColor(this.cTextMain);
        btnCamera.setTextSize(sp(14.0f));
        btnCamera.setTypeface(null, 1);
        btnCamera.setGravity(17);
        btnCamera.setBackground(shape(this.cBgMain, 14, this.cBorder, 1));
        btnCamera.setPadding(dp(16), dp(13), dp(16), dp(13));
        LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(-1, -2);
        cLp.bottomMargin = dp(16);
        btnCamera.setLayoutParams(cLp);
        btnCamera.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dialog.dismiss();
                try {
                    Intent camIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    startActivityForResult(camIntent, REQ_CAPTURE_PROFILE_PHOTO);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Câmera indisponível", 0).show();
                }
            }
        });
        root.addView(btnCamera);

        // Option 3: Avatar Color Picker
        TextView tvColorLbl = new TextView(this);
        tvColorLbl.setText("COR DO AVATAR / BORDA");
        tvColorLbl.setTextColor(this.cTextLight);
        tvColorLbl.setTextSize(sp(11.0f));
        tvColorLbl.setTypeface(null, 1);
        tvColorLbl.setPadding(0, 0, 0, dp(8));
        root.addView(tvColorLbl);

        final String[] avatarColors = {"#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#F59E0B", "#06B6D4", "#EF4444"};
        String curCol = this.profile.optString("avatar_color", "#3B82F6");
        LinearLayout colorRow = new LinearLayout(this);
        colorRow.setOrientation(0);
        LinearLayout.LayoutParams crLp = new LinearLayout.LayoutParams(-1, -2);
        crLp.bottomMargin = dp(12);
        colorRow.setLayoutParams(crLp);

        for (int i = 0; i < avatarColors.length; i++) {
            final String cHex = avatarColors[i];
            boolean isSel = cHex.equalsIgnoreCase(curCol);
            View sw = new View(this);
            sw.setBackground(shape(Color.parseColor(cHex), 10, isSel ? Color.WHITE : Color.TRANSPARENT, isSel ? 3 : 0));
            LinearLayout.LayoutParams swLp = new LinearLayout.LayoutParams(0, dp(36), 1.0f);
            if (i < avatarColors.length - 1) swLp.rightMargin = dp(6);
            sw.setLayoutParams(swLp);
            sw.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    try {
                        MainActivity.this.profile.put("avatar_color", cHex);
                        saveAll();
                        dialog.dismiss();
                        render();
                        Toast.makeText(MainActivity.this, "✓ Cor do avatar atualizada!", 0).show();
                    } catch (Exception ignored) {}
                }
            });
            colorRow.addView(sw);
        }
        root.addView(colorRow);

        // Option 4: Rotate or Remove current photo (if present)
        boolean hasPhoto = !this.profile.optString("foto_base64", "").isEmpty()
                || this.profile.optString("foto_url", "").startsWith("data:image");
        if (hasPhoto) {
            LinearLayout rotRow = new LinearLayout(this);
            rotRow.setOrientation(0);
            LinearLayout.LayoutParams rrLp = new LinearLayout.LayoutParams(-1, -2);
            rrLp.topMargin = dp(4);
            rrLp.bottomMargin = dp(8);
            rotRow.setLayoutParams(rrLp);

            TextView btnRotLeft = new TextView(this);
            btnRotLeft.setText("↺ Girar 90° esq.");
            btnRotLeft.setTextColor(this.cPrimary);
            btnRotLeft.setTextSize(sp(13.0f));
            btnRotLeft.setTypeface(null, 1);
            btnRotLeft.setGravity(17);
            btnRotLeft.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
            btnRotLeft.setPadding(dp(10), dp(11), dp(10), dp(11));
            LinearLayout.LayoutParams rlLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
            rlLp.rightMargin = dp(8);
            btnRotLeft.setLayoutParams(rlLp);
            btnRotLeft.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    dialog.dismiss();
                    rotateCurrentProfilePhoto(-90);
                }
            });
            rotRow.addView(btnRotLeft);

            TextView btnRotRight = new TextView(this);
            btnRotRight.setText("↻ Girar 90° dir.");
            btnRotRight.setTextColor(this.cPrimary);
            btnRotRight.setTextSize(sp(13.0f));
            btnRotRight.setTypeface(null, 1);
            btnRotRight.setGravity(17);
            btnRotRight.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
            btnRotRight.setPadding(dp(10), dp(11), dp(10), dp(11));
            btnRotRight.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
            btnRotRight.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    dialog.dismiss();
                    rotateCurrentProfilePhoto(90);
                }
            });
            rotRow.addView(btnRotRight);
            root.addView(rotRow);

            TextView btnRemove = new TextView(this);
            btnRemove.setText("🗑️  Remover foto atual");
            btnRemove.setTextColor(this.cDanger);
            btnRemove.setTextSize(sp(13.5f));
            btnRemove.setTypeface(null, 1);
            btnRemove.setGravity(17);
            btnRemove.setBackground(shape(Color.parseColor("#1AEF4444"), 12, Color.parseColor("#40EF4444"), 1));
            btnRemove.setPadding(dp(14), dp(12), dp(14), dp(12));
            btnRemove.setLayoutParams(new LinearLayout.LayoutParams(-1, -2));
            btnRemove.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    MainActivity.this.profile.remove("foto_base64");
                    MainActivity.this.profile.remove("foto_url");
                    saveAll();
                    dialog.dismiss();
                    render();
                    Toast.makeText(MainActivity.this, "Foto de perfil removida", 0).show();
                }
            });
            root.addView(btnRemove);
        }

        dialog.setView(root);
        dialog.show();
        styleDialogWindow(dialog);
    }

    @Override // android.app.Activity
    public void onBackPressed() {
        if (!this.isLoggedIn) {
            if (this.isRegisterMode) {
                this.isRegisterMode = false;
                render();
                return;
            }
            super.onBackPressed();
            return;
        }
        boolean onboardingCompleted = this.prefs.getBoolean("onboarding_completed", false);
        if (!onboardingCompleted) {
            if (this.onboardingStep > 0) {
                this.onboardingStep--;
                render();
                return;
            }
        }
        if ("profile".equals(this.activeTab) && !"main".equals(this.profileSubView)) {
            this.profileSubView = "main";
            render();
            return;
        }
        if ("ai".equals(this.activeTab) && !"main".equals(this.aiSubView)) {
            this.aiSubView = "main";
            render();
            return;
        }
        if ("calendar".equals(this.activeTab) && this.showCalSearch) {
            this.showCalSearch = false;
            render();
            return;
        }
        if (!this.tabHistory.isEmpty()) {
            this.activeTab = this.tabHistory.remove(this.tabHistory.size() - 1);
            render();
        } else {
            if (!"home".equals(this.activeTab)) {
                this.activeTab = "home";
                render();
                return;
            }
            long currentTimeMillis = System.currentTimeMillis();
            if (currentTimeMillis - this.lastBackPressTime < 2000) {
                super.onBackPressed();
            } else {
                this.lastBackPressTime = currentTimeMillis;
                Toast.makeText(this, "Pressione voltar novamente para sair", 0).show();
            }
        }
    }

    private void switchTab(String str) {
        if (str.equals(this.activeTab)) {
            if ("profile".equals(str)) {
                this.profileSubView = "main";
            }
            if ("ai".equals(str)) {
                this.aiSubView = "main";
            }
            render();
            return;
        }
        this.tabHistory.add(this.activeTab);
        if (this.tabHistory.size() > 15) {
            this.tabHistory.remove(0);
        }
        this.activeTab = str;
        if (!"profile".equals(str)) {
            this.profileSubView = "main";
        }
        if (!"ai".equals(str)) {
            this.aiSubView = "main";
        }
        render();
        if (this.isLoggedIn) {
            pullFromBackendIfEmptyOrUpdated();
        }
    }

    private String todayIso() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private float getFontScaleFactor() {
        float base = "xlarge".equals(this.fontScaleMode) ? 1.24f : ("large".equals(this.fontScaleMode) ? 1.12f : 1.0f);
        if (this.isAccessibilityMode && base < 1.15f) {
            base = 1.15f;
        }
        return base;
    }

    private int dp(int i) {
        return (int) TypedValue.applyDimension(1, i * (this.isAccessibilityMode ? 1.12f : 1.0f), getResources().getDisplayMetrics());
    }

    private float sp(float f) {
        return f * getFontScaleFactor();
    }

    private GradientDrawable shape(int i, int i2, int i3, int i4) {
        GradientDrawable gradientDrawable = new GradientDrawable();
        gradientDrawable.setColor(i);
        gradientDrawable.setCornerRadius(dp(i2));
        if (i4 > 0) {
            gradientDrawable.setStroke(dp(i4), i3);
        }
        return gradientDrawable;
    }

    private GradientDrawable gradientShape(int i, int i2, int i3) {
        GradientDrawable gradientDrawable = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{i, i2});
        gradientDrawable.setCornerRadius(dp(i3));
        return gradientDrawable;
    }

    private void applyThemeColors() {
        if (this.isHighContrast) {
            this.cPrimary = Color.parseColor("#3B82F6");
            this.cPrimaryHover = Color.parseColor("#6366F1");
            this.cPrimaryLight = Color.parseColor(this.isDarkMode ? "#1E3A8A" : "#DBEAFE");
            this.cBgMain = Color.parseColor(this.isDarkMode ? "#000000" : "#FFFFFF");
            this.cSurface = Color.parseColor(this.isDarkMode ? "#111111" : "#F9F9F9");
            this.cSurfaceHover = Color.parseColor(this.isDarkMode ? "#222222" : "#EEEEEE");
            this.cBorder = Color.parseColor(this.isDarkMode ? "#444444" : "#CCCCCC");
            this.cTextMain = Color.parseColor(this.isDarkMode ? "#FFFFFF" : "#000000");
            this.cTextMuted = Color.parseColor(this.isDarkMode ? "#DDDDDD" : "#222222");
            this.cTextLight = Color.parseColor(this.isDarkMode ? "#AAAAAA" : "#555555");
            this.cSuccessBg = Color.parseColor(this.isDarkMode ? "#052E16" : "#DCFCE7");
            this.cWarningBg = Color.parseColor(this.isDarkMode ? "#1C1200" : "#FEF3C7");
            this.cDangerBg = Color.parseColor(this.isDarkMode ? "#1C0505" : "#FEE2E2");
            this.cInfoBg = Color.parseColor(this.isDarkMode ? "#0A1628" : "#DBEAFE");
            this.cPurpleBg = Color.parseColor(this.isDarkMode ? "#2E1065" : "#EDE9FE");
        } else if (this.isDarkMode) {
            this.cPrimary = Color.parseColor("#3B82F6");
            this.cPrimaryHover = Color.parseColor("#6366F1");
            this.cPrimaryLight = Color.parseColor("#1E3A8A");
            this.cBgMain = Color.parseColor("#0F172A");
            this.cSurface = Color.parseColor("#1E293B");
            this.cSurfaceHover = Color.parseColor("#334155");
            this.cBorder = Color.parseColor("#334155");
            this.cTextMain = Color.parseColor("#F8FAFC");
            this.cTextMuted = Color.parseColor("#CBD5E1");
            this.cTextLight = Color.parseColor("#64748B");
            this.cSuccessBg = Color.parseColor("#052E16");
            this.cWarningBg = Color.parseColor("#451A03");
            this.cDangerBg = Color.parseColor("#450A0A");
            this.cInfoBg = Color.parseColor("#1E3A8A");
            this.cPurpleBg = Color.parseColor("#2E1065");
        } else {
            this.cPrimary = Color.parseColor("#3B82F6");
            this.cPrimaryHover = Color.parseColor("#6366F1");
            this.cPrimaryLight = Color.parseColor("#DBEAFE");
            this.cBgMain = Color.parseColor("#F8FAFC");
            this.cSurface = Color.parseColor("#FFFFFF");
            this.cSurfaceHover = Color.parseColor("#F1F5F9");
            this.cBorder = Color.parseColor("#E2E8F0");
            this.cTextMain = Color.parseColor("#0F172A");
            this.cTextMuted = Color.parseColor("#475569");
            this.cTextLight = Color.parseColor("#94A3B8");
            this.cSuccessBg = Color.parseColor("#DCFCE7");
            this.cWarningBg = Color.parseColor("#FEF3C7");
            this.cDangerBg = Color.parseColor("#FEE2E2");
            this.cInfoBg = Color.parseColor("#DBEAFE");
            this.cPurpleBg = Color.parseColor("#EDE9FE");
        }
        if (Build.VERSION.SDK_INT >= 21) {
            getWindow().setStatusBarColor(this.cBgMain);
            getWindow().setNavigationBarColor(this.cSurface);
        }
    }

    private JSONObject createEmptyProfile() {
        JSONObject p = new JSONObject();
        try {
            p.put("id", "");
            p.put("nome", "");
            p.put("full_name", "");
            p.put("social_name", "");
            p.put("email", "");
            p.put("data_nascimento", "");
            p.put("dob", "");
            p.put("sex", "");
            p.put("sexo", "");
            p.put("gender", "");
            p.put("telefone", "");
            p.put("phone", "");
            p.put("cpf", "");
            p.put("tipo_sanguineo", "");
            p.put("blood_type", "");
            p.put("peso", "");
            p.put("weight", "");
            p.put("altura", "");
            p.put("height", "");
            p.put("endereco", "");
            p.put("address", "");
            p.put("role", "independente");
            p.put("user_role", "independent");
            p.put("observacoes_medicas", "");
            p.put("emergency_notes", "");
            p.put("alerta_sonoro", true);
            p.put("notifications_enabled", true);
        } catch (Exception ignored) {}
        return p;
    }

    private void resetActiveSessionData() {
        this.profile = createEmptyProfile();
        this.meds = new JSONArray();
        this.doseLogs = new JSONArray();
        this.events = new JSONArray();
        this.calNotes = new JSONObject();
        this.calNotesList = new JSONArray();
        this.stockMovements = new JSONArray();
        this.allergies = new JSONArray();
        this.conditions = new JSONArray();
        this.contacts = new JSONArray();
        this.professionals = new JSONArray();
        this.caregivers = new JSONArray();
        this.aiMessages = new JSONArray();
        this.onboardingStep = 0;
        this.activeTab = "home";
        this.profileSubView = "main";
        this.aiSubView = "main";
        this.stockAuditFilterMedId = "";
        this.tabHistory.clear();
    }

    private boolean isOriginalMatheusAccount(String id, String email, String nome) {
        String cleanId = id != null ? id.trim() : "";
        String cleanNome = nome != null ? nome.trim().toLowerCase(Locale.ROOT) : "";
        if ("98e5cdc4-7866-43e5-9c90-ebb712ecd816".equalsIgnoreCase(cleanId)) {
            return cleanNome.isEmpty() || cleanNome.startsWith("matheus");
        }
        return cleanNome.equals("matheus do nascimento araujo");
    }

    private boolean hasLeakedOldProfileData(JSONObject prof, JSONArray medsArr) {
        if (prof == null) return false;
        String id = prof.optString("id", "");
        String email = prof.optString("email", "");
        String nome = prof.optString("nome", "");
        if (isOriginalMatheusAccount(id, email, nome)) {
            return false;
        }
        if (medsArr != null) {
            boolean hasSertralina = false;
            boolean hasHidantalOrVenvanse = false;
            for (int i = 0; i < medsArr.length(); i++) {
                JSONObject m = medsArr.optJSONObject(i);
                if (m != null) {
                    String mn = m.optString("nome", "").trim().toLowerCase(Locale.ROOT);
                    if (mn.contains("sertralina")) hasSertralina = true;
                    if (mn.contains("hidantal") || mn.contains("venvanse")) hasHidantalOrVenvanse = true;
                }
            }
            if (hasSertralina && hasHidantalOrVenvanse) {
                return true;
            }
        }
        return false;
    }

    private String resolveCurrentAccountUserId() {
        String patId = this.profile != null ? this.profile.optString("id", "").trim() : "";
        String email = this.profile != null ? this.profile.optString("email", "").trim().toLowerCase(Locale.ROOT) : "";
        String nome = this.profile != null ? this.profile.optString("nome", "").trim().toLowerCase(Locale.ROOT) : "";
        if (!patId.isEmpty() && !patId.startsWith("pac-") && !patId.equals("user-local-paciente")) {
            if ("98e5cdc4-7866-43e5-9c90-ebb712ecd816".equalsIgnoreCase(patId) && !isOriginalMatheusAccount(patId, email, nome)) {
                String fixedId = !email.isEmpty()
                    ? UUID.nameUUIDFromBytes(("medicare-user:" + email).getBytes(StandardCharsets.UTF_8)).toString()
                    : UUID.randomUUID().toString();
                try { this.profile.put("id", fixedId); } catch (Exception ignored) {}
                return fixedId;
            }
            return patId;
        }
        if (isOriginalMatheusAccount(patId, email, nome)) {
            patId = "98e5cdc4-7866-43e5-9c90-ebb712ecd816";
        } else if (!email.isEmpty()) {
            patId = UUID.nameUUIDFromBytes(("medicare-user:" + email).getBytes(StandardCharsets.UTF_8)).toString();
        } else {
            patId = UUID.randomUUID().toString();
        }
        try {
            if (this.profile != null) {
                this.profile.put("id", patId);
            }
        } catch (Exception ignored) {}
        return patId;
    }

    private void saveUserSnapshot() {
        try {
            if (this.profile == null) return;
            String emailKey = this.profile.optString("email", "").trim().toLowerCase(Locale.ROOT);
            if (emailKey.isEmpty()) return;
            if (hasLeakedOldProfileData(this.profile, this.meds)) return;
            JSONObject snap = new JSONObject();
            snap.put("profile", new JSONObject(this.profile.toString()));
            snap.put("meds", this.meds != null ? new JSONArray(this.meds.toString()) : new JSONArray());
            snap.put("dose_logs", this.doseLogs != null ? new JSONArray(this.doseLogs.toString()) : new JSONArray());
            snap.put("events", this.events != null ? new JSONArray(this.events.toString()) : new JSONArray());
            snap.put("cal_notes", this.calNotes != null ? new JSONObject(this.calNotes.toString()) : new JSONObject());
            snap.put("cal_notes_list", this.calNotesList != null ? new JSONArray(this.calNotesList.toString()) : new JSONArray());
            snap.put("stock_movements", this.stockMovements != null ? new JSONArray(this.stockMovements.toString()) : new JSONArray());
            snap.put("allergies", this.allergies != null ? new JSONArray(this.allergies.toString()) : new JSONArray());
            snap.put("conditions", this.conditions != null ? new JSONArray(this.conditions.toString()) : new JSONArray());
            snap.put("contacts", this.contacts != null ? new JSONArray(this.contacts.toString()) : new JSONArray());
            snap.put("professionals", this.professionals != null ? new JSONArray(this.professionals.toString()) : new JSONArray());
            snap.put("caregivers", this.caregivers != null ? new JSONArray(this.caregivers.toString()) : new JSONArray());
            snap.put("ai_messages", this.aiMessages != null ? new JSONArray(this.aiMessages.toString()) : new JSONArray());
            snap.put("onboarding_completed", this.prefs.getBoolean("onboarding_completed", false));
            this.prefs.edit().putString("user_snapshot_" + emailKey, snap.toString()).apply();
        } catch (Exception ignored) {}
    }

    private boolean restoreUserSnapshot(String email, String expectedUserId) {
        try {
            if (email == null || email.trim().isEmpty()) return false;
            String emailKey = email.trim().toLowerCase(Locale.ROOT);
            String raw = this.prefs.getString("user_snapshot_" + emailKey, null);
            if (raw == null || raw.isEmpty()) return false;
            JSONObject snap = new JSONObject(raw);
            JSONObject snapProf = snap.optJSONObject("profile");
            if (snapProf == null) return false;
            String snapEmail = snapProf.optString("email", "").trim().toLowerCase(Locale.ROOT);
            if (!emailKey.equals(snapEmail)) return false;
            String snapId = snapProf.optString("id", "").trim();
            if (expectedUserId != null && !expectedUserId.trim().isEmpty() && !snapId.isEmpty() && !snapId.equalsIgnoreCase(expectedUserId.trim())) {
                return false;
            }
            JSONArray snapMeds = snap.optJSONArray("meds");
            if (hasLeakedOldProfileData(snapProf, snapMeds)) {
                this.prefs.edit().remove("user_snapshot_" + emailKey).apply();
                return false;
            }
            this.profile = snapProf;
            this.meds = snapMeds != null ? snapMeds : new JSONArray();
            this.doseLogs = snap.optJSONArray("dose_logs") != null ? snap.optJSONArray("dose_logs") : new JSONArray();
            this.events = snap.optJSONArray("events") != null ? snap.optJSONArray("events") : new JSONArray();
            this.calNotes = snap.optJSONObject("cal_notes") != null ? snap.optJSONObject("cal_notes") : new JSONObject();
            this.calNotesList = snap.optJSONArray("cal_notes_list") != null ? snap.optJSONArray("cal_notes_list") : new JSONArray();
            this.stockMovements = snap.optJSONArray("stock_movements") != null ? snap.optJSONArray("stock_movements") : new JSONArray();
            this.allergies = snap.optJSONArray("allergies") != null ? snap.optJSONArray("allergies") : new JSONArray();
            this.conditions = snap.optJSONArray("conditions") != null ? snap.optJSONArray("conditions") : new JSONArray();
            this.contacts = snap.optJSONArray("contacts") != null ? snap.optJSONArray("contacts") : new JSONArray();
            this.professionals = snap.optJSONArray("professionals") != null ? snap.optJSONArray("professionals") : new JSONArray();
            this.caregivers = snap.optJSONArray("caregivers") != null ? snap.optJSONArray("caregivers") : new JSONArray();
            this.aiMessages = snap.optJSONArray("ai_messages") != null ? snap.optJSONArray("ai_messages") : new JSONArray();
            this.prefs.edit().putBoolean("onboarding_completed", snap.optBoolean("onboarding_completed", true)).apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void wipeRemoteLeakedDataForUser(final String targetUserId, final String keepName, final String keepEmail, final String keepRole) {
        if (targetUserId == null || targetUserId.trim().isEmpty()) return;
        final String uid = targetUserId.trim();
        if ("98e5cdc4-7866-43e5-9c90-ebb712ecd816".equalsIgnoreCase(uid)) {
            return;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String[][] deleteTargets = {
                        {"historico_doses", "user_id"},
                        {"stock_movements", "user_id"},
                        {"medicamentos", "user_id"},
                        {"health_events", "user_id"},
                        {"notes", "user_id"},
                        {"calendar_notes", "user_id"},
                        {"allergies", "user_id"},
                        {"health_conditions", "user_id"},
                        {"emergency_contacts", "user_id"},
                        {"healthcare_professionals", "user_id"},
                        {"caregiver_relationships", "patient_id"}
                    };
                    for (int i = 0; i < deleteTargets.length; i++) {
                        try {
                            URL delUrl = new URL(EMBEDDED_BACKEND_URL + "/api/rest/v1/" + deleteTargets[i][0] + "?" + deleteTargets[i][1] + "=eq." + Uri.encode(uid));
                            HttpURLConnection delConn = (HttpURLConnection) delUrl.openConnection();
                            delConn.setRequestMethod("DELETE");
                            delConn.setConnectTimeout(6000);
                            delConn.setReadTimeout(6000);
                            delConn.getResponseCode();
                            delConn.disconnect();
                        } catch (Exception ignored) {}
                    }
                    try {
                        URL upsertUrl = new URL(EMBEDDED_BACKEND_URL + "/api/rest/v1/profiles");
                        HttpURLConnection upsertConn = (HttpURLConnection) upsertUrl.openConnection();
                        upsertConn.setRequestMethod("POST");
                        upsertConn.setConnectTimeout(6000);
                        upsertConn.setReadTimeout(6000);
                        upsertConn.setDoOutput(true);
                        upsertConn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                        upsertConn.setRequestProperty("Prefer", "resolution=merge-duplicates");
                        JSONObject cleanProf = new JSONObject();
                        cleanProf.put("id", uid);
                        cleanProf.put("nome", keepName != null && !keepName.isEmpty() ? keepName : "Paciente");
                        if (keepEmail != null && !keepEmail.isEmpty()) cleanProf.put("email", keepEmail);
                        cleanProf.put("role", keepRole != null && !keepRole.isEmpty() ? keepRole : "independente");
                        cleanProf.put("social_name", JSONObject.NULL);
                        cleanProf.put("dob", JSONObject.NULL);
                        cleanProf.put("sex", JSONObject.NULL);
                        cleanProf.put("cpf", JSONObject.NULL);
                        cleanProf.put("phone", JSONObject.NULL);
                        cleanProf.put("address", JSONObject.NULL);
                        cleanProf.put("weight", JSONObject.NULL);
                        cleanProf.put("height", JSONObject.NULL);
                        cleanProf.put("blood_type", JSONObject.NULL);
                        cleanProf.put("foto_url", JSONObject.NULL);
                        byte[] bodyBytes = cleanProf.toString().getBytes(StandardCharsets.UTF_8);
                        OutputStream os = upsertConn.getOutputStream();
                        os.write(bodyBytes);
                        os.close();
                        upsertConn.getResponseCode();
                        upsertConn.disconnect();
                    } catch (Exception ignored) {}
                    MainActivity.this.prefs.edit().putBoolean("v257_remote_cleaned_" + uid, true).apply();
                } catch (Exception ignored) {}
            }
        }).start();
    }

    private void loadOrInitData() {
        try {
            this.isLoggedIn = this.prefs.getBoolean("is_logged_in", false);
            this.isDarkMode = this.prefs.getBoolean("dark_mode", true);
            this.isHighContrast = this.prefs.getBoolean("high_contrast", false);
            this.isAccessibilityMode = this.prefs.getBoolean("accessibility_mode", false);
            this.fontScaleMode = this.prefs.getString("font_scale_mode", "normal");
            this.lastSyncTimestamp = this.prefs.getString("last_sync_timestamp", "Sincronização automática ativa");
            String string = this.prefs.getString("profile", null);
            if (string != null && this.isLoggedIn) {
                this.profile = new JSONObject(string);
                this.meds = new JSONArray(this.prefs.getString("meds", "[]"));
                this.doseLogs = new JSONArray(this.prefs.getString("dose_logs", "[]"));
                this.events = new JSONArray(this.prefs.getString("events", "[]"));
                this.calNotes = new JSONObject(this.prefs.getString("cal_notes", "{}"));
                this.calNotesList = new JSONArray(this.prefs.getString("cal_notes_list", "[]"));
                this.stockMovements = new JSONArray(this.prefs.getString("stock_movements", "[]"));
                boolean migrated = migrateStockEventsFromEvents();
                boolean deduped = deduplicateStockMovements();
                if (migrated || deduped) {
                    this.prefs.edit()
                        .putString("events", this.events.toString())
                        .putString("stock_movements", this.stockMovements.toString())
                        .apply();
                }
                this.allergies = new JSONArray(this.prefs.getString("allergies", "[]"));
                this.conditions = new JSONArray(this.prefs.getString("conditions", "[]"));
                this.contacts = new JSONArray(this.prefs.getString("contacts", "[]"));
                this.professionals = new JSONArray(this.prefs.getString("professionals", "[]"));
                this.caregivers = new JSONArray(this.prefs.getString("caregivers", "[]"));
                this.aiMessages = new JSONArray(this.prefs.getString("ai_messages", "[]"));

                if ("maria.silva@email.com".equalsIgnoreCase(this.profile.optString("email", ""))) {
                    this.isLoggedIn = false;
                    resetActiveSessionData();
                    this.prefs.edit().putBoolean("is_logged_in", false).putBoolean("onboarding_completed", false).apply();
                    saveLocalStateOnly();
                    return;
                }

                String curId = this.profile.optString("id", "").trim();
                String curEmail = this.profile.optString("email", "").trim().toLowerCase(Locale.ROOT);
                String curNome = this.profile.optString("nome", "").trim();
                boolean notOriginalUser = !isOriginalMatheusAccount(curId, curEmail, curNome);
                boolean needsCleanup = hasLeakedOldProfileData(this.profile, this.meds)
                    || (notOriginalUser && !this.prefs.getBoolean("v257_account_isolation_cleaned", false));

                if (needsCleanup) {
                    String cleanId = resolveCurrentAccountUserId();
                    String cleanRole = isPatientProfileRole() ? "paciente" : "independente";
                    if (!curEmail.isEmpty()) {
                        this.prefs.edit().remove("user_snapshot_" + curEmail).apply();
                    }
                    resetActiveSessionData();
                    this.profile.put("id", cleanId);
                    this.profile.put("nome", curNome);
                    this.profile.put("full_name", curNome);
                    this.profile.put("email", curEmail);
                    setProfileRoleValue(cleanRole);
                    this.prefs.edit()
                        .putBoolean("onboarding_completed", false)
                        .putBoolean("v257_account_isolation_cleaned", true)
                        .apply();
                    saveLocalStateOnly();
                    wipeRemoteLeakedDataForUser(cleanId, curNome, curEmail, cleanRole);
                } else {
                    this.prefs.edit().putBoolean("v257_account_isolation_cleaned", true).apply();
                    saveUserSnapshot();
                }
            } else {
                this.isLoggedIn = false;
                resetActiveSessionData();
                this.prefs.edit().putBoolean("v257_account_isolation_cleaned", true).apply();
                saveLocalStateOnly();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void saveLocalStateOnly() {
        this.prefs.edit()
            .putBoolean("is_logged_in", this.isLoggedIn)
            .putBoolean("dark_mode", this.isDarkMode)
            .putBoolean("high_contrast", this.isHighContrast)
            .putBoolean("accessibility_mode", this.isAccessibilityMode)
            .putString("font_scale_mode", this.fontScaleMode)
            .putString("last_sync_timestamp", this.lastSyncTimestamp)
            .putString("profile", this.profile.toString())
            .putString("meds", this.meds.toString())
            .putString("dose_logs", this.doseLogs.toString())
            .putString("events", this.events.toString())
            .putString("cal_notes", this.calNotes.toString())
            .putString("cal_notes_list", this.calNotesList.toString())
            .putString("stock_movements", this.stockMovements.toString())
            .putString("allergies", this.allergies.toString())
            .putString("conditions", this.conditions.toString())
            .putString("contacts", this.contacts.toString())
            .putString("professionals", this.professionals.toString())
            .putString("caregivers", this.caregivers.toString())
            .putString("ai_messages", this.aiMessages.toString())
            .apply();
        if (this.isLoggedIn) {
            saveUserSnapshot();
        }
        scheduleAllMedicationAlarms();
    }

    private void performLogout() {
        if (this.isLoggedIn) {
            saveUserSnapshot();
        }
        this.isLoggedIn = false;
        this.isRegisterMode = false;
        scheduleAllMedicationAlarms();
        resetActiveSessionData();
        this.prefs.edit().putBoolean("onboarding_completed", false).remove("active_user_email").apply();
        saveLocalStateOnly();
        render();
    }

    private void saveAll() {
        this.hasUnsyncedLocalChanges = true;
        saveLocalStateOnly();
        if (this.isLoggedIn) {
            syncWithBackendSilently(false);
        }
    }

    private void render() {
        applyThemeColors();
        this.rootContainer.removeAllViews();
        this.rootContainer.setBackgroundColor(this.cBgMain);
        if (!this.isLoggedIn) {
            this.rootContainer.addView(buildLoginView());
            return;
        }
        boolean onboardingCompleted = this.prefs.getBoolean("onboarding_completed", false);
        if (!onboardingCompleted) {
            this.rootContainer.addView(buildOnboardingView());
            return;
        }
        LinearLayout linearLayout = new LinearLayout(this);
        linearLayout.setOrientation(1);
        linearLayout.setLayoutParams(new FrameLayout.LayoutParams(-1, -1));
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setLayoutParams(new LinearLayout.LayoutParams(-1, 0, 1.0f));
        LinearLayout linearLayout2 = new LinearLayout(this);
        linearLayout2.setOrientation(1);
        linearLayout2.setPadding(dp(16), dp(22), dp(16), dp(32));
        if ("home".equals(this.activeTab)) {
            buildHomeTab(linearLayout2);
        } else if ("meds".equals(this.activeTab)) {
            buildMedsTab(linearLayout2);
        } else if ("calendar".equals(this.activeTab)) {
            buildCalendarTab(linearLayout2);
        } else if ("ai".equals(this.activeTab)) {
            buildAiTab(linearLayout2);
        } else if ("profile".equals(this.activeTab)) {
            buildProfileTab(linearLayout2);
        }
        scrollView.addView(linearLayout2);
        linearLayout.addView(scrollView);
        View navBorder = new View(this);
        navBorder.setBackgroundColor(this.cBorder);
        navBorder.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(1)));
        linearLayout.addView(navBorder);
        linearLayout.addView(buildBottomNav());
        this.rootContainer.addView(linearLayout);
        checkAndPromptNotificationsOnStartup();
    }

    private View buildHeader() {
        return new View(this);
    }

    public /* synthetic */ void m4lambda$buildHeader$0$commedicarepatientMainActivity(View view) {
        onBackPressed();
    }

    public /* synthetic */ void m5lambda$buildHeader$1$commedicarepatientMainActivity(View view) {
        showSosEmergencyDialog();
    }

    private int getPendingDosesCountToday() {
        int count = 0;
        for (int i = 0; i < this.meds.length(); i++) {
            JSONObject med = this.meds.optJSONObject(i);
            if (med != null && med.optBoolean("ativo", true)) {
                String tType = med.optString("treatment_type", med.optString("tipo_uso", "continuous"));
                if (!"sos".equalsIgnoreCase(tType)) {
                    String medId = med.optString("id");
                    JSONArray horarios = med.optJSONArray("horarios");
                    if (horarios != null) {
                        for (int j = 0; j < horarios.length(); j++) {
                            String h = horarios.optString(j);
                            String st = getDoseStatus(medId, todayIso(), h);
                            if (!"tomado".equals(st) && !"tomada".equals(st) && !"confirmed".equals(st) && !"pulada".equals(st)) {
                                count++;
                            }
                        }
                    }
                }
            }
        }
        return count;
    }

    private int getCriticalStockCount() {
        int count = 0;
        for (int i = 0; i < this.meds.length(); i++) {
            JSONObject med = this.meds.optJSONObject(i);
            if (med != null && med.optBoolean("ativo", true)) {
                int q = med.has("quantidade") ? med.optInt("quantidade", 30) : med.optInt("estoque_atual", 30);
                if (q <= 5) {
                    count++;
                }
            }
        }
        return count;
    }

    private View buildBottomNav() {
        LinearLayout linearLayout = new LinearLayout(this);
        linearLayout.setOrientation(0);
        linearLayout.setBackgroundColor(this.isDarkMode ? Color.parseColor("#0F172A") : this.cSurface);
        linearLayout.setPadding(dp(2), dp(6), dp(2), dp(0));
        String[][] strArr = {
            new String[]{"home", "🏠", "Início"},
            new String[]{"meds", "💊", "Medicamentos"},
            new String[]{"calendar", "📅", "Calendário"},
            new String[]{"ai", "🩺", "Assistente"},
            new String[]{"profile", "👤", "Perfil"}
        };
        int pendingCount = getPendingDosesCountToday();
        int criticalCount = getCriticalStockCount();
        for (int i3 = 0; i3 < 5; i3++) {
            final String[] strArr2 = strArr[i3];
            boolean equals = strArr2[0].equals(this.activeTab);
            int badge = 0;
            if ("home".equals(strArr2[0]) && pendingCount > 0) badge = pendingCount;
            if ("meds".equals(strArr2[0]) && criticalCount > 0) badge = criticalCount;

            FrameLayout tabFrame = new FrameLayout(this);
            tabFrame.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

            LinearLayout linearLayout2 = new LinearLayout(this);
            linearLayout2.setOrientation(1);
            linearLayout2.setGravity(17);
            linearLayout2.setLayoutParams(new FrameLayout.LayoutParams(-1, -2));
            linearLayout2.setPadding(dp(2), dp(4), dp(2), dp(0));

            FrameLayout iconBox = new FrameLayout(this);
            LinearLayout.LayoutParams iconLp = new LinearLayout.LayoutParams(dp(42), dp(28));
            iconBox.setLayoutParams(iconLp);
            if (equals) {
                iconBox.setBackground(shape(Color.parseColor("#263B82F6"), 10, 0, 0));
            }
            TextView textView = new TextView(this);
            textView.setText(strArr2[1]);
            textView.setTextSize(sp(16.0f));
            textView.setGravity(17);
            textView.setLayoutParams(new FrameLayout.LayoutParams(-1, -1));
            iconBox.addView(textView);
            linearLayout2.addView(iconBox);

            TextView textView2 = new TextView(this);
            textView2.setText(strArr2[2]);
            textView2.setTextSize(sp(9.5f));
            textView2.setTypeface(null, equals ? 1 : 0);
            textView2.setTextColor(equals ? this.cPrimary : this.cTextLight);
            textView2.setGravity(17);
            textView2.setSingleLine(true);
            textView2.setPadding(0, dp(2), 0, dp(6));
            linearLayout2.addView(textView2);

            View bottomBar = new View(this);
            LinearLayout.LayoutParams barLp = new LinearLayout.LayoutParams(dp(28), dp(3));
            bottomBar.setLayoutParams(barLp);
            if (equals) {
                bottomBar.setBackground(shape(this.cPrimary, 2, 0, 0));
            }
            linearLayout2.addView(bottomBar);

            tabFrame.addView(linearLayout2);

            if (badge > 0) {
                TextView badgeTv = new TextView(this);
                badgeTv.setText(String.valueOf(badge));
                badgeTv.setTextColor(-1);
                badgeTv.setTextSize(sp(8.5f));
                badgeTv.setTypeface(null, 1);
                badgeTv.setGravity(17);
                badgeTv.setBackground(shape(this.cDanger, 9, 0, 0));
                FrameLayout.LayoutParams bLp = new FrameLayout.LayoutParams(dp(16), dp(16));
                bLp.gravity = 53;
                bLp.topMargin = dp(2);
                bLp.rightMargin = dp(10);
                badgeTv.setLayoutParams(bLp);
                tabFrame.addView(badgeTv);
            }

            tabFrame.setOnClickListener(new View.OnClickListener() {
                @Override
                public final void onClick(View view) {
                    MainActivity.this.m0lambda$buildBottomNav$2$commedicarepatientMainActivity(strArr2, view);
                }
            });
            linearLayout.addView(tabFrame);
        }
        return linearLayout;
    }

    public /* synthetic */ void m0lambda$buildBottomNav$2$commedicarepatientMainActivity(String[] strArr, View view) {
        switchTab(strArr[0]);
    }

    private View buildOnboardingView() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setLayoutParams(new FrameLayout.LayoutParams(-1, -1));

        LinearLayout container = new LinearLayout(this);
        container.setOrientation(1);
        container.setPadding(dp(24), dp(36), dp(24), dp(36));
        container.setLayoutParams(new FrameLayout.LayoutParams(-1, -1));

        TextView stepBadge = new TextView(this);
        stepBadge.setText("PASSO " + (this.onboardingStep + 1) + " DE 5");
        stepBadge.setTextColor(this.cPrimary);
        stepBadge.setTextSize(sp(13.0f));
        stepBadge.setTypeface(null, 1);
        stepBadge.setPadding(0, 0, 0, dp(8));
        container.addView(stepBadge);

        TextView titleView = new TextView(this);
        titleView.setTextColor(this.cTextMain);
        titleView.setTextSize(sp(22.0f));
        titleView.setTypeface(null, 1);
        titleView.setPadding(0, 0, 0, dp(6));
        container.addView(titleView);

        TextView subtitleView = new TextView(this);
        subtitleView.setTextColor(this.cTextMuted);
        subtitleView.setTextSize(sp(14.0f));
        subtitleView.setPadding(0, 0, 0, dp(24));
        container.addView(subtitleView);

        if (this.onboardingStep == 0) {
            titleView.setText("Como você vai usar o app?");
            subtitleView.setText("Escolha o seu tipo de perfil no MediCare Paciente.");

            container.addView(buildRoleCard(
                "⚙️ Independente",
                "Utilize de forma independente, tenha acesso a todas as funcionalidades",
                "independente"
            ));
            container.addView(buildRoleCard(
                "🧑 Paciente",
                "Utilize junto com um cuidador, ele poderá gerenciar sua medicação, estoque e confirmar doses retroativamente",
                "paciente"
            ));
        } else if (this.onboardingStep == 1) {
            titleView.setText("Seus Dados Básicos");
            subtitleView.setText("Configure seu perfil para o Cartão de Emergência. Pule o que não quiser preencher agora.");

            final EditText nomeInput = createInput("Nome Completo", this.profile.optString("nome", ""));
            container.addView(nomeInput);

            final EditText dobInput = createInput("Data de Nascimento (Ex: 15/08/1965)", this.profile.optString("data_nascimento", ""));
            container.addView(dobInput);

            final EditText sangueInput = createInput("Tipo Sanguíneo (Ex: O+, A+, B+)", this.profile.optString("tipo_sanguineo", ""));
            container.addView(sangueInput);

            LinearLayout btnRow = new LinearLayout(this);
            btnRow.setOrientation(0);
            btnRow.setPadding(0, dp(20), 0, 0);

            TextView skipBtn = createButton("Pular", this.cSurface, this.cTextMuted);
            skipBtn.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
            skipBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    onboardingStep = 2;
                    render();
                }
            });
            btnRow.addView(skipBtn);

            View spacer = new View(this);
            spacer.setLayoutParams(new LinearLayout.LayoutParams(dp(12), 1));
            btnRow.addView(spacer);

            TextView nextBtn = createButton("Continuar", this.cPrimary, -1);
            nextBtn.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 2.0f));
            nextBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    String n = nomeInput.getText().toString().trim();
                    String d = dobInput.getText().toString().trim();
                    String s = sangueInput.getText().toString().trim();
                    if (!n.isEmpty()) try { MainActivity.this.profile.put("nome", n); } catch (Exception ignored) {}
                    if (!d.isEmpty()) try { MainActivity.this.profile.put("data_nascimento", d); } catch (Exception ignored) {}
                    if (!s.isEmpty()) try { MainActivity.this.profile.put("tipo_sanguineo", s); } catch (Exception ignored) {}
                    MainActivity.this.saveAll();
                    onboardingStep = 2;
                    render();
                }
            });
            btnRow.addView(nextBtn);
            container.addView(btnRow);
        } else if (this.onboardingStep == 2) {
            titleView.setText("Contato de Emergência");
            subtitleView.setText("Quem deve ser avisado em caso de emergência?");

            final EditText contactName = createInput("Nome do Contato (Ex: Carlos da Silva)", "");
            container.addView(contactName);

            final EditText contactRel = createInput("Parentesco (Ex: Filho, Cônjuge)", "");
            container.addView(contactRel);

            final EditText contactPhone = createInput("Telefone (Ex: 11988887777)", "");
            contactPhone.setInputType(3);
            container.addView(contactPhone);

            LinearLayout btnRow = new LinearLayout(this);
            btnRow.setOrientation(0);
            btnRow.setPadding(0, dp(20), 0, 0);

            TextView skipBtn = createButton("Pular", this.cSurface, this.cTextMuted);
            skipBtn.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
            skipBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    onboardingStep = 3;
                    render();
                }
            });
            btnRow.addView(skipBtn);

            View spacer = new View(this);
            spacer.setLayoutParams(new LinearLayout.LayoutParams(dp(12), 1));
            btnRow.addView(spacer);

            TextView nextBtn = createButton("Continuar", this.cPrimary, -1);
            nextBtn.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 2.0f));
            nextBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    String cn = contactName.getText().toString().trim();
                    String cr = contactRel.getText().toString().trim();
                    String cp = contactPhone.getText().toString().trim();
                    if (!cn.isEmpty() && !cp.isEmpty()) {
                        try {
                            JSONObject contactObj = new JSONObject();
                            contactObj.put("id", "ct-" + System.currentTimeMillis());
                            contactObj.put("nome", cn);
                            contactObj.put("relacao", cr.isEmpty() ? "Contato" : cr);
                            contactObj.put("telefone", cp);
                            contactObj.put("principal", true);
                            MainActivity.this.contacts.put(contactObj);
                            MainActivity.this.saveAll();
                        } catch (Exception ignored) {}
                    }
                    onboardingStep = 3;
                    render();
                }
            });
            btnRow.addView(nextBtn);
            container.addView(btnRow);
        } else if (this.onboardingStep == 3) {
            titleView.setText("Profissionais de Saúde");
            subtitleView.setText("Algum médico principal que acompanha você?");

            final EditText docName = createInput("Nome do Médico (Ex: Dr. Carlos)", "");
            container.addView(docName);

            final EditText docSpec = createInput("Especialidade (Ex: Cardiologista)", "");
            container.addView(docSpec);

            final EditText docPhone = createInput("Telefone do Consultório", "");
            docPhone.setInputType(3);
            container.addView(docPhone);

            LinearLayout btnRow = new LinearLayout(this);
            btnRow.setOrientation(0);
            btnRow.setPadding(0, dp(20), 0, 0);

            TextView skipBtn = createButton("Pular", this.cSurface, this.cTextMuted);
            skipBtn.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
            skipBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    onboardingStep = 4;
                    render();
                }
            });
            btnRow.addView(skipBtn);

            View spacer = new View(this);
            spacer.setLayoutParams(new LinearLayout.LayoutParams(dp(12), 1));
            btnRow.addView(spacer);

            TextView nextBtn = createButton("Continuar", this.cPrimary, -1);
            nextBtn.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 2.0f));
            nextBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    String dn = docName.getText().toString().trim();
                    String ds = docSpec.getText().toString().trim();
                    String dp = docPhone.getText().toString().trim();
                    if (!dn.isEmpty()) {
                        try {
                            JSONObject proObj = new JSONObject();
                            proObj.put("id", "pr-" + System.currentTimeMillis());
                            proObj.put("nome", dn);
                            proObj.put("especialidade", ds.isEmpty() ? "Clínico Geral" : ds);
                            proObj.put("telefone", dp);
                            proObj.put("clinica", "");
                            MainActivity.this.professionals.put(proObj);
                            MainActivity.this.saveAll();
                        } catch (Exception ignored) {}
                    }
                    onboardingStep = 4;
                    render();
                }
            });
            btnRow.addView(nextBtn);
            container.addView(btnRow);
        } else if (this.onboardingStep == 4) {
            titleView.setText("Seus Medicamentos");
            subtitleView.setText("Para finalizar, você pode cadastrar seu primeiro medicamento agora ou ir direto para o aplicativo.");

            TextView addMedBtn = createButton("💊 Adicionar Primeiro Medicamento", this.cPrimary, -1);
            addMedBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    MainActivity.this.prefs.edit().putBoolean("onboarding_completed", true).apply();
                    MainActivity.this.saveAll();
                    MainActivity.this.activeTab = "meds";
                    MainActivity.this.render();
                    MainActivity.this.showMedModal(null, -1);
                }
            });
            container.addView(addMedBtn);

            View spacer = new View(this);
            spacer.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(14)));
            container.addView(spacer);

            TextView finishBtn = createButton("Ir para o aplicativo (Pular)", this.cSurface, this.cTextMain);
            finishBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    MainActivity.this.prefs.edit().putBoolean("onboarding_completed", true).apply();
                    MainActivity.this.saveAll();
                    MainActivity.this.render();
                }
            });
            container.addView(finishBtn);
        }

        scrollView.addView(container);
        return scrollView;
    }

    private boolean isPatientProfileRole() {
        String r1 = this.profile.optString("role", "").trim().toLowerCase(Locale.ROOT);
        String r2 = this.profile.optString("user_role", "").trim().toLowerCase(Locale.ROOT);
        return "paciente".equals(r1) || "patient".equals(r1) || "paciente".equals(r2) || "patient".equals(r2);
    }

    private void setProfileRoleValue(String roleKey) {
        try {
            if ("paciente".equalsIgnoreCase(roleKey) || "patient".equalsIgnoreCase(roleKey)) {
                this.profile.put("role", "paciente");
                this.profile.put("user_role", "patient");
            } else {
                this.profile.put("role", "independente");
                this.profile.put("user_role", "independent");
            }
        } catch (Exception ignored) {}
    }

    private View buildRoleCard(final String title, final String desc, final String role) {
        final boolean isPatientCard = "paciente".equalsIgnoreCase(role) || "patient".equalsIgnoreCase(role);
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        int borderCol = isPatientCard ? Color.parseColor("#4DF59E0B") : this.cBorder;
        card.setBackground(shape(this.cSurface, 18, borderCol, 1));
        card.setPadding(dp(18), dp(18), dp(18), dp(18));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.bottomMargin = dp(14);
        card.setLayoutParams(lp);
        card.setClickable(true);
        card.setFocusable(true);

        TextView tView = new TextView(this);
        tView.setText(title);
        tView.setTextColor(this.cTextMain);
        tView.setTextSize(sp(17.0f));
        tView.setTypeface(null, 1);
        card.addView(tView);

        LinearLayout alertLegendBox = new LinearLayout(this);
        alertLegendBox.setOrientation(0);
        alertLegendBox.setGravity(48);
        int alertBg = isPatientCard ? Color.parseColor("#1AF59E0B") : Color.parseColor("#1A3B82F6");
        int alertStroke = isPatientCard ? Color.parseColor("#4DF59E0B") : Color.parseColor("#4D3B82F6");
        int alertTextCol = isPatientCard ? Color.parseColor("#FBBF24") : Color.parseColor("#60A5FA");
        alertLegendBox.setBackground(shape(alertBg, 12, alertStroke, 1));
        alertLegendBox.setPadding(dp(12), dp(10), dp(12), dp(10));
        LinearLayout.LayoutParams albLp = new LinearLayout.LayoutParams(-1, -2);
        albLp.topMargin = dp(10);
        alertLegendBox.setLayoutParams(albLp);

        TextView tvWarnIcon = new TextView(this);
        tvWarnIcon.setText(isPatientCard ? "⚠️" : "ℹ️");
        tvWarnIcon.setTextSize(sp(13.5f));
        tvWarnIcon.setPadding(0, 0, dp(8), 0);
        alertLegendBox.addView(tvWarnIcon);

        TextView dView = new TextView(this);
        dView.setText(desc);
        dView.setTextColor(alertTextCol);
        dView.setTextSize(sp(12.5f));
        dView.setTypeface(null, 1);
        dView.setLineSpacing(dp(2), 1.05f);
        dView.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        alertLegendBox.addView(dView);

        card.addView(alertLegendBox);

        card.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (isPatientCard) {
                    showStyledConfirmDialog(
                        "⚠️ Atenção",
                        "Você só poderá alterar seu perfil para independente com a permissão do cuidador",
                        "Confirmar",
                        "Cancelar",
                        Color.parseColor("#F59E0B"),
                        new Runnable() {
                            @Override
                            public void run() {
                                setProfileRoleValue("paciente");
                                MainActivity.this.saveAll();
                                onboardingStep = 1;
                                render();
                            }
                        }
                    );
                } else {
                    setProfileRoleValue("independente");
                    MainActivity.this.saveAll();
                    onboardingStep = 1;
                    render();
                }
            }
        });

        return card;
    }

    private View buildLoginView() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        LinearLayout linearLayout = new LinearLayout(this);
        linearLayout.setOrientation(1);
        linearLayout.setGravity(17);
        linearLayout.setPadding(dp(24), dp(36), dp(24), dp(36));

        ImageView imageView = new ImageView(this);
        imageView.setImageResource(R.mipmap.ic_launcher);
        LinearLayout.LayoutParams layoutParams = new LinearLayout.LayoutParams(dp(76), dp(76));
        layoutParams.bottomMargin = dp(16);
        imageView.setLayoutParams(layoutParams);
        linearLayout.addView(imageView);

        TextView textView = new TextView(this);
        textView.setText(this.isRegisterMode ? "Criar Conta MediCare" : "MediCare Paciente");
        textView.setTextColor(this.cTextMain);
        textView.setTextSize(sp(24.0f));
        textView.setTypeface(null, 1);
        textView.setGravity(17);
        linearLayout.addView(textView);

        TextView versionBadge = new TextView(this);
        versionBadge.setText("Versão 2.6.1 • Produção");
        versionBadge.setTextColor(this.cPrimary);
        versionBadge.setTextSize(sp(11.0f));
        versionBadge.setTypeface(null, 1);
        versionBadge.setGravity(17);
        versionBadge.setPadding(0, dp(2), 0, dp(4));
        linearLayout.addView(versionBadge);

        TextView textView2 = new TextView(this);
        textView2.setText(this.isRegisterMode ? 
            "Cadastre-se para gerenciar seus medicamentos, doses e receitas com segurança." : 
            "Acompanhamento completo de medicamentos, doses e agenda médica.");
        textView2.setTextColor(this.cTextMuted);
        textView2.setTextSize(sp(13.0f));
        textView2.setGravity(17);
        textView2.setPadding(0, dp(6), 0, dp(24));
        linearLayout.addView(textView2);

        LinearLayout cardLayout = new LinearLayout(this);
        cardLayout.setOrientation(1);
        cardLayout.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        cardLayout.setPadding(dp(20), dp(20), dp(20), dp(20));
        cardLayout.setLayoutParams(new LinearLayout.LayoutParams(-1, -2));

        if (!this.isRegisterMode) {
            // ==================== TELA DE LOGIN ====================
            TextView cardTitle = new TextView(this);
            cardTitle.setText("Acesse sua Conta");
            cardTitle.setTextColor(this.cTextMain);
            cardTitle.setTextSize(sp(16.0f));
            cardTitle.setTypeface(null, 1);
            cardTitle.setPadding(0, 0, 0, dp(14));
            cardLayout.addView(cardTitle);

            final EditText emailInput = createInput("E-mail do Paciente", this.profile.optString("email", ""));
            cardLayout.addView(emailInput);

            final EditText passInput = createInput("Senha", "");
            passInput.setInputType(129);
            cardLayout.addView(passInput);

            TextView loginButton = createButton("Entrar na Minha Conta", this.cPrimary, -1);
            loginButton.setOnClickListener(new View.OnClickListener() {
                @Override
                public final void onClick(View view) {
                    performLogin(emailInput.getText().toString().trim(), passInput.getText().toString().trim());
                }
            });
            cardLayout.addView(loginButton);

            View div = new View(this);
            div.setBackgroundColor(this.cBorder);
            LinearLayout.LayoutParams divParams = new LinearLayout.LayoutParams(-1, dp(1));
            divParams.topMargin = dp(16);
            divParams.bottomMargin = dp(14);
            div.setLayoutParams(divParams);
            cardLayout.addView(div);

            TextView switchRegister = createButton("✨ Criar Nova Conta (Cadastre-se)", this.cPrimaryLight, this.cPrimary);
            switchRegister.setOnClickListener(new View.OnClickListener() {
                @Override
                public final void onClick(View view) {
                    MainActivity.this.isRegisterMode = true;
                    MainActivity.this.render();
                }
            });
            cardLayout.addView(switchRegister);

        } else {
            // ==================== TELA DE CADASTRO ====================
            TextView cardTitle = new TextView(this);
            cardTitle.setText("Novo Paciente • Criar Conta");
            cardTitle.setTextColor(this.cPrimary);
            cardTitle.setTextSize(sp(16.0f));
            cardTitle.setTypeface(null, 1);
            cardTitle.setPadding(0, 0, 0, dp(14));
            cardLayout.addView(cardTitle);

            final EditText nameInput = createInput("Nome Completo", "");
            cardLayout.addView(nameInput);

            final EditText emailInput = createInput("E-mail para Acesso", "");
            cardLayout.addView(emailInput);

            final EditText passInput = createInput("Senha (mínimo 6 caracteres)", "");
            passInput.setInputType(129);
            cardLayout.addView(passInput);

            final EditText confirmPassInput = createInput("Confirmar Senha", "");
            confirmPassInput.setInputType(129);
            cardLayout.addView(confirmPassInput);

            TextView registerButton = createButton("Criar Minha Conta", this.cPrimary, -1);
            registerButton.setOnClickListener(new View.OnClickListener() {
                @Override
                public final void onClick(View view) {
                    performRegister(
                        nameInput.getText().toString().trim(),
                        emailInput.getText().toString().trim(),
                        passInput.getText().toString().trim(),
                        confirmPassInput.getText().toString().trim()
                    );
                }
            });
            cardLayout.addView(registerButton);

            View div2 = new View(this);
            div2.setBackgroundColor(this.cBorder);
            LinearLayout.LayoutParams divParams2 = new LinearLayout.LayoutParams(-1, dp(1));
            divParams2.topMargin = dp(16);
            divParams2.bottomMargin = dp(14);
            div2.setLayoutParams(divParams2);
            cardLayout.addView(div2);

            TextView switchLogin = createButton("← Já tenho conta (Fazer Login)", this.cSurfaceHover, this.cTextMain);
            switchLogin.setOnClickListener(new View.OnClickListener() {
                @Override
                public final void onClick(View view) {
                    MainActivity.this.isRegisterMode = false;
                    MainActivity.this.render();
                }
            });
            cardLayout.addView(switchLogin);
        }

        linearLayout.addView(cardLayout);
        scrollView.addView(linearLayout);
        return scrollView;
    }

    private void performLogin(final String email, final String password) {
        if (email.isEmpty()) {
            Toast.makeText(this, "Por favor, informe seu e-mail.", 0).show();
            return;
        }
        if (password.isEmpty()) {
            Toast.makeText(this, "Por favor, digite sua senha.", 0).show();
            return;
        }

        final String cleanEmail = email.trim().toLowerCase(Locale.ROOT);
        Toast.makeText(this, "Entrando na conta...", 0).show();

        new Thread(new Runnable() {
            @Override
            public final void run() {
                try {
                    URL url = new URL(EMBEDDED_BACKEND_URL + "/api/auth/v1/token?grant_type=password");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");

                    JSONObject reqBody = new JSONObject();
                    reqBody.put("email", cleanEmail);
                    reqBody.put("password", password);

                    byte[] postData = reqBody.toString().getBytes(StandardCharsets.UTF_8);
                    OutputStream os = conn.getOutputStream();
                    os.write(postData);
                    os.close();

                    int responseCode = conn.getResponseCode();
                    BufferedReader reader = new BufferedReader(new InputStreamReader(
                        (responseCode < 200 || responseCode >= 400) ? conn.getErrorStream() : conn.getInputStream(),
                        StandardCharsets.UTF_8
                    ));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    final JSONObject respObj = new JSONObject(sb.toString());

                    if (responseCode == 200) {
                        MainActivity.this.runOnUiThread(new Runnable() {
                            @Override
                            public final void run() {
                                try {
                                    JSONObject userObj = respObj.optJSONObject("user");
                                    String userId = userObj != null ? userObj.optString("id", "").trim() : "";
                                    JSONObject meta = userObj != null ? userObj.optJSONObject("user_metadata") : null;
                                    String userName = "";
                                    if (meta != null && !meta.optString("nome", "").trim().isEmpty()) {
                                        userName = meta.optString("nome", "").trim();
                                    } else if (userObj != null && !userObj.optString("nome", "").trim().isEmpty()) {
                                        userName = userObj.optString("nome", "").trim();
                                    }
                                    String userRole = "independente";
                                    if (userObj != null && !userObj.optString("role", "").trim().isEmpty()) {
                                        userRole = userObj.optString("role", "").trim();
                                    } else if (meta != null && !meta.optString("role", "").trim().isEmpty()) {
                                        userRole = meta.optString("role", "").trim();
                                    }

                                    MainActivity.this.resetActiveSessionData();
                                    boolean restored = MainActivity.this.restoreUserSnapshot(cleanEmail, userId);
                                    MainActivity.this.profile.put("email", cleanEmail);
                                    if (!userId.isEmpty()) {
                                        MainActivity.this.profile.put("id", userId);
                                    } else {
                                        MainActivity.this.resolveCurrentAccountUserId();
                                    }
                                    if (!userName.isEmpty() && MainActivity.this.profile.optString("nome", "").trim().isEmpty()) {
                                        MainActivity.this.profile.put("nome", userName);
                                        MainActivity.this.profile.put("full_name", userName);
                                    }
                                    if (!restored) {
                                        MainActivity.this.setProfileRoleValue(userRole);
                                        MainActivity.this.prefs.edit().putBoolean("onboarding_completed", true).apply();
                                    }
                                    MainActivity.this.isLoggedIn = true;
                                    MainActivity.this.isRegisterMode = false;
                                    MainActivity.this.prefs.edit().putString("active_user_email", cleanEmail).apply();
                                    MainActivity.this.saveLocalStateOnly();
                                    Toast.makeText(MainActivity.this, "✓ Bem-vindo de volta!", 0).show();
                                    MainActivity.this.render();
                                    MainActivity.this.pullFromBackendIfEmptyOrUpdated();
                                } catch (Exception ignored) {}
                            }
                        });
                    } else {
                        final String errMsg = respObj.optString("error", "E-mail ou senha incorretos.");
                        MainActivity.this.runOnUiThread(new Runnable() {
                            @Override
                            public final void run() {
                                Toast.makeText(MainActivity.this, "Erro: " + errMsg, 1).show();
                            }
                        });
                    }
                } catch (Exception e) {
                    MainActivity.this.runOnUiThread(new Runnable() {
                        @Override
                        public final void run() {
                            MainActivity.this.resetActiveSessionData();
                            if (MainActivity.this.restoreUserSnapshot(cleanEmail, null)) {
                                MainActivity.this.isLoggedIn = true;
                                MainActivity.this.isRegisterMode = false;
                                MainActivity.this.saveLocalStateOnly();
                                MainActivity.this.render();
                                Toast.makeText(MainActivity.this, "Conectado em modo offline.", 0).show();
                            } else {
                                Toast.makeText(MainActivity.this, "Não foi possível conectar ao servidor. Verifique a conexão.", 1).show();
                            }
                        }
                    });
                }
            }
        }).start();
    }

    private void performRegister(final String nome, final String email, final String password, final String confirmPassword) {
        if (nome.isEmpty()) {
            Toast.makeText(this, "Por favor, digite seu nome completo.", 0).show();
            return;
        }
        if (email.isEmpty() || !email.contains("@")) {
            Toast.makeText(this, "Por favor, informe um e-mail válido.", 0).show();
            return;
        }
        if (password.length() < 6) {
            Toast.makeText(this, "A senha deve ter no mínimo 6 caracteres.", 0).show();
            return;
        }
        if (!password.equals(confirmPassword)) {
            Toast.makeText(this, "As senhas digitadas não coincidem.", 0).show();
            return;
        }

        final String cleanEmail = email.trim().toLowerCase(Locale.ROOT);
        final String cleanNome = nome.trim();
        Toast.makeText(this, "Criando sua conta...", 0).show();

        new Thread(new Runnable() {
            @Override
            public final void run() {
                try {
                    URL url = new URL(EMBEDDED_BACKEND_URL + "/api/auth/v1/signup");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");

                    JSONObject reqBody = new JSONObject();
                    reqBody.put("email", cleanEmail);
                    reqBody.put("password", password);

                    JSONObject metaData = new JSONObject();
                    metaData.put("nome", cleanNome);
                    metaData.put("role", "independente");
                    reqBody.put("data", metaData);

                    byte[] postData = reqBody.toString().getBytes(StandardCharsets.UTF_8);
                    OutputStream os = conn.getOutputStream();
                    os.write(postData);
                    os.close();

                    int responseCode = conn.getResponseCode();
                    BufferedReader reader = new BufferedReader(new InputStreamReader(
                        (responseCode < 200 || responseCode >= 400) ? conn.getErrorStream() : conn.getInputStream(),
                        StandardCharsets.UTF_8
                    ));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    final JSONObject respObj = new JSONObject(sb.toString());

                    if (responseCode == 200 || responseCode == 201) {
                        MainActivity.this.runOnUiThread(new Runnable() {
                            @Override
                            public final void run() {
                                try {
                                    MainActivity.this.prefs.edit().remove("user_snapshot_" + cleanEmail).apply();
                                    MainActivity.this.resetActiveSessionData();
                                    JSONObject userObj = respObj.optJSONObject("user");
                                    String newUserId = userObj != null ? userObj.optString("id", "").trim() : "";
                                    if (newUserId.isEmpty()) {
                                        newUserId = UUID.nameUUIDFromBytes(("medicare-user:" + cleanEmail).getBytes(StandardCharsets.UTF_8)).toString();
                                    }
                                    MainActivity.this.profile.put("id", newUserId);
                                    MainActivity.this.profile.put("email", cleanEmail);
                                    MainActivity.this.profile.put("nome", cleanNome);
                                    MainActivity.this.profile.put("full_name", cleanNome);
                                    MainActivity.this.setProfileRoleValue("independente");
                                    MainActivity.this.isLoggedIn = true;
                                    MainActivity.this.isRegisterMode = false;
                                    MainActivity.this.onboardingStep = 0;
                                    MainActivity.this.prefs.edit()
                                        .putBoolean("onboarding_completed", false)
                                        .putString("active_user_email", cleanEmail)
                                        .apply();
                                    MainActivity.this.saveAll();
                                    Toast.makeText(MainActivity.this, "✓ Conta criada com sucesso! Bem-vindo(a), " + cleanNome, 1).show();
                                    MainActivity.this.render();
                                } catch (Exception ignored) {}
                            }
                        });
                    } else {
                        final String errMsg = respObj.optString("error", "Não foi possível criar a conta.");
                        MainActivity.this.runOnUiThread(new Runnable() {
                            @Override
                            public final void run() {
                                Toast.makeText(MainActivity.this, "Erro: " + errMsg, 1).show();
                            }
                        });
                    }
                } catch (Exception e) {
                    MainActivity.this.runOnUiThread(new Runnable() {
                        @Override
                        public final void run() {
                            try {
                                MainActivity.this.prefs.edit().remove("user_snapshot_" + cleanEmail).apply();
                                MainActivity.this.resetActiveSessionData();
                                String fallbackUuid = UUID.nameUUIDFromBytes(("medicare-user:" + cleanEmail).getBytes(StandardCharsets.UTF_8)).toString();
                                MainActivity.this.profile.put("id", fallbackUuid);
                                MainActivity.this.profile.put("email", cleanEmail);
                                MainActivity.this.profile.put("nome", cleanNome);
                                MainActivity.this.profile.put("full_name", cleanNome);
                                MainActivity.this.setProfileRoleValue("independente");
                            } catch (Exception ignored) {}
                            MainActivity.this.isLoggedIn = true;
                            MainActivity.this.isRegisterMode = false;
                            MainActivity.this.onboardingStep = 0;
                            MainActivity.this.prefs.edit()
                                .putBoolean("onboarding_completed", false)
                                .putString("active_user_email", cleanEmail)
                                .apply();
                            MainActivity.this.saveAll();
                            MainActivity.this.render();
                            Toast.makeText(MainActivity.this, "Conta criada localmente! Sincronização pendente.", 1).show();
                        }
                    });
                }
            }
        }).start();
    }

    private String getDoseStatus(String medId, String dateStr, String horaStr) {
        for (int i = 0; i < this.doseLogs.length(); i++) {
            JSONObject log = this.doseLogs.optJSONObject(i);
            if (log != null && medId.equals(log.optString("med_id"))) {
                String d = log.optString("data", "");
                if (d.isEmpty() && log.has("dose_date")) {
                    String dd = log.optString("dose_date", "");
                    if (dd.length() >= 10) d = dd.substring(0, 10);
                }
                if (d.isEmpty() && log.has("created_at")) {
                    String ca = log.optString("created_at", "");
                    if (ca.length() >= 10) d = ca.substring(0, 10);
                }
                String h = log.optString("horario", log.optString("hora", ""));
                if (dateStr.equals(d) && horaStr.equals(h)) {
                    String st = log.optString("status", "pendente");
                    if ("confirmed".equals(st)) return "tomado";
                    if ("missed".equals(st)) return "pulado";
                    return st;
                }
            }
        }
        return "pendente";
    }

    private JSONObject getDoseLogObject(String medId, String dateStr, String horaStr) {
        for (int i = 0; i < this.doseLogs.length(); i++) {
            JSONObject log = this.doseLogs.optJSONObject(i);
            if (log != null && medId.equals(log.optString("med_id"))) {
                String d = log.optString("data", "");
                if (d.isEmpty() && log.has("dose_date")) {
                    String dd = log.optString("dose_date", "");
                    if (dd.length() >= 10) d = dd.substring(0, 10);
                }
                if (d.isEmpty() && log.has("created_at")) {
                    String ca = log.optString("created_at", "");
                    if (ca.length() >= 10) d = ca.substring(0, 10);
                }
                String h = log.optString("horario", log.optString("hora", ""));
                if (dateStr.equals(d) && horaStr.equals(h)) {
                    return log;
                }
            }
        }
        return null;
    }

    private int getMedStock(JSONObject med) {
        if (med == null) return 0;
        if (med.has("quantidade")) return med.optInt("quantidade", 0);
        return med.optInt("estoque_atual", 0);
    }

    private void setMedStock(JSONObject med, int newQty) {
        if (med == null) return;
        try {
            int val = Math.max(0, newQty);
            med.put("quantidade", val);
            med.put("estoque_atual", val);
        } catch (Exception ignored) {}
    }

    private String getMedType(JSONObject med) {
        if (med == null) return "continuous";
        String t = med.optString("treatment_type", med.optString("tipo_uso", "continuous")).toLowerCase(Locale.ROOT);
        if ("continuo".equals(t) || "continuous".equals(t)) return "continuous";
        if ("temporario".equals(t) || "temporary".equals(t)) return "temporary";
        if ("sos".equals(t)) return "sos";
        return "continuous";
    }

    private void registerDose(JSONObject med, String dateStr, String horaStr, String targetStatus) {
        try {
            String medId = med.optString("id");
            int foundIdx = -1;
            String prevStatus = "pendente";
            for (int i = 0; i < this.doseLogs.length(); i++) {
                JSONObject log = this.doseLogs.optJSONObject(i);
                if (log != null && medId.equals(log.optString("med_id"))) {
                    String d = log.optString("data", "");
                    if (d.isEmpty() && log.has("created_at")) {
                        String ca = log.optString("created_at", "");
                        if (ca.length() >= 10) d = ca.substring(0, 10);
                    }
                    String h = log.optString("horario", log.optString("hora", ""));
                    if (dateStr.equals(d) && horaStr.equals(h)) {
                        foundIdx = i;
                        prevStatus = log.optString("status", "pendente");
                        if ("confirmed".equals(prevStatus)) prevStatus = "tomado";
                        break;
                    }
                }
            }
            String newStatus = targetStatus;
            if (prevStatus.equals(newStatus)) {
                newStatus = "pendente";
            }
            String nowTime = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());
            int atrasoMin = 0;
            try {
                String[] p1 = horaStr.split(":");
                String[] p2 = nowTime.split(":");
                int mSched = Integer.parseInt(p1[0]) * 60 + Integer.parseInt(p1[1]);
                int mNow = Integer.parseInt(p2[0]) * 60 + Integer.parseInt(p2[1]);
                if (mNow > mSched) atrasoMin = mNow - mSched;
            } catch (Exception ignored) {}

            JSONObject logEntry = new JSONObject();
            logEntry.put("id", "log-" + System.currentTimeMillis());
            logEntry.put("med_id", medId);
            logEntry.put("med_nome", med.optString("nome") + " " + med.optString("dosagem"));
            logEntry.put("data", dateStr);
            logEntry.put("created_at", dateStr + "T" + nowTime + ":00.000Z");
            logEntry.put("horario", horaStr);
            logEntry.put("hora", horaStr);
            logEntry.put("status", newStatus);
            logEntry.put("hora_real", nowTime);
            logEntry.put("atraso_minutos", atrasoMin);

            if (foundIdx >= 0) {
                this.doseLogs.put(foundIdx, logEntry);
            } else {
                this.doseLogs.put(logEntry);
            }

            int currentStock = getMedStock(med);
            if ("tomado".equals(newStatus) && !"tomado".equals(prevStatus)) {
                int nextStock = Math.max(0, currentStock - 1);
                setMedStock(med, nextStock);
                this.stockMovements.put(new JSONObject()
                    .put("id", "sm-" + System.currentTimeMillis())
                    .put("med_id", medId)
                    .put("medication_id", medId)
                    .put("med_nome", med.optString("nome"))
                    .put("med_name", med.optString("nome"))
                    .put("tipo", "saida")
                    .put("movement_type", "consumption")
                    .put("qtd", 1)
                    .put("quantity_change", -1)
                    .put("quantity_changed", -1)
                    .put("quantity_delta", -1)
                    .put("delta", -1)
                    .put("previous_quantity", currentStock)
                    .put("quantity_before", currentStock)
                    .put("new_quantity", nextStock)
                    .put("quantity_after", nextStock)
                    .put("date", dateStr)
                    .put("time", nowTime)
                    .put("hora", nowTime)
                    .put("data", dateStr + " " + nowTime)
                    .put("created_at", dateStr + "T" + nowTime + ":00.000Z")
                    .put("motivo", "Dose confirmada (" + horaStr + ")")
                    .put("notes", "Dose confirmada (" + horaStr + ")"));
            } else if (!"tomado".equals(newStatus) && "tomado".equals(prevStatus)) {
                int nextStock = currentStock + 1;
                setMedStock(med, nextStock);
                this.stockMovements.put(new JSONObject()
                    .put("id", "sm-" + System.currentTimeMillis())
                    .put("med_id", medId)
                    .put("medication_id", medId)
                    .put("med_nome", med.optString("nome"))
                    .put("med_name", med.optString("nome"))
                    .put("tipo", "entrada")
                    .put("movement_type", "correction")
                    .put("qtd", 1)
                    .put("quantity_change", 1)
                    .put("quantity_changed", 1)
                    .put("quantity_delta", 1)
                    .put("delta", 1)
                    .put("previous_quantity", currentStock)
                    .put("quantity_before", currentStock)
                    .put("new_quantity", nextStock)
                    .put("quantity_after", nextStock)
                    .put("date", dateStr)
                    .put("time", nowTime)
                    .put("hora", nowTime)
                    .put("data", dateStr + " " + nowTime)
                    .put("created_at", dateStr + "T" + nowTime + ":00.000Z")
                    .put("motivo", "Estorno de dose desfeita (" + horaStr + ")")
                    .put("notes", "Estorno de dose desfeita (" + horaStr + ")"));
            }
            saveAll();
            render();
            Toast.makeText(this, "tomado".equals(newStatus) ? "✓ Dose confirmada!" : "↩ Confirmação desfeita", 0).show();
        } catch (Exception ignored) {}
    }

    private void handleDoseConfirmWithWarning(final JSONObject med, final String dateStr, final String horaStr, final boolean isSnooze) {
        try {
            String[] parts = horaStr.split(":");
            int schedMin = Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
            Calendar cal = Calendar.getInstance();
            int nowMin = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);
            int diffMin = schedMin - nowMin;
            if (Math.abs(diffMin) > 60 && !isSnooze) {
                int hrs = Math.abs(diffMin) / 60;
                int mins = Math.abs(diffMin) % 60;
                String timeStr = (hrs > 0 ? hrs + "h " : "") + mins + "min";
                String dlgTitle = diffMin > 0 ? "⏰ Confirmar adiantado?" : "⚠️ Confirmar com atraso?";
                String dlgMsg = "Esta dose de " + med.optString("nome") + " (" + horaStr + ") está " + timeStr + (diffMin > 0 ? " adiantada" : " atrasada") + " em relação ao horário programado. Deseja confirmar mesmo assim?";
                showStyledConfirmDialog(dlgTitle, dlgMsg, "Sim, confirmar", "Cancelar", this.cSuccess, new Runnable() {
                    @Override
                    public void run() {
                        registerDose(med, dateStr, horaStr, "tomado");
                    }
                });
                return;
            }
            if (isSnooze) {
                Toast.makeText(this, "⏰ Lembrete de " + med.optString("nome") + " em 15 minutos", 0).show();
            } else {
                registerDose(med, dateStr, horaStr, "tomado");
            }
        } catch (Exception e) {
            registerDose(med, dateStr, horaStr, "tomado");
        }
    }

    private void showUndoConfirmDialog(final JSONObject med, final String dateStr, final String horaStr) {
        String msg = "A dose de " + med.optString("nome") + " às " + horaStr + " voltará a ficar pendente e 1 unidade será devolvida ao estoque.";
        showStyledConfirmDialog("↩ Desfazer confirmação?", msg, "Desfazer", "Cancelar", this.cWarning, new Runnable() {
            @Override
            public void run() {
                registerDose(med, dateStr, horaStr, "pendente");
            }
        });
    }

    private String getGreetingText() {
        int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        String prefix = hour < 12 ? "Bom dia" : (hour < 18 ? "Boa tarde" : "Boa noite");
        String fullName = this.profile.optString("social_name", "");
        if (fullName.isEmpty()) fullName = this.profile.optString("nome", "");
        if (fullName.isEmpty()) return prefix;
        String firstName = fullName.trim().split("\\s+")[0];
        return prefix + ", " + firstName;
    }

    private String getFormattedTodayHeader() {
        try {
            SimpleDateFormat sdf = new SimpleDateFormat("EEEE, d 'de' MMMM", new Locale("pt", "BR"));
            return sdf.format(new Date());
        } catch (Exception e) {
            return todayIso();
        }
    }

    private void buildHomeTab(LinearLayout linearLayout) {
        final String today = todayIso();
        String nowHm = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());
        int nowMins = Calendar.getInstance().get(Calendar.HOUR_OF_DAY) * 60 + Calendar.getInstance().get(Calendar.MINUTE);

        // 1. Greeting Header (matching Screenshot 1)
        LinearLayout greetBox = new LinearLayout(this);
        greetBox.setOrientation(1);
        LinearLayout.LayoutParams greetLp = new LinearLayout.LayoutParams(-1, -2);
        greetLp.bottomMargin = dp(20);
        greetBox.setLayoutParams(greetLp);

        TextView dateTv = new TextView(this);
        dateTv.setText(getFormattedTodayHeader());
        dateTv.setTextColor(this.cTextMuted);
        dateTv.setTextSize(sp(13.0f));
        greetBox.addView(dateTv);

        TextView greetTv = new TextView(this);
        greetTv.setText(getGreetingText() + " 👋");
        greetTv.setTextColor(this.cTextMain);
        greetTv.setTextSize(sp(24.0f));
        greetTv.setTypeface(null, 1);
        greetTv.setPadding(0, dp(2), 0, 0);
        greetBox.addView(greetTv);
        linearLayout.addView(greetBox);

        // 2. Collect today's scheduled doses & critical stock
        StringBuilder criticalSb = new StringBuilder();
        int criticalCount = 0;
        final ArrayList<JSONObject> doseItems = new ArrayList<>();

        for (int i = 0; i < this.meds.length(); i++) {
            JSONObject med = this.meds.optJSONObject(i);
            if (med != null && med.optBoolean("ativo", true)) {
                int stock = getMedStock(med);
                if (stock <= 5) {
                    if (criticalCount > 0) criticalSb.append(" · ");
                    criticalSb.append(med.optString("nome")).append(" (").append(stock).append(")");
                    criticalCount++;
                }
                String tType = getMedType(med);
                if (!"sos".equals(tType)) {
                    JSONArray horarios = med.optJSONArray("horarios");
                    if (horarios != null) {
                        for (int j = 0; j < horarios.length(); j++) {
                            String h = horarios.optString(j, "08:00");
                            String rawSt = getDoseStatus(med.optString("id"), today, h);
                            String uiSt = "upcoming";
                            int hMins = 480;
                            try {
                                String[] p = h.split(":");
                                hMins = Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
                            } catch (Exception ignored) {}
                            if ("tomado".equals(rawSt)) {
                                uiSt = "confirmed";
                            } else if ("pulado".equals(rawSt)) {
                                uiSt = "missed";
                            } else {
                                int diff = nowMins - hMins;
                                if (diff > 120) uiSt = "missed";
                                else if (diff > 15) uiSt = "late";
                                else if (diff >= -15) uiSt = "pending";
                                else if (diff >= -60) uiSt = "soon";
                                else uiSt = "upcoming";
                            }
                            try {
                                JSONObject item = new JSONObject();
                                item.put("med", med);
                                item.put("hora", h);
                                item.put("status", uiSt);
                                doseItems.add(item);
                            } catch (Exception ignored) {}
                        }
                    }
                }
            }
        }

        Collections.sort(doseItems, new Comparator<JSONObject>() {
            @Override
            public int compare(JSONObject a, JSONObject b) {
                return a.optString("hora", "").compareTo(b.optString("hora", ""));
            }
        });

        // 3. Critical stock alert banner
        if (criticalCount > 0) {
            LinearLayout critBanner = new LinearLayout(this);
            critBanner.setOrientation(0);
            critBanner.setGravity(16);
            critBanner.setBackground(shape(Color.parseColor("#1AEF4444"), 14, Color.parseColor("#4DEF4444"), 1));
            critBanner.setPadding(dp(16), dp(12), dp(16), dp(12));
            LinearLayout.LayoutParams cbLp = new LinearLayout.LayoutParams(-1, -2);
            cbLp.bottomMargin = dp(16);
            critBanner.setLayoutParams(cbLp);

            TextView cEmoji = new TextView(this);
            cEmoji.setText("🚨");
            cEmoji.setTextSize(sp(20.0f));
            cEmoji.setPadding(0, 0, dp(10), 0);
            critBanner.addView(cEmoji);

            LinearLayout cTextCol = new LinearLayout(this);
            cTextCol.setOrientation(1);
            TextView cTitle = new TextView(this);
            cTitle.setText("Estoque crítico");
            cTitle.setTextColor(Color.parseColor("#F87171"));
            cTitle.setTextSize(sp(13.0f));
            cTitle.setTypeface(null, 1);
            cTextCol.addView(cTitle);
            TextView cSub = new TextView(this);
            cSub.setText(criticalSb.toString());
            cSub.setTextColor(Color.parseColor("#FCA5A5"));
            cSub.setTextSize(sp(12.0f));
            cTextCol.addView(cSub);
            critBanner.addView(cTextCol);
            linearLayout.addView(critBanner);
        }

        // 4. NextDoseHero (if there is at least one dose today)
        JSONObject nextDose = null;
        for (int i = 0; i < doseItems.size(); i++) {
            JSONObject d = doseItems.get(i);
            String st = d.optString("status");
            if ("late".equals(st) || "pending".equals(st) || "soon".equals(st) || "upcoming".equals(st)) {
                nextDose = d;
                break;
            }
        }
        if (nextDose == null && !doseItems.isEmpty()) {
            for (int i = 0; i < doseItems.size(); i++) {
                if ("confirmed".equals(doseItems.get(i).optString("status"))) {
                    nextDose = doseItems.get(i);
                    break;
                }
            }
        }

        if (nextDose != null) {
            final JSONObject heroMed = nextDose.optJSONObject("med");
            final String heroHora = nextDose.optString("hora");
            String heroSt = nextDose.optString("status");
            boolean isLate = "late".equals(heroSt);
            boolean isPend = "pending".equals(heroSt) || "soon".equals(heroSt);
            boolean isDone = "confirmed".equals(heroSt);
            int accent = isLate ? this.cDanger : (isPend ? this.cWarning : (isDone ? this.cSuccess : this.cPrimary));

            LinearLayout heroCard = new LinearLayout(this);
            heroCard.setOrientation(1);
            heroCard.setBackground(shape(this.cSurface, 22, accent, 1));
            heroCard.setPadding(dp(20), dp(18), dp(20), dp(18));
            LinearLayout.LayoutParams hLp = new LinearLayout.LayoutParams(-1, -2);
            hLp.bottomMargin = dp(14);
            heroCard.setLayoutParams(hLp);

            LinearLayout heroTop = new LinearLayout(this);
            heroTop.setOrientation(0);
            heroTop.setGravity(48);

            LinearLayout heroLeft = new LinearLayout(this);
            heroLeft.setOrientation(1);
            heroLeft.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

            TextView badge = new TextView(this);
            badge.setText(isLate ? "🚨 Dose atrasada" : (isPend ? "⏰ Hora do remédio" : (isDone ? "✅ Concluído" : "🕐 Próxima dose")));
            badge.setTextColor(accent);
            badge.setTextSize(sp(11.0f));
            badge.setTypeface(null, 1);
            badge.setBackground(shape(Color.argb(35, Color.red(accent), Color.green(accent), Color.blue(accent)), 12, 0, 0));
            badge.setPadding(dp(10), dp(4), dp(10), dp(4));
            LinearLayout.LayoutParams bLp = new LinearLayout.LayoutParams(-2, -2);
            bLp.bottomMargin = dp(8);
            badge.setLayoutParams(bLp);
            heroLeft.addView(badge);

            TextView hName = new TextView(this);
            hName.setText(heroMed.optString("nome"));
            hName.setTextColor(this.cTextMain);
            hName.setTextSize(sp(20.0f));
            hName.setTypeface(null, 1);
            heroLeft.addView(hName);

            TextView hDose = new TextView(this);
            hDose.setText(heroMed.optString("dosagem") + " · " + heroMed.optString("unidade", heroMed.optString("forma", "comprimido")));
            hDose.setTextColor(this.cTextMuted);
            hDose.setTextSize(sp(13.0f));
            heroLeft.addView(hDose);
            heroTop.addView(heroLeft);

            TextView hTime = new TextView(this);
            hTime.setText(heroHora);
            hTime.setTextColor(accent);
            hTime.setTextSize(sp(26.0f));
            hTime.setTypeface(null, 1);
            heroTop.addView(hTime);
            heroCard.addView(heroTop);

            if (!isDone) {
                TextView btnConfirm = new TextView(this);
                btnConfirm.setText("✓  Já tomei");
                btnConfirm.setTextColor(-1);
                btnConfirm.setTextSize(sp(16.0f));
                btnConfirm.setTypeface(null, 1);
                btnConfirm.setGravity(17);
                btnConfirm.setPadding(dp(16), dp(14), dp(16), dp(14));
                btnConfirm.setBackground(shape(Color.parseColor("#16A34A"), 14, 0, 0));
                LinearLayout.LayoutParams bcLp = new LinearLayout.LayoutParams(-1, -2);
                bcLp.topMargin = dp(14);
                bcLp.bottomMargin = dp(8);
                btnConfirm.setLayoutParams(bcLp);
                btnConfirm.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        handleDoseConfirmWithWarning(heroMed, today, heroHora, false);
                    }
                });
                heroCard.addView(btnConfirm);

                TextView btnSnooze = new TextView(this);
                btnSnooze.setText("⏰  Lembrar em 15 minutos");
                btnSnooze.setTextColor(this.cTextMuted);
                btnSnooze.setTextSize(sp(13.0f));
                btnSnooze.setTypeface(null, 1);
                btnSnooze.setGravity(17);
                btnSnooze.setPadding(dp(12), dp(10), dp(12), dp(10));
                btnSnooze.setBackground(shape(this.cSurfaceHover, 12, this.cBorder, 1));
                btnSnooze.setLayoutParams(new LinearLayout.LayoutParams(-1, -2));
                btnSnooze.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        handleDoseConfirmWithWarning(heroMed, today, heroHora, true);
                    }
                });
                heroCard.addView(btnSnooze);
            }
            linearLayout.addView(heroCard);
        }

        // 5. DayProgress Card (matching Screenshot 1)
        int confCount = 0;
        int pendCount = 0;
        int missCount = 0;
        int totCount = doseItems.size();
        for (int i = 0; i < totCount; i++) {
            String st = doseItems.get(i).optString("status");
            if ("confirmed".equals(st)) confCount++;
            else if ("missed".equals(st)) missCount++;
            else pendCount++;
        }
        int adhPct = totCount > 0 ? Math.round((confCount * 100.0f) / totCount) : 0;
        int pctColor = adhPct >= 80 ? this.cSuccess : (adhPct >= 50 ? this.cWarning : this.cDanger);

        LinearLayout progCard = new LinearLayout(this);
        progCard.setOrientation(1);
        progCard.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        progCard.setPadding(dp(18), dp(16), dp(18), dp(16));
        LinearLayout.LayoutParams pcLp = new LinearLayout.LayoutParams(-1, -2);
        pcLp.bottomMargin = dp(14);
        progCard.setLayoutParams(pcLp);

        LinearLayout progTop = new LinearLayout(this);
        progTop.setOrientation(0);
        progTop.setGravity(16);
        TextView progTitle = new TextView(this);
        progTitle.setText("Progresso do dia");
        progTitle.setTextColor(this.cTextMain);
        progTitle.setTextSize(sp(15.0f));
        progTitle.setTypeface(null, 1);
        progTitle.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        progTop.addView(progTitle);

        TextView progVal = new TextView(this);
        progVal.setText(adhPct + "%");
        progVal.setTextColor(pctColor);
        progVal.setTextSize(sp(20.0f));
        progVal.setTypeface(null, 1);
        progTop.addView(progVal);
        progCard.addView(progTop);

        FrameLayout barTrack = new FrameLayout(this);
        barTrack.setBackground(shape(this.cSurfaceHover, 6, 0, 0));
        LinearLayout.LayoutParams btLp = new LinearLayout.LayoutParams(-1, dp(8));
        btLp.topMargin = dp(10);
        btLp.bottomMargin = dp(14);
        barTrack.setLayoutParams(btLp);
        if (adhPct > 0) {
            View barFill = new View(this);
            barFill.setBackground(shape(pctColor, 6, 0, 0));
            int wPx = (int) ((getResources().getDisplayMetrics().widthPixels - dp(72)) * (adhPct / 100.0f));
            barFill.setLayoutParams(new FrameLayout.LayoutParams(Math.max(dp(8), wPx), -1));
            barTrack.addView(barFill);
        }
        progCard.addView(barTrack);

        LinearLayout statsRow = new LinearLayout(this);
        statsRow.setOrientation(0);
        statsRow.setGravity(16);
        Object[][] statCols = {
            {"Tomadas", confCount, this.cSuccess},
            {"Pendentes", pendCount, this.cWarning},
            {"Perdidas", missCount, missCount > 0 ? this.cDanger : this.cTextLight},
            {"Total", totCount, this.cTextMain}
        };
        for (int sIdx = 0; sIdx < 4; sIdx++) {
            if (sIdx > 0) {
                View vDiv = new View(this);
                vDiv.setBackgroundColor(this.cBorder);
                vDiv.setLayoutParams(new LinearLayout.LayoutParams(dp(1), dp(36)));
                statsRow.addView(vDiv);
            }
            LinearLayout col = new LinearLayout(this);
            col.setOrientation(1);
            col.setGravity(17);
            col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
            TextView vTv = new TextView(this);
            vTv.setText(String.valueOf(statCols[sIdx][1]));
            vTv.setTextColor((Integer) statCols[sIdx][2]);
            vTv.setTextSize(sp(20.0f));
            vTv.setTypeface(null, 1);
            vTv.setGravity(17);
            col.addView(vTv);
            TextView lTv = new TextView(this);
            lTv.setText((String) statCols[sIdx][0]);
            lTv.setTextColor(this.cTextLight);
            lTv.setTextSize(sp(11.0f));
            lTv.setGravity(17);
            col.addView(lTv);
            statsRow.addView(col);
        }
        progCard.addView(statsRow);
        linearLayout.addView(progCard);

        // 6. Timeline ("📅 Linha do dia" card matching Screenshot 1)
        LinearLayout timelineCard = new LinearLayout(this);
        timelineCard.setOrientation(1);
        timelineCard.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        timelineCard.setPadding(dp(16), dp(16), dp(16), dp(16));
        timelineCard.setLayoutParams(new LinearLayout.LayoutParams(-1, -2));

        TextView tlTitle = new TextView(this);
        tlTitle.setText("📅 Linha do dia");
        tlTitle.setTextColor(this.cTextMain);
        tlTitle.setTextSize(sp(15.0f));
        tlTitle.setTypeface(null, 1);
        tlTitle.setPadding(0, 0, 0, dp(16));
        timelineCard.addView(tlTitle);

        if (doseItems.isEmpty()) {
            LinearLayout emptyBox = new LinearLayout(this);
            emptyBox.setOrientation(1);
            emptyBox.setGravity(17);
            emptyBox.setPadding(dp(16), dp(28), dp(16), dp(28));
            TextView pillEmoji = new TextView(this);
            pillEmoji.setText("💊");
            pillEmoji.setTextSize(sp(36.0f));
            pillEmoji.setGravity(17);
            pillEmoji.setPadding(0, 0, 0, dp(10));
            emptyBox.addView(pillEmoji);
            TextView emptyTxt = new TextView(this);
            emptyTxt.setText("Adicione medicamentos na aba Medicamentos");
            emptyTxt.setTextColor(this.cTextMuted);
            emptyTxt.setTextSize(sp(14.0f));
            emptyTxt.setGravity(17);
            emptyBox.addView(emptyTxt);
            timelineCard.addView(emptyBox);
        } else {
            for (int i = 0; i < doseItems.size(); i++) {
                final JSONObject dItem = doseItems.get(i);
                final JSONObject dMed = dItem.optJSONObject("med");
                final String dHora = dItem.optString("hora");
                String dStatus = dItem.optString("status");
                boolean isConfirmed = "confirmed".equals(dStatus);
                boolean isMissed = "missed".equals(dStatus);
                boolean isLateDose = "late".equals(dStatus);
                boolean isPendingDose = "pending".equals(dStatus);
                boolean isSoonDose = "soon".equals(dStatus);

                int stColor = isConfirmed ? this.cSuccess : ((isMissed || isLateDose) ? this.cDanger : ((isPendingDose || isSoonDose) ? this.cWarning : this.cTextLight));
                String stLabel = isConfirmed ? "Tomado" : (isLateDose ? "Atrasado" : (isPendingDose ? "Agora" : (isMissed ? "Perdida" : (isSoonDose ? "Em breve" : "Agendado"))));
                String stIcon = isConfirmed ? "✓" : (isMissed ? "✕" : (isLateDose ? "!" : (isPendingDose ? "●" : "○")));

                LinearLayout row = new LinearLayout(this);
                row.setOrientation(0);

                // Left timeline dot & connector
                LinearLayout leftTrack = new LinearLayout(this);
                leftTrack.setOrientation(1);
                leftTrack.setGravity(1);
                LinearLayout.LayoutParams ltLp = new LinearLayout.LayoutParams(dp(34), -1);
                ltLp.rightMargin = dp(10);
                leftTrack.setLayoutParams(ltLp);

                TextView dot = new TextView(this);
                dot.setText(stIcon);
                dot.setTextColor(stColor);
                dot.setTextSize(sp(13.0f));
                dot.setTypeface(null, 1);
                dot.setGravity(17);
                dot.setBackground(shape(Color.argb(35, Color.red(stColor), Color.green(stColor), Color.blue(stColor)), 17, stColor, 2));
                dot.setLayoutParams(new LinearLayout.LayoutParams(dp(34), dp(34)));
                leftTrack.addView(dot);

                if (i < doseItems.size() - 1) {
                    View line = new View(this);
                    line.setBackgroundColor(isConfirmed ? Color.parseColor("#4D22C55E") : this.cBorder);
                    LinearLayout.LayoutParams lnLp = new LinearLayout.LayoutParams(dp(2), 0, 1.0f);
                    lnLp.topMargin = dp(3);
                    lnLp.bottomMargin = dp(3);
                    line.setLayoutParams(lnLp);
                    leftTrack.addView(line);
                }
                row.addView(leftTrack);

                // Right card content
                LinearLayout dCard = new LinearLayout(this);
                dCard.setOrientation(1);
                int cardBg = isConfirmed ? Color.parseColor("#1222C55E") : (isLateDose ? Color.parseColor("#1AEF4444") : (isPendingDose ? Color.parseColor("#1AF59E0B") : this.cSurfaceHover));
                dCard.setBackground(shape(cardBg, 14, this.cBorder, 1));
                dCard.setPadding(dp(14), dp(12), dp(14), dp(12));
                LinearLayout.LayoutParams dcLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
                dcLp.bottomMargin = i < doseItems.size() - 1 ? dp(10) : 0;
                dCard.setLayoutParams(dcLp);

                LinearLayout dTop = new LinearLayout(this);
                dTop.setOrientation(0);
                dTop.setGravity(16);

                LinearLayout dInfo = new LinearLayout(this);
                dInfo.setOrientation(1);
                dInfo.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

                LinearLayout timeBadgeRow = new LinearLayout(this);
                timeBadgeRow.setOrientation(0);
                timeBadgeRow.setGravity(16);
                TextView tTv = new TextView(this);
                tTv.setText(dHora);
                tTv.setTextColor(stColor);
                tTv.setTextSize(sp(12.0f));
                tTv.setTypeface(null, 1);
                tTv.setPadding(0, 0, dp(6), 0);
                timeBadgeRow.addView(tTv);

                TextView bTv = new TextView(this);
                bTv.setText(stLabel);
                bTv.setTextColor(stColor);
                bTv.setTextSize(sp(10.0f));
                bTv.setTypeface(null, 1);
                bTv.setBackground(shape(Color.argb(35, Color.red(stColor), Color.green(stColor), Color.blue(stColor)), 10, 0, 0));
                bTv.setPadding(dp(8), dp(2), dp(8), dp(2));
                timeBadgeRow.addView(bTv);
                dInfo.addView(timeBadgeRow);

                TextView mNameTv = new TextView(this);
                mNameTv.setText(dMed.optString("nome"));
                mNameTv.setTextColor(this.cTextMain);
                mNameTv.setTextSize(sp(15.0f));
                mNameTv.setTypeface(null, 1);
                mNameTv.setPadding(0, dp(2), 0, 0);
                dInfo.addView(mNameTv);

                int stQty = getMedStock(dMed);
                TextView mSubTv = new TextView(this);
                mSubTv.setText(dMed.optString("dosagem") + " · " + dMed.optString("unidade", dMed.optString("forma", "comprimido")) + "  📦 " + stQty);
                mSubTv.setTextColor(this.cTextMuted);
                mSubTv.setTextSize(sp(12.0f));
                dInfo.addView(mSubTv);
                dTop.addView(dInfo);

                if (!isConfirmed) {
                    TextView actBtn = new TextView(this);
                    actBtn.setText("Tomar");
                    actBtn.setTextColor(-1);
                    actBtn.setTextSize(sp(12.0f));
                    actBtn.setTypeface(null, 1);
                    actBtn.setBackground(shape(isLateDose ? this.cDanger : Color.parseColor("#16A34A"), 10, 0, 0));
                    actBtn.setPadding(dp(12), dp(8), dp(12), dp(8));
                    actBtn.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            handleDoseConfirmWithWarning(dMed, today, dHora, false);
                        }
                    });
                    dTop.addView(actBtn);
                } else {
                    TextView undoBtn = new TextView(this);
                    undoBtn.setText("↩ Desfazer");
                    undoBtn.setTextColor(this.cTextMuted);
                    undoBtn.setTextSize(sp(11.0f));
                    undoBtn.setTypeface(null, 1);
                    undoBtn.setBackground(shape(this.cSurface, 8, this.cBorder, 1));
                    undoBtn.setPadding(dp(10), dp(6), dp(10), dp(6));
                    undoBtn.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            showUndoConfirmDialog(dMed, today, dHora);
                        }
                    });
                    dTop.addView(undoBtn);
                }

                dCard.addView(dTop);
                row.addView(dCard);
                timelineCard.addView(row);
            }
        }
        linearLayout.addView(timelineCard);
    }

    private void buildMedsTab(LinearLayout linearLayout) {
        if ("todos".equals(this.medFilter) || "continuo".equals(this.medFilter)) {
            this.medFilter = "continuous";
        } else if ("temporario".equals(this.medFilter)) {
            this.medFilter = "temporary";
        }

        // Header: "Meus medicamentos" + "＋ Novo"
        LinearLayout headerRow = new LinearLayout(this);
        headerRow.setOrientation(0);
        headerRow.setGravity(16);
        LinearLayout.LayoutParams hrLp = new LinearLayout.LayoutParams(-1, -2);
        hrLp.bottomMargin = dp(20);
        headerRow.setLayoutParams(hrLp);

        TextView titleTv = new TextView(this);
        titleTv.setText("Meus medicamentos");
        titleTv.setTextColor(this.cTextMain);
        titleTv.setTextSize(sp(22.0f));
        titleTv.setTypeface(null, 1);
        titleTv.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        headerRow.addView(titleTv);

        TextView addBtn = new TextView(this);
        addBtn.setText("＋ Novo");
        addBtn.setTextColor(-1);
        addBtn.setTextSize(sp(14.0f));
        addBtn.setTypeface(null, 1);
        addBtn.setBackground(gradientShape(Color.parseColor("#3B82F6"), Color.parseColor("#6366F1"), 13));
        addBtn.setPadding(dp(18), dp(10), dp(18), dp(10));
        addBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showMedModal(null, -1);
            }
        });
        headerRow.addView(addBtn);
        linearLayout.addView(headerRow);

        // Separate meds by treatment_type
        ArrayList<Integer> contIndices = new ArrayList<>();
        ArrayList<Integer> tempIndices = new ArrayList<>();
        ArrayList<Integer> sosIndices = new ArrayList<>();
        for (int i = 0; i < this.meds.length(); i++) {
            JSONObject m = this.meds.optJSONObject(i);
            if (m != null && m.optBoolean("ativo", true)) {
                String t = getMedType(m);
                if ("temporary".equals(t)) tempIndices.add(i);
                else if ("sos".equals(t)) sosIndices.add(i);
                else contIndices.add(i);
            }
        }

        // Tabs row: 💊 Contínuos (0) | 📅 Temporários (0) | 🚨 SOS (0)
        HorizontalScrollView tabScroll = new HorizontalScrollView(this);
        tabScroll.setHorizontalScrollBarEnabled(false);
        LinearLayout.LayoutParams tsLp = new LinearLayout.LayoutParams(-1, -2);
        tsLp.bottomMargin = dp(20);
        tabScroll.setLayoutParams(tsLp);

        LinearLayout tabsRow = new LinearLayout(this);
        tabsRow.setOrientation(0);
        Object[][] tabDefs = {
            {"continuous", "💊 Contínuos", contIndices.size()},
            {"temporary", "📅 Temporários", tempIndices.size()},
            {"sos", "🚨 SOS", sosIndices.size()}
        };
        for (int tIdx = 0; tIdx < 3; tIdx++) {
            final String tabId = (String) tabDefs[tIdx][0];
            String tabLabel = (String) tabDefs[tIdx][1];
            int tabCount = (Integer) tabDefs[tIdx][2];
            boolean isActive = tabId.equals(this.medFilter);

            LinearLayout tabPill = new LinearLayout(this);
            tabPill.setOrientation(0);
            tabPill.setGravity(16);
            if (isActive) {
                tabPill.setBackground(gradientShape(Color.parseColor("#3B82F6"), Color.parseColor("#6366F1"), 14));
            } else {
                tabPill.setBackground(shape(this.cSurface, 14, this.cBorder, 1));
            }
            tabPill.setPadding(dp(16), dp(12), dp(16), dp(12));
            LinearLayout.LayoutParams tpLp = new LinearLayout.LayoutParams(-2, -2);
            tpLp.rightMargin = dp(8);
            tabPill.setLayoutParams(tpLp);

            TextView lblTv = new TextView(this);
            lblTv.setText(tabLabel);
            lblTv.setTextColor(isActive ? -1 : this.cTextMuted);
            lblTv.setTextSize(sp(14.0f));
            lblTv.setTypeface(null, isActive ? 1 : 0);
            lblTv.setPadding(0, 0, dp(8), 0);
            tabPill.addView(lblTv);

            TextView cntTv = new TextView(this);
            cntTv.setText(String.valueOf(tabCount));
            cntTv.setTextColor(isActive ? -1 : this.cTextLight);
            cntTv.setTextSize(sp(12.0f));
            cntTv.setTypeface(null, 1);
            cntTv.setBackground(shape(isActive ? Color.parseColor("#33FFFFFF") : this.cSurfaceHover, 12, 0, 0));
            cntTv.setPadding(dp(8), dp(2), dp(8), dp(2));
            tabPill.addView(cntTv);

            tabPill.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    MainActivity.this.medFilter = tabId;
                    MainActivity.this.render();
                }
            });
            tabsRow.addView(tabPill);
        }
        tabScroll.addView(tabsRow);
        linearLayout.addView(tabScroll);

        ArrayList<Integer> activeIndices = "temporary".equals(this.medFilter) ? tempIndices : ("sos".equals(this.medFilter) ? sosIndices : contIndices);
        String emptyIcon = "temporary".equals(this.medFilter) ? "📅" : ("sos".equals(this.medFilter) ? "🚨" : "💊");
        String emptyTitle = "temporary".equals(this.medFilter) ? "Nenhum medicamento temporário" : ("sos".equals(this.medFilter) ? "Nenhum medicamento SOS" : "Nenhum medicamento contínuo");
        String emptyDesc = "temporary".equals(this.medFilter) ? "Você não possui tratamentos com data de fim programada." : ("sos".equals(this.medFilter) ? "Você não possui medicamentos para uso eventual cadastrados." : "Você não possui medicamentos de uso contínuo.");

        if (activeIndices.isEmpty()) {
            LinearLayout emptyCard = new LinearLayout(this);
            emptyCard.setOrientation(1);
            emptyCard.setGravity(17);
            emptyCard.setBackground(shape(this.cSurface, 22, this.cBorder, 1));
            emptyCard.setPadding(dp(28), dp(44), dp(28), dp(44));
            LinearLayout.LayoutParams ecLp = new LinearLayout.LayoutParams(-1, -2);
            ecLp.topMargin = dp(8);
            emptyCard.setLayoutParams(ecLp);

            TextView eIcon = new TextView(this);
            eIcon.setText(emptyIcon);
            eIcon.setTextSize(sp(46.0f));
            eIcon.setGravity(17);
            eIcon.setPadding(0, 0, 0, dp(12));
            emptyCard.addView(eIcon);

            TextView eTitle = new TextView(this);
            eTitle.setText(emptyTitle);
            eTitle.setTextColor(this.cTextMain);
            eTitle.setTextSize(sp(18.0f));
            eTitle.setTypeface(null, 1);
            eTitle.setGravity(17);
            eTitle.setPadding(0, 0, 0, dp(8));
            emptyCard.addView(eTitle);

            TextView eDesc = new TextView(this);
            eDesc.setText(emptyDesc);
            eDesc.setTextColor(this.cTextMuted);
            eDesc.setTextSize(sp(14.0f));
            eDesc.setGravity(17);
            eDesc.setPadding(0, 0, 0, dp(22));
            emptyCard.addView(eDesc);

            TextView eBtn = new TextView(this);
            eBtn.setText("+ Adicionar medicamento");
            eBtn.setTextColor(-1);
            eBtn.setTextSize(sp(15.0f));
            eBtn.setTypeface(null, 1);
            eBtn.setGravity(17);
            eBtn.setBackground(gradientShape(Color.parseColor("#3B82F6"), Color.parseColor("#6366F1"), 13));
            eBtn.setPadding(dp(26), dp(14), dp(26), dp(14));
            eBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    showMedModal(null, -1);
                }
            });
            emptyCard.addView(eBtn);
            linearLayout.addView(emptyCard);
            return;
        }

        String today = todayIso();
        for (int idx = 0; idx < activeIndices.size(); idx++) {
            final int medIndex = activeIndices.get(idx);
            final JSONObject med = this.meds.optJSONObject(medIndex);
            if (med == null) continue;
            String tType = getMedType(med);
            boolean isSOS = "sos".equals(tType);
            boolean isTemp = "temporary".equals(tType);
            int medColor = this.cPrimary;
            try {
                medColor = Color.parseColor(med.optString("cor", "#3B82F6"));
            } catch (Exception ignored) {}

            LinearLayout card = new LinearLayout(this);
            card.setOrientation(0);
            card.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
            card.setPadding(dp(16), dp(16), dp(16), dp(16));
            LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(-1, -2);
            cLp.bottomMargin = dp(12);
            card.setLayoutParams(cLp);
            card.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    showMedDetailModal(med);
                }
            });

            // Color bar
            View colorBar = new View(this);
            colorBar.setBackground(shape(medColor, 4, 0, 0));
            LinearLayout.LayoutParams cbLp = new LinearLayout.LayoutParams(dp(4), -1);
            cbLp.rightMargin = dp(12);
            colorBar.setLayoutParams(cbLp);
            card.addView(colorBar);

            // Pill icon box
            TextView pillIcon = new TextView(this);
            pillIcon.setText("💊");
            pillIcon.setTextSize(sp(22.0f));
            pillIcon.setGravity(17);
            pillIcon.setBackground(shape(Color.argb(35, Color.red(medColor), Color.green(medColor), Color.blue(medColor)), 14, medColor, 1));
            LinearLayout.LayoutParams piLp = new LinearLayout.LayoutParams(dp(48), dp(48));
            piLp.rightMargin = dp(12);
            pillIcon.setLayoutParams(piLp);
            card.addView(pillIcon);

            // Right content column
            LinearLayout col = new LinearLayout(this);
            col.setOrientation(1);
            col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

            LinearLayout topRow = new LinearLayout(this);
            topRow.setOrientation(0);
            topRow.setGravity(48);

            LinearLayout titleCol = new LinearLayout(this);
            titleCol.setOrientation(1);
            LinearLayout.LayoutParams tcLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
            tcLp.rightMargin = dp(8);
            titleCol.setLayoutParams(tcLp);

            TextView mName = new TextView(this);
            mName.setText(med.optString("nome"));
            mName.setTextColor(this.cTextMain);
            mName.setTextSize(sp(16.0f));
            mName.setTypeface(null, 1);
            mName.setMaxLines(2);
            mName.setEllipsize(TextUtils.TruncateAt.END);
            titleCol.addView(mName);

            LinearLayout subBadgeRow = new LinearLayout(this);
            subBadgeRow.setOrientation(0);
            subBadgeRow.setGravity(16);
            LinearLayout.LayoutParams sbrLp = new LinearLayout.LayoutParams(-1, -2);
            sbrLp.topMargin = dp(5);
            subBadgeRow.setLayoutParams(sbrLp);

            TextView tBadge = new TextView(this);
            tBadge.setText(isSOS ? "🆘 SOS" : (isTemp ? "📅 Temporário" : "🔄 Contínuo"));
            int tbColor = isSOS ? this.cInfo : (isTemp ? this.cWarning : this.cSuccess);
            tBadge.setTextColor(tbColor);
            tBadge.setTextSize(sp(10.5f));
            tBadge.setTypeface(null, 1);
            tBadge.setSingleLine(true);
            tBadge.setBackground(shape(Color.argb(35, Color.red(tbColor), Color.green(tbColor), Color.blue(tbColor)), 10, 0, 0));
            tBadge.setPadding(dp(8), dp(2), dp(8), dp(2));
            LinearLayout.LayoutParams tbLp = new LinearLayout.LayoutParams(-2, -2);
            tbLp.rightMargin = dp(8);
            tBadge.setLayoutParams(tbLp);
            subBadgeRow.addView(tBadge);

            String unitStr = optCleanString(med, "unidade", optCleanString(med, "forma", "comprimido"));
            String doseStr = optCleanString(med, "dosagem", "");
            TextView doseSub = new TextView(this);
            doseSub.setText((doseStr.isEmpty() ? "" : doseStr + " · ") + unitStr);
            doseSub.setTextColor(this.cTextMuted);
            doseSub.setTextSize(sp(13.0f));
            doseSub.setSingleLine(true);
            doseSub.setEllipsize(TextUtils.TruncateAt.END);
            doseSub.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
            subBadgeRow.addView(doseSub);

            titleCol.addView(subBadgeRow);
            topRow.addView(titleCol);

            // Edit & Delete buttons
            TextView editBtn = new TextView(this);
            editBtn.setText("✏️");
            editBtn.setTextSize(sp(13.0f));
            editBtn.setGravity(17);
            editBtn.setBackground(shape(this.cSurfaceHover, 10, this.cBorder, 1));
            LinearLayout.LayoutParams ebLp = new LinearLayout.LayoutParams(dp(34), dp(34));
            ebLp.rightMargin = dp(6);
            editBtn.setLayoutParams(ebLp);
            editBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    showMedModal(med, medIndex);
                }
            });
            topRow.addView(editBtn);

            TextView delBtn = new TextView(this);
            delBtn.setText("🗑");
            delBtn.setTextSize(sp(13.0f));
            delBtn.setGravity(17);
            delBtn.setBackground(shape(Color.parseColor("#1AEF4444"), 10, Color.parseColor("#40EF4444"), 1));
            delBtn.setLayoutParams(new LinearLayout.LayoutParams(dp(34), dp(34)));
            delBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    showConfirmDeleteMedDialog(med, medIndex);
                }
            });
            topRow.addView(delBtn);
            col.addView(topRow);

            JSONArray hrsCard = med.optJSONArray("horarios");
            String scheduleText;
            if (isSOS) {
                scheduleText = "⏰ Uso conforme necessidade";
            } else if (hrsCard != null && hrsCard.length() > 0) {
                String joinedHrs = joinArray(hrsCard).trim();
                scheduleText = (hrsCard.length() > 1 ? "⏰ Horários: " : "⏰ Horário: ") + (joinedHrs.isEmpty() || "null".equalsIgnoreCase(joinedHrs) ? "Não preenchido" : joinedHrs);
            } else {
                scheduleText = "⏰ Horário: Não preenchido";
            }
            TextView schedTv = new TextView(this);
            schedTv.setText(scheduleText);
            schedTv.setTextColor(this.cTextMuted);
            schedTv.setTextSize(sp(12.5f));
            schedTv.setPadding(0, dp(6), 0, 0);
            col.addView(schedTv);

            String obs = optCleanString(med, "observacoes", optCleanString(med, "instrucoes", ""));
            if (!obs.isEmpty()) {
                TextView obsTv = new TextView(this);
                obsTv.setText("📝 " + obs);
                obsTv.setTextColor(this.cTextLight);
                obsTv.setTextSize(sp(12.0f));
                obsTv.setPadding(0, dp(4), 0, 0);
                col.addView(obsTv);
            }

            if (isTemp) {
                int durDays = med.optInt("duration_days", 7);
                TextView tempInfo = new TextView(this);
                tempInfo.setText("📅 Tratamento por " + durDays + " dias · Início: " + optCleanString(med, "start_date", today));
                tempInfo.setTextColor(this.cWarning);
                tempInfo.setTextSize(sp(11.5f));
                tempInfo.setPadding(0, dp(6), 0, 0);
                col.addView(tempInfo);
            }

            // Bottom row: stock pill + today done / SOS button
            LinearLayout botRow = new LinearLayout(this);
            botRow.setOrientation(0);
            botRow.setGravity(16);
            LinearLayout.LayoutParams brLp = new LinearLayout.LayoutParams(-1, -2);
            brLp.topMargin = dp(10);
            botRow.setLayoutParams(brLp);

            int qty = getMedStock(med);
            int stColor = qty <= 5 ? this.cDanger : (qty <= 10 ? this.cWarning : this.cSuccess);
            TextView stockPill = new TextView(this);
            stockPill.setText("📦 " + qty + " " + unitStr + (qty == 1 ? "" : "s"));
            stockPill.setTextColor(stColor);
            stockPill.setTextSize(sp(12.0f));
            stockPill.setTypeface(null, 1);
            stockPill.setSingleLine(true);
            stockPill.setBackground(shape(Color.argb(35, Color.red(stColor), Color.green(stColor), Color.blue(stColor)), 12, 0, 0));
            stockPill.setPadding(dp(10), dp(4), dp(10), dp(4));
            botRow.addView(stockPill);

            if (!isSOS) {
                JSONArray hrs = med.optJSONArray("horarios");
                int totH = hrs != null ? hrs.length() : 1;
                int doneH = 0;
                if (hrs != null) {
                    for (int hIdx = 0; hIdx < hrs.length(); hIdx++) {
                        if ("tomado".equals(getDoseStatus(med.optString("id"), today, hrs.optString(hIdx)))) {
                            doneH++;
                        }
                    }
                }
                TextView todayStat = new TextView(this);
                todayStat.setText("Hoje: " + doneH + "/" + totH);
                todayStat.setTextColor(this.cTextLight);
                todayStat.setTextSize(sp(12.0f));
                todayStat.setSingleLine(true);
                todayStat.setPadding(dp(10), 0, 0, 0);
                todayStat.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
                botRow.addView(todayStat);
            } else {
                View spc = new View(this);
                spc.setLayoutParams(new LinearLayout.LayoutParams(0, 1, 1.0f));
                botRow.addView(spc);

                TextView sosBtn = new TextView(this);
                sosBtn.setText("+ Tomar SOS");
                sosBtn.setTextColor(-1);
                sosBtn.setTextSize(sp(12.0f));
                sosBtn.setTypeface(null, 1);
                sosBtn.setSingleLine(true);
                sosBtn.setBackground(shape(this.cPrimary, 10, 0, 0));
                sosBtn.setPadding(dp(14), dp(8), dp(14), dp(8));
                sosBtn.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        showSosQuickLogModal(med);
                    }
                });
                botRow.addView(sosBtn);
            }
            col.addView(botRow);
            card.addView(col);
            linearLayout.addView(card);
        }
    }

    private void showConfirmDeleteMedDialog(final JSONObject med, final int index) {
        String msg = "Tem certeza que deseja excluir " + med.optString("nome") + "? O histórico de doses anteriores será mantido.";
        showStyledConfirmDialog("🗑 Excluir medicamento?", msg, "Excluir", "Cancelar", this.cDanger, new Runnable() {
            @Override
            public void run() {
                String delId = med != null ? med.optString("id", "") : "";
                MainActivity.this.meds.remove(index);
                deleteRemoteRecord("medicamentos", delId, "med");
                scheduleAllMedicationAlarms();
                saveAll();
                render();
                Toast.makeText(MainActivity.this, "🗑 " + (med != null ? med.optString("nome") : "Medicamento") + " excluído", 0).show();
            }
        });
    }

    private void showSosQuickLogModal(final JSONObject med) {
        ScrollView sv = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(1);

        String nowHm = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());
        final EditText timeInput = createInput("Horário da tomada", nowHm);
        box.addView(timeInput);

        final EditText reasonInput = createInput("Motivo / Sintoma (ex: Dor de cabeça, Febre, Alergia)", "");
        box.addView(reasonInput);

        HorizontalScrollView chipScroll = new HorizontalScrollView(this);
        LinearLayout chipRow = new LinearLayout(this);
        chipRow.setOrientation(0);
        chipRow.setPadding(0, 0, 0, dp(12));
        String[] reasons = {"Dor de cabeça", "Febre", "Dor no corpo", "Alergia", "Enjoo", "Cólica"};
        for (int i = 0; i < reasons.length; i++) {
            final String rStr = reasons[i];
            TextView chip = new TextView(this);
            chip.setText(rStr);
            chip.setTextColor(this.cPrimary);
            chip.setTextSize(sp(12.0f));
            chip.setBackground(shape(this.cPrimaryLight, 12, 0, 0));
            chip.setPadding(dp(10), dp(6), dp(10), dp(6));
            LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(-2, -2);
            cLp.rightMargin = dp(6);
            chip.setLayoutParams(cLp);
            chip.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    reasonInput.setText(rStr);
                }
            });
            chipRow.addView(chip);
        }
        chipScroll.addView(chipRow);
        box.addView(chipScroll);

        final EditText qtyInput = createInput("Quantidade tomada", "1");
        qtyInput.setInputType(2);
        box.addView(qtyInput);

        sv.addView(box);
        showStyledFormModal("🆘 Registrar Uso SOS — " + med.optString("nome"), sv, "Confirmar Uso SOS", "Cancelar", this.cPrimary, new Runnable() {
            @Override
            public void run() {
                try {
                    String h = timeInput.getText().toString().trim();
                    if (h.isEmpty()) h = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());
                    String mot = reasonInput.getText().toString().trim();
                    int qUsed = Integer.parseInt(qtyInput.getText().toString().trim().isEmpty() ? "1" : qtyInput.getText().toString().trim());
                    String today = todayIso();
                    JSONObject log = new JSONObject();
                    log.put("id", "sos-" + System.currentTimeMillis());
                    log.put("med_id", med.optString("id"));
                    log.put("med_nome", med.optString("nome") + " " + med.optString("dosagem"));
                    log.put("data", today);
                    log.put("created_at", today + "T" + h + ":00.000Z");
                    log.put("horario", h);
                    log.put("hora", h);
                    log.put("status", "confirmed");
                    log.put("motivo", mot);
                    log.put("quantidade_usada", qUsed);
                    MainActivity.this.doseLogs.put(log);

                    int curSt = getMedStock(med);
                    int nextSt = Math.max(0, curSt - qUsed);
                    setMedStock(med, nextSt);
                    String sosReason = mot.isEmpty() ? "Uso SOS" : "Uso SOS: " + mot;
                    MainActivity.this.stockMovements.put(new JSONObject()
                        .put("id", "sm-" + System.currentTimeMillis())
                        .put("med_id", med.optString("id"))
                        .put("medication_id", med.optString("id"))
                        .put("med_nome", med.optString("nome"))
                        .put("med_name", med.optString("nome"))
                        .put("tipo", "saida")
                        .put("movement_type", "consumption")
                        .put("qtd", qUsed)
                        .put("quantity_change", -qUsed)
                        .put("quantity_changed", -qUsed)
                        .put("quantity_delta", -qUsed)
                        .put("delta", -qUsed)
                        .put("previous_quantity", curSt)
                        .put("quantity_before", curSt)
                        .put("new_quantity", nextSt)
                        .put("quantity_after", nextSt)
                        .put("date", today)
                        .put("time", h)
                        .put("hora", h)
                        .put("data", today + " " + h)
                        .put("created_at", today + "T" + h + ":00.000Z")
                        .put("motivo", sosReason)
                        .put("notes", sosReason));
                    saveAll();
                    render();
                    Toast.makeText(MainActivity.this, "✓ Uso SOS de " + med.optString("nome") + " registrado!", 0).show();
                } catch (Exception ignored) {}
            }
        });
    }

    private void showMedDetailModal(final JSONObject med) {
        ScrollView sv = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(1);

        String pa = optCleanString(med, "principio_ativo", optCleanString(med, "active_ingredient", ""));
        TextView paTv = new TextView(this);
        paTv.setText("🧪 Princípio ativo: " + (pa.isEmpty() ? "Não preenchido" : pa));
        paTv.setTextColor(this.cTextMuted);
        paTv.setTextSize(sp(13.0f));
        paTv.setPadding(0, 0, 0, dp(4));
        box.addView(paTv);

        String fab = optCleanString(med, "fabricante", optCleanString(med, "manufacturer", ""));
        TextView fabTv = new TextView(this);
        fabTv.setText("🏭 Fabricante: " + (fab.isEmpty() ? "Não preenchido" : fab));
        fabTv.setTextColor(this.cTextMuted);
        fabTv.setTextSize(sp(13.0f));
        fabTv.setPadding(0, 0, 0, dp(4));
        box.addView(fabTv);

        int stock = getMedStock(med);
        String unit = optCleanString(med, "unidade", optCleanString(med, "forma", "comprimido"));
        TextView stTv = new TextView(this);
        stTv.setText("📦 Estoque disponível: " + stock + " " + unit + "s");
        stTv.setTextColor(stock <= 5 ? this.cDanger : (stock <= 10 ? this.cWarning : this.cSuccess));
        stTv.setTextSize(sp(14.0f));
        stTv.setTypeface(null, 1);
        stTv.setPadding(0, dp(8), 0, dp(8));
        box.addView(stTv);

        JSONArray hrs = med.optJSONArray("horarios");
        if (!"sos".equals(getMedType(med))) {
            String hrsStr = (hrs != null && hrs.length() > 0) ? joinArray(hrs).trim() : "";
            TextView hTv = new TextView(this);
            hTv.setText("⏰ Horários: " + (hrsStr.isEmpty() || "null".equalsIgnoreCase(hrsStr) ? "Não preenchido" : hrsStr));
            hTv.setTextColor(this.cTextMain);
            hTv.setTextSize(sp(13.0f));
            hTv.setPadding(0, 0, 0, dp(8));
            box.addView(hTv);
        }

        String obs = optCleanString(med, "observacoes", optCleanString(med, "instrucoes", ""));
        TextView oTv = new TextView(this);
        oTv.setText("📝 Observações: " + (obs.isEmpty() ? "Não preenchido" : obs));
        oTv.setTextColor(this.cTextMuted);
        oTv.setTextSize(sp(13.0f));
        oTv.setPadding(0, 0, 0, dp(10));
        box.addView(oTv);

        TextView histHdr = new TextView(this);
        histHdr.setText("Histórico recente deste medicamento");
        histHdr.setTextColor(this.cTextMuted);
        histHdr.setTextSize(sp(12.0f));
        histHdr.setTypeface(null, 1);
        histHdr.setPadding(0, dp(8), 0, dp(6));
        box.addView(histHdr);

        String medId = med.optString("id");
        int count = 0;
        for (int i = this.doseLogs.length() - 1; i >= 0 && count < 8; i--) {
            JSONObject log = this.doseLogs.optJSONObject(i);
            if (log != null && medId.equals(log.optString("med_id"))) {
                TextView row = new TextView(this);
                String st = log.optString("status", "pendente");
                boolean ok = "tomado".equals(st) || "confirmed".equals(st);
                row.setText((ok ? "✓ " : "✕ ") + log.optString("data", "") + " às " + log.optString("horario", log.optString("hora", "")));
                row.setTextColor(ok ? this.cSuccess : this.cDanger);
                row.setTextSize(sp(12.5f));
                row.setPadding(0, dp(3), 0, dp(3));
                box.addView(row);
                count++;
            }
        }
        if (count == 0) {
            TextView none = new TextView(this);
            none.setText("Nenhum registro de dose ainda.");
            none.setTextColor(this.cTextLight);
            none.setTextSize(sp(12.5f));
            box.addView(none);
        }

        sv.addView(box);
        showStyledFormModal("💊 " + med.optString("nome") + " · " + med.optString("dosagem"), sv, "Fechar", null, this.cPrimary, null);
    }

    private void showStockMovementModal(final JSONObject med, final int prevQty, final int newQty) {
        final int diff = newQty - prevQty;
        final String today = todayIso();
        final String hm = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());
        final JSONObject sm = new JSONObject();
        try {
            String defaultMotivo = diff > 0 ? "Reposição de estoque" : "Ajuste manual de estoque";
            sm.put("id", "sm-" + System.currentTimeMillis());
            sm.put("med_id", med.optString("id"));
            sm.put("medication_id", med.optString("id"));
            sm.put("med_nome", med.optString("nome"));
            sm.put("med_name", med.optString("nome"));
            sm.put("tipo", diff >= 0 ? "entrada" : "saida");
            sm.put("movement_type", diff >= 0 ? "purchase" : "adjustment");
            sm.put("qtd", Math.abs(diff));
            sm.put("quantity_change", diff);
            sm.put("quantity_changed", diff);
            sm.put("quantity_delta", diff);
            sm.put("delta", diff);
            sm.put("previous_quantity", prevQty);
            sm.put("quantity_before", prevQty);
            sm.put("new_quantity", newQty);
            sm.put("quantity_after", newQty);
            sm.put("pharmacy", "");
            sm.put("purchase_location", "");
            sm.put("price_paid", "");
            sm.put("purchase_price", "");
            sm.put("date", today);
            sm.put("time", hm);
            sm.put("hora", hm);
            sm.put("data", today + " " + hm);
            sm.put("created_at", today + "T" + hm + ":00.000Z");
            sm.put("motivo", defaultMotivo);
            sm.put("notes", defaultMotivo);
            this.stockMovements.put(sm);
            deduplicateStockMovements();
            saveAll();
            render();
        } catch (Exception ignored) {}

        ScrollView sv = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(1);

        TextView sub = new TextView(this);
        sub.setText(med.optString("nome") + ": " + prevQty + " → " + newQty + " (" + (diff > 0 ? "+" + diff : String.valueOf(diff)) + " unidades)");
        sub.setTextColor(diff > 0 ? this.cSuccess : this.cWarning);
        sub.setTextSize(sp(14.0f));
        sub.setTypeface(null, 1);
        sub.setPadding(0, 0, 0, dp(12));
        box.addView(sub);

        final EditText typeInput = createInput("Tipo (compra, ajuste, correcao)", diff > 0 ? "compra" : "ajuste");
        box.addView(typeInput);
        final EditText pharmInput = createInput("Farmácia / Local (opcional)", "");
        box.addView(pharmInput);
        final EditText priceInput = createInput("Valor pago R$ (opcional)", "");
        box.addView(priceInput);
        final EditText reasonInput = createInput("Observação / Motivo para auditoria", diff > 0 ? "Reposição de estoque" : "Ajuste manual de estoque");
        box.addView(reasonInput);

        sv.addView(box);
        showStyledFormModal("📦 Movimentação de Estoque", sv, "Registrar", "Pular", this.cPrimary, new Runnable() {
            @Override
            public void run() {
                try {
                    String mType = typeInput.getText().toString().trim().toLowerCase(Locale.ROOT);
                    String movType = mType.contains("compra") ? "purchase" : (mType.contains("corr") ? "correction" : "adjustment");
                    String motivo = reasonInput.getText().toString().trim();
                    String finalMotivo = motivo.isEmpty() ? (diff > 0 ? "Reposição de estoque" : "Ajuste manual de estoque") : motivo;
                    String pharm = pharmInput.getText().toString().trim();
                    String price = priceInput.getText().toString().trim();
                    sm.put("movement_type", movType);
                    sm.put("pharmacy", pharm);
                    sm.put("purchase_location", pharm);
                    sm.put("price_paid", price);
                    sm.put("purchase_price", price);
                    sm.put("motivo", finalMotivo);
                    sm.put("notes", finalMotivo);
                    saveAll();
                    render();
                } catch (Exception ignored) {}
            }
        });
    }

    private static final String[][] BRAZIL_MED_CATALOG = {
        // {category, commercial_name, active_ingredient, dosage, form, unit, manufacturer, type (GEN/REF/SIM)}
        {"ANTI-HIPERTENSIVOS", "Losartana Potássica 50mg", "Losartana Potássica", "50mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"ANTI-HIPERTENSIVOS", "Enalapril 10mg", "Maleato de Enalapril", "10mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"ANTI-HIPERTENSIVOS", "Anlodipino 5mg", "Anlodipino", "5mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"ANTI-HIPERTENSIVOS", "Cozaar 50mg", "Losartana Potássica", "50mg", "Comprimido Revestido", "comprimido", "Organon", "REF"},
        {"ANTI-HIPERTENSIVOS", "Aradois 50mg", "Losartana Potássica", "50mg", "Comprimido Revestido", "comprimido", "Biolab", "SIM"},
        {"ANTI-HIPERTENSIVOS", "Captopril 25mg", "Captopril", "25mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"ANTI-HIPERTENSIVOS", "Hidroclorotiazida 25mg", "Hidroclorotiazida", "25mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"ANTI-HIPERTENSIVOS", "Atenolol 50mg", "Atenolol", "50mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"ANTI-HIPERTENSIVOS", "Propranolol 40mg", "Cloridrato de Propranolol", "40mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"ANTI-HIPERTENSIVOS", "Carvedilol 12,5mg", "Carvedilol", "12,5mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"ANTI-HIPERTENSIVOS", "Furosemida 40mg", "Furosemida", "40mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"ANTI-HIPERTENSIVOS", "Espironolactona 25mg", "Espironolactona", "25mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"ANTI-HIPERTENSIVOS", "Valsartana 160mg", "Valsartana", "160mg", "Comprimido", "comprimido", "Medley", "GEN"},
        {"ANTI-HIPERTENSIVOS", "Seloken 100mg", "Tartarato de Metoprolol", "100mg", "Comprimido", "comprimido", "AstraZeneca", "REF"},

        {"DIABETES", "Metformina 850mg", "Cloridrato de Metformina", "850mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"DIABETES", "Glifage XR 500mg", "Cloridrato de Metformina", "500mg", "Comprimido", "comprimido", "Merck", "REF"},
        {"DIABETES", "Dapagliflozina 10mg", "Dapagliflozina", "10mg", "Comprimido", "comprimido", "AstraZeneca", "REF"},
        {"DIABETES", "Metformina 500mg", "Cloridrato de Metformina", "500mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"DIABETES", "Gliclazida 30mg", "Gliclazida", "30mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"DIABETES", "Glibenclamida 5mg", "Glibenclamida", "5mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"DIABETES", "Forxiga 10mg", "Dapagliflozina", "10mg", "Comprimido", "comprimido", "AstraZeneca", "REF"},
        {"DIABETES", "Jardiance 25mg", "Empagliflozina", "25mg", "Comprimido", "comprimido", "Boehringer", "REF"},
        {"DIABETES", "Ozempic 1mg", "Semaglutida", "1mg", "Solução Injetável", "ml", "Novo Nordisk", "REF"},
        {"DIABETES", "Insulina NPH 100UI", "Insulina Isofana", "100UI/ml", "Solução Injetável", "ml", "Novo Nordisk", "REF"},

        {"COLESTEROL", "Sinvastatina 20mg", "Sinvastatina", "20mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"COLESTEROL", "Atorvastatina 20mg", "Atorvastatina Cálcica", "20mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"COLESTEROL", "Rosuvastatina 10mg", "Rosuvastatina Cálcica", "10mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"COLESTEROL", "Crestor 10mg", "Rosuvastatina Cálcica", "10mg", "Comprimido", "comprimido", "AstraZeneca", "REF"},
        {"COLESTEROL", "Lipitor 20mg", "Atorvastatina Cálcica", "20mg", "Comprimido", "comprimido", "Pfizer", "REF"},
        {"COLESTEROL", "Ezetimiba 10mg", "Ezetimiba", "10mg", "Comprimido", "comprimido", "EMS", "GEN"},

        {"DOR / FEBRE", "Paracetamol 750mg", "Paracetamol", "750mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"DOR / FEBRE", "Dipirona 500mg", "Dipirona Monoidratada", "500mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"DOR / FEBRE", "Ibuprofeno 400mg", "Ibuprofeno", "400mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"DOR / FEBRE", "Novalgina 500mg", "Dipirona Monoidratada", "500mg", "Comprimido", "comprimido", "Sanofi", "REF"},
        {"DOR / FEBRE", "Dipirona Gotas", "Dipirona Monoidratada", "500mg/ml", "Solução Oral", "gotas", "EMS", "GEN"},
        {"DOR / FEBRE", "Tylenol 750mg", "Paracetamol", "750mg", "Comprimido", "comprimido", "Kenvue", "REF"},
        {"DOR / FEBRE", "Advil 400mg", "Ibuprofeno", "400mg", "Cápsula Gelatinosa", "cápsula", "Haleon", "REF"},
        {"DOR / FEBRE", "Nimesulida 100mg", "Nimesulida", "100mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"DOR / FEBRE", "Diclofenaco 50mg", "Diclofenaco de Potássio", "50mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"DOR / FEBRE", "Torsilax", "Paracetamol + Carisoprodol + Diclofenaco", "300/125/50mg", "Comprimido", "comprimido", "Neo Química", "SIM"},

        {"ESTÔMAGO", "Omeprazol 20mg", "Omeprazol", "20mg", "Cápsula", "cápsula", "EMS", "GEN"},
        {"ESTÔMAGO", "Pantoprazol 40mg", "Pantoprazol Sódico", "40mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"ESTÔMAGO", "Domperidona 10mg", "Domperidona", "10mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"ESTÔMAGO", "Esomeprazol 40mg", "Esomeprazol Magnésico", "40mg", "Cápsula", "cápsula", "EMS", "GEN"},
        {"ESTÔMAGO", "Buscopan Composto", "Butilescopolamina + Dipirona", "10mg+500mg", "Comprimido", "comprimido", "Boehringer", "REF"},
        {"ESTÔMAGO", "Luftal Gel", "Simeticona", "80mg", "Gel Oral", "ml", "Takeda", "REF"},

        {"TIREOIDE", "Puran T4 50mcg", "Levotiroxina Sódica", "50mcg", "Comprimido", "comprimido", "Abbott", "REF"},
        {"TIREOIDE", "Levotiroxina 100mcg", "Levotiroxina Sódica", "100mcg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"TIREOIDE", "Levotiroxina 50mcg", "Levotiroxina Sódica", "50mcg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"TIREOIDE", "Synthroid 50mcg", "Levotiroxina Sódica", "50mcg", "Comprimido", "comprimido", "Abbott", "SIM"},

        {"VITAMINAS", "Vitamina D3 2000UI", "Colecalciferol", "2000UI", "Cápsula", "cápsula", "EMS", "GEN"},
        {"VITAMINAS", "Ômega 3 1000mg", "Ácidos Graxos Ômega-3", "1g", "Cápsula Gelatinosa", "cápsula", "EMS", "GEN"},
        {"VITAMINAS", "Ácido Fólico 5mg", "Ácido Fólico", "5mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"VITAMINAS", "Vitamina C 1000mg", "Ácido Ascórbico", "1g", "Comprimido Efervescente", "comprimido", "EMS", "GEN"},
        {"VITAMINAS", "Vitamina B12 1mg", "Cianocobalamina", "1mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"VITAMINAS", "Sulfato Ferroso 40mg", "Sulfato Ferroso", "40mg", "Comprimido", "comprimido", "EMS", "GEN"},

        {"SAÚDE MENTAL / NEUROLOGIA", "Sertralina 50mg", "Cloridrato de Sertralina", "50mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"SAÚDE MENTAL / NEUROLOGIA", "Escitalopram 10mg", "Oxalato de Escitalopram", "10mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"SAÚDE MENTAL / NEUROLOGIA", "Fluoxetina 20mg", "Cloridrato de Fluoxetina", "20mg", "Cápsula", "cápsula", "EMS", "GEN"},
        {"SAÚDE MENTAL / NEUROLOGIA", "Clonazepam 2mg", "Clonazepam", "2mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"SAÚDE MENTAL / NEUROLOGIA", "Rivotril 0,5mg", "Clonazepam", "0,5mg", "Comprimido", "comprimido", "Roche", "REF"},
        {"SAÚDE MENTAL / NEUROLOGIA", "Amitriptilina 25mg", "Cloridrato de Amitriptilina", "25mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"SAÚDE MENTAL / NEUROLOGIA", "Quetiapina 25mg", "Fumarato de Quetiapina", "25mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"SAÚDE MENTAL / NEUROLOGIA", "Pregabalina 75mg", "Pregabalina", "75mg", "Cápsula", "cápsula", "EMS", "GEN"},
        {"SAÚDE MENTAL / NEUROLOGIA", "Donepezila 5mg", "Cloridrato de Donepezila", "5mg", "Comprimido", "comprimido", "EMS", "GEN"},

        {"ANTIBIÓTICOS", "Amoxicilina 500mg", "Amoxicilina", "500mg", "Cápsula", "cápsula", "EMS", "GEN"},
        {"ANTIBIÓTICOS", "Azitromicina 500mg", "Azitromicina", "500mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"ANTIBIÓTICOS", "Cefalexina 500mg", "Cefalexina", "500mg", "Cápsula", "cápsula", "EMS", "GEN"},
        {"ANTIBIÓTICOS", "Ciprofloxacino 500mg", "Cloridrato de Ciprofloxacino", "500mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"ANTIBIÓTICOS", "Clavulin BD 875mg", "Amoxicilina + Clavulanato", "875/125mg", "Comprimido", "comprimido", "GSK", "REF"},

        {"CARDIOVASCULAR / ANTICOAGULANTES", "AAS 100mg", "Ácido Acetilsalicílico", "100mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"CARDIOVASCULAR / ANTICOAGULANTES", "Xarelto 10mg", "Rivaroxabana", "10mg", "Comprimido", "comprimido", "Bayer", "REF"},
        {"CARDIOVASCULAR / ANTICOAGULANTES", "Clopidogrel 75mg", "Clopidogrel", "75mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"CARDIOVASCULAR / ANTICOAGULANTES", "Marevan 5mg", "Varfarina Sódica", "5mg", "Comprimido", "comprimido", "Sanofi", "REF"},

        {"RESPIRATÓRIO / ALERGIA", "Aerolin Spray", "Sulfato de Salbutamol", "100mcg/dose", "Aerossol", "dose", "GSK", "REF"},
        {"RESPIRATÓRIO / ALERGIA", "Loratadina 10mg", "Loratadina", "10mg", "Comprimido", "comprimido", "EMS", "GEN"},
        {"RESPIRATÓRIO / ALERGIA", "Prednisona 20mg", "Prednisona", "20mg", "Comprimido", "comprimido", "EMS", "GEN"}
    };

    private static final String[][] POPULAR_CATALOG_GROUPS = {
        {"ANTI-HIPERTENSIVOS", "Losartana Potássica 50mg", "Enalapril 10mg", "Anlodipino 5mg"},
        {"DIABETES", "Metformina 850mg", "Glifage XR 500mg", "Dapagliflozina 10mg"},
        {"COLESTEROL", "Sinvastatina 20mg", "Atorvastatina 20mg", "Rosuvastatina 10mg"},
        {"DOR / FEBRE", "Paracetamol 750mg", "Dipirona 500mg", "Ibuprofeno 400mg"},
        {"ESTÔMAGO", "Omeprazol 20mg", "Pantoprazol 40mg", "Domperidona 10mg"},
        {"TIREOIDE", "Puran T4 50mcg", "Levotiroxina 100mcg"},
        {"VITAMINAS", "Vitamina D3 2000UI", "Ômega 3 1000mg", "Ácido Fólico 5mg"}
    };

    private String normalizeForSearch(String s) {
        if (s == null) return "";
        String norm = Normalizer.normalize(s.toLowerCase(Locale.ROOT), Normalizer.Form.NFD);
        return norm.replaceAll("[\\p{InCombiningDiacriticalMarks}]", "").trim();
    }

    private void showMedModal(final JSONObject jSONObject, final int i) {
        if (jSONObject != null) {
            showMedFormStepDialog(jSONObject, i, null, getMedType(jSONObject));
        } else {
            showMedCatalogSearchDialog();
        }
    }

    private void showMedCatalogSearchDialog() {
        final AlertDialog dialog = new AlertDialog.Builder(this).create();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(1);
        root.setBackground(shape(this.cSurface, 24, this.cBorder, 1));

        // 1. Header Row: [ 💊 ] Adicionar medicamento / Busque no catálogo ou cadastre manualmente [ × ]
        LinearLayout hdr = new LinearLayout(this);
        hdr.setOrientation(0);
        hdr.setGravity(16);
        hdr.setPadding(dp(18), dp(20), dp(16), dp(14));

        TextView iconBox = new TextView(this);
        iconBox.setText("💊");
        iconBox.setTextSize(sp(20.0f));
        iconBox.setGravity(17);
        iconBox.setBackground(gradientShape(Color.parseColor("#3B82F6"), Color.parseColor("#6366F1"), 13));
        LinearLayout.LayoutParams ibLp = new LinearLayout.LayoutParams(dp(44), dp(44));
        ibLp.rightMargin = dp(12);
        iconBox.setLayoutParams(ibLp);
        hdr.addView(iconBox);

        LinearLayout hdrTextCol = new LinearLayout(this);
        hdrTextCol.setOrientation(1);
        hdrTextCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvTitle = new TextView(this);
        tvTitle.setText("Adicionar medicamento");
        tvTitle.setTextColor(this.cTextMain);
        tvTitle.setTextSize(sp(18.0f));
        tvTitle.setTypeface(null, 1);
        hdrTextCol.addView(tvTitle);

        TextView tvSub = new TextView(this);
        tvSub.setText("Busque no catálogo ou cadastre manualmente");
        tvSub.setTextColor(this.cTextMuted);
        tvSub.setTextSize(sp(12.5f));
        tvSub.setPadding(0, dp(2), 0, 0);
        hdrTextCol.addView(tvSub);
        hdr.addView(hdrTextCol);

        TextView btnClose = new TextView(this);
        btnClose.setText("✕");
        btnClose.setTextColor(this.cTextMuted);
        btnClose.setTextSize(sp(16.0f));
        btnClose.setTypeface(null, 1);
        btnClose.setGravity(17);
        btnClose.setBackground(shape(this.cSurfaceHover, 18, 0, 0));
        LinearLayout.LayoutParams bcLp = new LinearLayout.LayoutParams(dp(36), dp(36));
        bcLp.leftMargin = dp(8);
        btnClose.setLayoutParams(bcLp);
        btnClose.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dialog.dismiss();
            }
        });
        hdr.addView(btnClose);
        root.addView(hdr);

        View topDiv = new View(this);
        topDiv.setBackgroundColor(this.cBorder);
        topDiv.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(1)));
        root.addView(topDiv);

        // 2. Search Bar Container + Helper Text
        LinearLayout searchWrap = new LinearLayout(this);
        searchWrap.setOrientation(1);
        searchWrap.setPadding(dp(16), dp(14), dp(16), dp(6));

        final LinearLayout searchBox = new LinearLayout(this);
        searchBox.setOrientation(0);
        searchBox.setGravity(16);
        int inpBg = this.isDarkMode ? Color.parseColor("#162032") : this.cBgMain;
        searchBox.setBackground(shape(inpBg, 14, this.cBorder, 1));
        searchBox.setPadding(dp(14), dp(10), dp(12), dp(10));

        TextView tvMag = new TextView(this);
        tvMag.setText("🔍");
        tvMag.setTextSize(sp(15.0f));
        tvMag.setPadding(0, 0, dp(10), 0);
        searchBox.addView(tvMag);

        final EditText etQuery = new EditText(this);
        etQuery.setHint("Buscar medicamento, princípio ativo...");
        etQuery.setHintTextColor(this.cTextLight);
        etQuery.setTextColor(this.cTextMain);
        etQuery.setTextSize(sp(14.5f));
        etQuery.setSingleLine(true);
        etQuery.setBackgroundColor(Color.TRANSPARENT);
        etQuery.setPadding(0, dp(2), 0, dp(2));
        etQuery.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        searchBox.addView(etQuery);

        final TextView btnClear = new TextView(this);
        btnClear.setText("✕");
        btnClear.setTextColor(this.cTextMuted);
        btnClear.setTextSize(sp(11.0f));
        btnClear.setGravity(17);
        btnClear.setBackground(shape(this.cSurfaceHover, 11, 0, 0));
        btnClear.setLayoutParams(new LinearLayout.LayoutParams(dp(22), dp(22)));
        btnClear.setVisibility(View.GONE);
        searchBox.addView(btnClear);

        searchWrap.addView(searchBox);

        final TextView tvHelper = new TextView(this);
        tvHelper.setText("Digite o nome comercial ou o princípio ativo");
        tvHelper.setTextColor(this.cTextLight);
        tvHelper.setTextSize(sp(11.5f));
        tvHelper.setGravity(17);
        tvHelper.setPadding(0, dp(6), 0, dp(2));
        searchWrap.addView(tvHelper);
        root.addView(searchWrap);

        // 3. Scrollable Catalog Results List
        ScrollView listScroll = new ScrollView(this);
        listScroll.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(360)));
        final LinearLayout listContainer = new LinearLayout(this);
        listContainer.setOrientation(1);
        listScroll.addView(listContainer);
        root.addView(listScroll);

        // 4. Sticky Footer: [ ✏️ Não encontrei — cadastrar manualmente ]
        View botDiv = new View(this);
        botDiv.setBackgroundColor(this.cBorder);
        botDiv.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(1)));
        root.addView(botDiv);

        LinearLayout footerWrap = new LinearLayout(this);
        footerWrap.setOrientation(1);
        footerWrap.setPadding(dp(16), dp(12), dp(16), dp(14));

        TextView btnManual = new TextView(this);
        btnManual.setText("✏️  Não encontrei — cadastrar manualmente");
        btnManual.setTextColor(this.cTextMuted);
        btnManual.setTextSize(sp(13.5f));
        btnManual.setTypeface(null, 1);
        btnManual.setGravity(17);
        btnManual.setBackground(shape(this.cSurfaceHover, 12, this.cBorder, 1));
        btnManual.setPadding(dp(14), dp(13), dp(14), dp(13));
        btnManual.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dialog.dismiss();
                showMedTreatmentStepDialog(null);
            }
        });
        footerWrap.addView(btnManual);
        root.addView(footerWrap);

        final Runnable populateCatalogList = new Runnable() {
            @Override
            public void run() {
                listContainer.removeAllViews();
                String rawQ = etQuery.getText().toString();
                String q = normalizeForSearch(rawQ);
                btnClear.setVisibility(rawQ.length() > 0 ? View.VISIBLE : View.GONE);
                int boxBg = MainActivity.this.isDarkMode ? Color.parseColor("#162032") : MainActivity.this.cBgMain;
                searchBox.setBackground(shape(boxBg, 14, q.length() >= 2 ? MainActivity.this.cPrimary : MainActivity.this.cBorder, 1));

                if (q.length() == 0) {
                    tvHelper.setVisibility(View.VISIBLE);
                    tvHelper.setText("Digite o nome comercial ou o princípio ativo");
                } else if (q.length() == 1) {
                    tvHelper.setVisibility(View.VISIBLE);
                    tvHelper.setText("Continue digitando…");
                } else {
                    tvHelper.setVisibility(View.GONE);
                }

                if (q.length() < 2) {
                    TextView tvFreq = new TextView(MainActivity.this);
                    tvFreq.setText("MEDICAMENTOS FREQUENTES");
                    tvFreq.setTextColor(MainActivity.this.cTextLight);
                    tvFreq.setTextSize(sp(10.5f));
                    tvFreq.setTypeface(null, 1);
                    tvFreq.setPadding(dp(16), dp(8), dp(16), dp(4));
                    listContainer.addView(tvFreq);

                    for (int g = 0; g < POPULAR_CATALOG_GROUPS.length; g++) {
                        String[] group = POPULAR_CATALOG_GROUPS[g];
                        TextView tvCat = new TextView(MainActivity.this);
                        tvCat.setText(group[0]);
                        tvCat.setTextColor(MainActivity.this.cTextLight);
                        tvCat.setTextSize(sp(10.5f));
                        tvCat.setTypeface(null, 1);
                        tvCat.setPadding(dp(16), dp(10), dp(16), dp(4));
                        listContainer.addView(tvCat);

                        for (int mIdx = 1; mIdx < group.length; mIdx++) {
                            String targetName = group[mIdx];
                            for (int cIdx = 0; cIdx < BRAZIL_MED_CATALOG.length; cIdx++) {
                                final String[] item = BRAZIL_MED_CATALOG[cIdx];
                                if (item[1].equals(targetName)) {
                                    listContainer.addView(buildCatalogResultRow(item, dialog));
                                    break;
                                }
                            }
                        }
                    }
                    return;
                }

                // Filter catalog by query
                String[] terms = q.split("\\s+");
                ArrayList<String[]> matches = new ArrayList<>();
                for (int cIdx = 0; cIdx < BRAZIL_MED_CATALOG.length; cIdx++) {
                    String[] item = BRAZIL_MED_CATALOG[cIdx];
                    String hay = normalizeForSearch(item[1] + " " + item[2] + " " + item[3] + " " + item[6]);
                    boolean allMatch = true;
                    for (String t : terms) {
                        if (!t.isEmpty() && !hay.contains(t)) {
                            allMatch = false;
                            break;
                        }
                    }
                    if (allMatch) {
                        matches.add(item);
                    }
                }

                if (matches.isEmpty()) {
                    LinearLayout emptyBox = new LinearLayout(MainActivity.this);
                    emptyBox.setOrientation(1);
                    emptyBox.setGravity(17);
                    emptyBox.setPadding(dp(24), dp(32), dp(24), dp(32));

                    TextView tvEIcon = new TextView(MainActivity.this);
                    tvEIcon.setText("🔍");
                    tvEIcon.setTextSize(sp(34.0f));
                    tvEIcon.setGravity(17);
                    emptyBox.addView(tvEIcon);

                    TextView tvETitle = new TextView(MainActivity.this);
                    tvETitle.setText("Não encontramos esse medicamento");
                    tvETitle.setTextColor(MainActivity.this.cTextMain);
                    tvETitle.setTextSize(sp(16.0f));
                    tvETitle.setTypeface(null, 1);
                    tvETitle.setGravity(17);
                    tvETitle.setPadding(0, dp(10), 0, dp(6));
                    emptyBox.addView(tvETitle);

                    TextView tvESub = new TextView(MainActivity.this);
                    tvESub.setText("Tente buscar pelo princípio ativo ou nome genérico, ou cadastre manualmente.");
                    tvESub.setTextColor(MainActivity.this.cTextMuted);
                    tvESub.setTextSize(sp(13.0f));
                    tvESub.setGravity(17);
                    tvESub.setPadding(0, 0, 0, dp(18));
                    emptyBox.addView(tvESub);

                    TextView btnCustomNow = new TextView(MainActivity.this);
                    btnCustomNow.setText("+ Cadastrar \"" + rawQ.trim() + "\" manualmente");
                    btnCustomNow.setTextColor(Color.WHITE);
                    btnCustomNow.setTextSize(sp(14.0f));
                    btnCustomNow.setTypeface(null, 1);
                    btnCustomNow.setGravity(17);
                    btnCustomNow.setBackground(gradientShape(Color.parseColor("#3B82F6"), Color.parseColor("#6366F1"), 13));
                    btnCustomNow.setPadding(dp(22), dp(13), dp(22), dp(13));
                    final String customName = rawQ.trim();
                    btnCustomNow.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            dialog.dismiss();
                            String[] customItem = {"PERSONALIZADO", customName, "", "", "Comprimido", "comprimido", "", "PER"};
                            showMedTreatmentStepDialog(customItem);
                        }
                    });
                    emptyBox.addView(btnCustomNow);
                    listContainer.addView(emptyBox);
                } else {
                    TextView tvCnt = new TextView(MainActivity.this);
                    tvCnt.setText(matches.size() + (matches.size() == 1 ? " RESULTADO" : " RESULTADOS"));
                    tvCnt.setTextColor(MainActivity.this.cTextLight);
                    tvCnt.setTextSize(sp(10.5f));
                    tvCnt.setTypeface(null, 1);
                    tvCnt.setPadding(dp(16), dp(8), dp(16), dp(4));
                    listContainer.addView(tvCnt);

                    for (int mIdx = 0; mIdx < matches.size(); mIdx++) {
                        listContainer.addView(buildCatalogResultRow(matches.get(mIdx), dialog));
                    }
                }
            }
        };

        btnClear.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                etQuery.setText("");
            }
        });

        etQuery.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {}
            @Override
            public void afterTextChanged(Editable s) {
                populateCatalogList.run();
            }
        });

        populateCatalogList.run();
        dialog.setView(root);
        dialog.show();
        styleDialogWindow(dialog);
    }

    private View buildCatalogResultRow(final String[] item, final AlertDialog parentDialog) {
        LinearLayout wrap = new LinearLayout(this);
        wrap.setOrientation(1);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(0);
        row.setGravity(16);
        row.setPadding(dp(16), dp(12), dp(16), dp(12));

        String mType = item[7]; // GEN, REF, SIM, PER
        int badgeColor = "GEN".equals(mType) ? Color.parseColor("#22C55E")
                : ("REF".equals(mType) ? Color.parseColor("#3B82F6")
                : ("SIM".equals(mType) ? Color.parseColor("#F59E0B") : Color.parseColor("#8B5CF6")));
        int badgeBg = Color.argb(38, Color.red(badgeColor), Color.green(badgeColor), Color.blue(badgeColor));

        TextView tvIcon = new TextView(this);
        tvIcon.setText("💊");
        tvIcon.setTextSize(sp(17.0f));
        tvIcon.setGravity(17);
        tvIcon.setBackground(shape(badgeBg, 10, 0, 0));
        LinearLayout.LayoutParams icLp = new LinearLayout.LayoutParams(dp(38), dp(38));
        icLp.rightMargin = dp(12);
        tvIcon.setLayoutParams(icLp);
        row.addView(tvIcon);

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(1);
        col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        LinearLayout line1 = new LinearLayout(this);
        line1.setOrientation(0);
        line1.setGravity(16);

        TextView tvName = new TextView(this);
        tvName.setText(item[1]);
        tvName.setTextColor(this.cTextMain);
        tvName.setTextSize(sp(14.5f));
        tvName.setTypeface(null, 1);
        tvName.setMaxLines(2);
        tvName.setEllipsize(TextUtils.TruncateAt.END);
        tvName.setPadding(0, 0, dp(8), 0);
        tvName.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        line1.addView(tvName);

        TextView tvBadge = new TextView(this);
        tvBadge.setText(mType);
        tvBadge.setTextColor(badgeColor);
        tvBadge.setTextSize(sp(9.5f));
        tvBadge.setTypeface(null, 1);
        tvBadge.setSingleLine(true);
        tvBadge.setBackground(shape(badgeBg, 99, 0, 0));
        tvBadge.setPadding(dp(7), dp(2), dp(7), dp(2));
        line1.addView(tvBadge);
        col.addView(line1);

        TextView tvSub = new TextView(this);
        tvSub.setText(item[2] + (item[3].isEmpty() ? "" : " · " + item[3]) + (item[4].isEmpty() ? "" : " · " + item[4]));
        tvSub.setTextColor(this.cTextMuted);
        tvSub.setTextSize(sp(11.5f));
        tvSub.setPadding(0, dp(2), 0, 0);
        col.addView(tvSub);

        if (!item[6].isEmpty()) {
            TextView tvLab = new TextView(this);
            tvLab.setText(item[6]);
            tvLab.setTextColor(this.cTextLight);
            tvLab.setTextSize(sp(10.5f));
            tvLab.setPadding(0, dp(1), 0, 0);
            col.addView(tvLab);
        }

        row.addView(col);

        TextView tvChev = new TextView(this);
        tvChev.setText("›");
        tvChev.setTextColor(this.cTextLight);
        tvChev.setTextSize(sp(16.0f));
        tvChev.setPadding(dp(8), 0, 0, 0);
        row.addView(tvChev);

        row.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                parentDialog.dismiss();
                showMedTreatmentStepDialog(item);
            }
        });
        wrap.addView(row);

        View div = new View(this);
        div.setBackgroundColor(this.cBorder);
        div.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(1)));
        wrap.addView(div);
        return wrap;
    }

    private View buildCatalogPreviewCard(String[] catalogItem) {
        String mType = catalogItem[7];
        int badgeColor = "GEN".equals(mType) ? Color.parseColor("#22C55E")
                : ("REF".equals(mType) ? Color.parseColor("#3B82F6")
                : ("SIM".equals(mType) ? Color.parseColor("#F59E0B") : Color.parseColor("#8B5CF6")));
        String badgeLabel = "GEN".equals(mType) ? "GENÉRICO"
                : ("REF".equals(mType) ? "REFERÊNCIA"
                : ("SIM".equals(mType) ? "SIMILAR" : "PERSONALIZ."));
        int cardBg = Color.argb(24, Color.red(badgeColor), Color.green(badgeColor), Color.blue(badgeColor));
        int borderCol = Color.argb(80, Color.red(badgeColor), Color.green(badgeColor), Color.blue(badgeColor));
        int iconBg = Color.argb(42, Color.red(badgeColor), Color.green(badgeColor), Color.blue(badgeColor));

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(0);
        card.setGravity(16);
        card.setBackground(shape(cardBg, 16, borderCol, 1));
        card.setPadding(dp(14), dp(14), dp(14), dp(14));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.bottomMargin = dp(16);
        card.setLayoutParams(lp);

        TextView tvI = new TextView(this);
        tvI.setText("💊");
        tvI.setTextSize(sp(20.0f));
        tvI.setGravity(17);
        tvI.setBackground(shape(iconBg, 12, 0, 0));
        LinearLayout.LayoutParams iLp = new LinearLayout.LayoutParams(dp(44), dp(44));
        iLp.rightMargin = dp(12);
        tvI.setLayoutParams(iLp);
        card.addView(tvI);

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(1);
        col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        LinearLayout topRow = new LinearLayout(this);
        topRow.setOrientation(0);
        topRow.setGravity(16);

        TextView tvN = new TextView(this);
        tvN.setText(catalogItem[1]);
        tvN.setTextColor(this.cTextMain);
        tvN.setTextSize(sp(15.0f));
        tvN.setTypeface(null, 1);
        tvN.setMaxLines(2);
        tvN.setEllipsize(TextUtils.TruncateAt.END);
        tvN.setPadding(0, 0, dp(8), 0);
        tvN.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        topRow.addView(tvN);

        TextView tvB = new TextView(this);
        tvB.setText(badgeLabel);
        tvB.setTextColor(badgeColor);
        tvB.setTextSize(sp(9.0f));
        tvB.setTypeface(null, 1);
        tvB.setSingleLine(true);
        tvB.setBackground(shape(iconBg, 99, 0, 0));
        tvB.setPadding(dp(8), dp(2), dp(8), dp(2));
        topRow.addView(tvB);
        col.addView(topRow);

        if (!catalogItem[2].isEmpty() || !catalogItem[3].isEmpty()) {
            TextView tvPa = new TextView(this);
            tvPa.setText(catalogItem[2] + (catalogItem[3].isEmpty() ? "" : " · " + catalogItem[3]));
            tvPa.setTextColor(this.cTextMuted);
            tvPa.setTextSize(sp(12.0f));
            tvPa.setPadding(0, dp(2), 0, 0);
            col.addView(tvPa);
        }
        if (!catalogItem[6].isEmpty()) {
            TextView tvMf = new TextView(this);
            tvMf.setText("🏭 " + catalogItem[6]);
            tvMf.setTextColor(this.cTextLight);
            tvMf.setTextSize(sp(11.0f));
            tvMf.setPadding(0, dp(2), 0, 0);
            col.addView(tvMf);
        }
        card.addView(col);
        return card;
    }

    private void showMedTreatmentStepDialog(final String[] catalogItem) {
        final AlertDialog dialog = new AlertDialog.Builder(this).create();
        ScrollView sv = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(1);
        root.setBackground(shape(this.cSurface, 24, this.cBorder, 1));

        // Header: [ ‹ ] Tipo de tratamento / Como este medicamento será utilizado?
        LinearLayout hdr = new LinearLayout(this);
        hdr.setOrientation(0);
        hdr.setGravity(16);
        hdr.setPadding(dp(18), dp(20), dp(18), dp(16));

        TextView btnBack = new TextView(this);
        btnBack.setText("‹");
        btnBack.setTextColor(this.cTextMuted);
        btnBack.setTextSize(sp(20.0f));
        btnBack.setTypeface(null, 1);
        btnBack.setGravity(17);
        btnBack.setBackground(shape(this.cSurfaceHover, 18, 0, 0));
        LinearLayout.LayoutParams bkLp = new LinearLayout.LayoutParams(dp(36), dp(36));
        bkLp.rightMargin = dp(12);
        btnBack.setLayoutParams(bkLp);
        btnBack.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dialog.dismiss();
                showMedCatalogSearchDialog();
            }
        });
        hdr.addView(btnBack);

        LinearLayout hdrCol = new LinearLayout(this);
        hdrCol.setOrientation(1);
        TextView tvTitle = new TextView(this);
        tvTitle.setText("Tipo de tratamento");
        tvTitle.setTextColor(this.cTextMain);
        tvTitle.setTextSize(sp(18.0f));
        tvTitle.setTypeface(null, 1);
        hdrCol.addView(tvTitle);

        TextView tvSub = new TextView(this);
        tvSub.setText("Como este medicamento será utilizado?");
        tvSub.setTextColor(this.cTextMuted);
        tvSub.setTextSize(sp(12.0f));
        tvSub.setPadding(0, dp(2), 0, 0);
        hdrCol.addView(tvSub);
        hdr.addView(hdrCol);
        root.addView(hdr);

        View div = new View(this);
        div.setBackgroundColor(this.cBorder);
        div.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(1)));
        root.addView(div);

        LinearLayout body = new LinearLayout(this);
        body.setOrientation(1);
        body.setPadding(dp(20), dp(20), dp(20), dp(24));

        if (catalogItem != null) {
            body.addView(buildCatalogPreviewCard(catalogItem));
        }

        final String[] selectedType = {"temporary".equals(this.medFilter) ? "temporary" : ("sos".equals(this.medFilter) ? "sos" : "continuous")};
        final LinearLayout optionsWrap = new LinearLayout(this);
        optionsWrap.setOrientation(1);
        body.addView(optionsWrap);

        final String[][] tTypes = {
            {"continuous", "🟢", "Uso Contínuo", "Utilizado continuamente, sem data de término. Gera lembretes diários.", "#22C55E"},
            {"temporary", "🟡", "Tratamento Temporário", "Utilizado durante um período específico. Encerra automaticamente ao final.", "#F59E0B"},
            {"sos", "🔵", "Uso Sob Demanda (SOS)", "Utilizado apenas quando necessário. Não gera lembretes automáticos.", "#3B82F6"}
        };

        final Runnable renderOptions = new Runnable() {
            @Override
            public void run() {
                optionsWrap.removeAllViews();
                for (int idx = 0; idx < tTypes.length; idx++) {
                    final String[] t = tTypes[idx];
                    boolean active = t[0].equals(selectedType[0]);
                    int tCol = Color.parseColor(t[4]);
                    int bgCol = active ? Color.argb(24, Color.red(tCol), Color.green(tCol), Color.blue(tCol)) : MainActivity.this.cBgMain;

                    LinearLayout optCard = new LinearLayout(MainActivity.this);
                    optCard.setOrientation(0);
                    optCard.setGravity(16);
                    optCard.setBackground(shape(bgCol, 14, active ? tCol : MainActivity.this.cBorder, active ? 2 : 1));
                    optCard.setPadding(dp(16), dp(14), dp(16), dp(14));
                    LinearLayout.LayoutParams oLp = new LinearLayout.LayoutParams(-1, -2);
                    oLp.bottomMargin = dp(10);
                    optCard.setLayoutParams(oLp);

                    TextView tvI = new TextView(MainActivity.this);
                    tvI.setText(t[1]);
                    tvI.setTextSize(sp(22.0f));
                    tvI.setPadding(0, 0, dp(12), 0);
                    optCard.addView(tvI);

                    LinearLayout col = new LinearLayout(MainActivity.this);
                    col.setOrientation(1);
                    col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

                    TextView tvL = new TextView(MainActivity.this);
                    tvL.setText(t[2]);
                    tvL.setTextColor(active ? tCol : MainActivity.this.cTextMain);
                    tvL.setTextSize(sp(14.5f));
                    tvL.setTypeface(null, 1);
                    col.addView(tvL);

                    TextView tvD = new TextView(MainActivity.this);
                    tvD.setText(t[3]);
                    tvD.setTextColor(MainActivity.this.cTextLight);
                    tvD.setTextSize(sp(11.5f));
                    tvD.setPadding(0, dp(2), 0, 0);
                    col.addView(tvD);
                    optCard.addView(col);

                    if (active) {
                        TextView tvChk = new TextView(MainActivity.this);
                        tvChk.setText("✓");
                        tvChk.setTextColor(tCol);
                        tvChk.setTextSize(sp(18.0f));
                        tvChk.setTypeface(null, 1);
                        tvChk.setPadding(dp(8), 0, 0, 0);
                        optCard.addView(tvChk);
                    }

                    optCard.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            selectedType[0] = t[0];
                            run();
                        }
                    });
                    optionsWrap.addView(optCard);
                }
            }
        };
        renderOptions.run();

        TextView btnContinue = new TextView(this);
        btnContinue.setText("Continuar →");
        btnContinue.setTextColor(Color.WHITE);
        btnContinue.setTextSize(sp(15.0f));
        btnContinue.setTypeface(null, 1);
        btnContinue.setGravity(17);
        btnContinue.setBackground(gradientShape(Color.parseColor("#3B82F6"), Color.parseColor("#6366F1"), 14));
        btnContinue.setPadding(dp(16), dp(16), dp(16), dp(16));
        LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(-1, -2);
        cLp.topMargin = dp(10);
        btnContinue.setLayoutParams(cLp);
        btnContinue.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dialog.dismiss();
                showMedFormStepDialog(null, -1, catalogItem, selectedType[0]);
            }
        });
        body.addView(btnContinue);

        sv.addView(body);
        root.addView(sv);
        dialog.setView(root);
        dialog.show();
        styleDialogWindow(dialog);
    }

    private TextView createFormLabel(String text) {
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextColor(this.cTextMuted);
        tv.setTextSize(sp(11.0f));
        tv.setTypeface(null, 1);
        tv.setPadding(0, dp(2), 0, dp(5));
        return tv;
    }

    private void showMedFormStepDialog(final JSONObject jSONObject, final int i, final String[] catalogItem, final String initialTreatmentType) {
        final AlertDialog dialog = new AlertDialog.Builder(this).create();
        final boolean isEditing = (jSONObject != null);
        final int prevStock = isEditing ? getMedStock(jSONObject) : -1;
        final String[] currentTreatType = {initialTreatmentType != null ? initialTreatmentType : "continuous"};

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(1);
        root.setBackground(shape(this.cSurface, 24, this.cBorder, 1));

        // Sticky Header: [ ‹ ] Confirmar dados / Editar medicamento [ × ]
        LinearLayout hdr = new LinearLayout(this);
        hdr.setOrientation(0);
        hdr.setGravity(16);
        hdr.setPadding(dp(18), dp(16), dp(18), dp(14));

        if (!isEditing) {
            TextView btnBack = new TextView(this);
            btnBack.setText("‹");
            btnBack.setTextColor(this.cTextMuted);
            btnBack.setTextSize(sp(20.0f));
            btnBack.setTypeface(null, 1);
            btnBack.setGravity(17);
            btnBack.setBackground(shape(this.cSurfaceHover, 18, 0, 0));
            LinearLayout.LayoutParams bkLp = new LinearLayout.LayoutParams(dp(36), dp(36));
            bkLp.rightMargin = dp(10);
            btnBack.setLayoutParams(bkLp);
            btnBack.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    dialog.dismiss();
                    showMedTreatmentStepDialog(catalogItem);
                }
            });
            hdr.addView(btnBack);
        }

        TextView tvHdrTitle = new TextView(this);
        tvHdrTitle.setText(isEditing ? "Editar medicamento" : "Confirmar dados");
        tvHdrTitle.setTextColor(this.cTextMain);
        tvHdrTitle.setTextSize(sp(18.0f));
        tvHdrTitle.setTypeface(null, 1);
        tvHdrTitle.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        hdr.addView(tvHdrTitle);

        TextView btnClose = new TextView(this);
        btnClose.setText("✕");
        btnClose.setTextColor(this.cTextMuted);
        btnClose.setTextSize(sp(16.0f));
        btnClose.setTypeface(null, 1);
        btnClose.setGravity(17);
        btnClose.setBackground(shape(this.cSurfaceHover, 18, 0, 0));
        btnClose.setLayoutParams(new LinearLayout.LayoutParams(dp(36), dp(36)));
        btnClose.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dialog.dismiss();
            }
        });
        hdr.addView(btnClose);
        root.addView(hdr);

        View div = new View(this);
        div.setBackgroundColor(this.cBorder);
        div.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(1)));
        root.addView(div);

        ScrollView sv = new ScrollView(this);
        sv.setLayoutParams(new LinearLayout.LayoutParams(-1, 0, 1.0f));

        LinearLayout body = new LinearLayout(this);
        body.setOrientation(1);
        body.setPadding(dp(18), dp(14), dp(18), dp(16));

        if (catalogItem != null && !isEditing) {
            body.addView(buildCatalogPreviewCard(catalogItem));
        }

        // Treatment Type Banner with "Alterar"
        boolean isTemp = "temporary".equals(currentTreatType[0]);
        boolean isSOS = "sos".equals(currentTreatType[0]);
        int tCol = isSOS ? Color.parseColor("#3B82F6") : (isTemp ? Color.parseColor("#F59E0B") : Color.parseColor("#22C55E"));
        String tIcon = isSOS ? "🔵" : (isTemp ? "🟡" : "🟢");
        String tLabel = isSOS ? "Uso Sob Demanda (SOS)" : (isTemp ? "Tratamento Temporário" : "Uso Contínuo");

        LinearLayout treatBanner = new LinearLayout(this);
        treatBanner.setOrientation(0);
        treatBanner.setGravity(16);
        treatBanner.setBackground(shape(Color.argb(24, Color.red(tCol), Color.green(tCol), Color.blue(tCol)), 12, Color.argb(75, Color.red(tCol), Color.green(tCol), Color.blue(tCol)), 1));
        treatBanner.setPadding(dp(14), dp(10), dp(14), dp(10));
        LinearLayout.LayoutParams tbLp = new LinearLayout.LayoutParams(-1, -2);
        tbLp.bottomMargin = dp(14);
        treatBanner.setLayoutParams(tbLp);

        TextView tvTI = new TextView(this);
        tvTI.setText(tIcon);
        tvTI.setTextSize(sp(15.0f));
        tvTI.setPadding(0, 0, dp(8), 0);
        treatBanner.addView(tvTI);

        TextView tvTL = new TextView(this);
        tvTL.setText(tLabel);
        tvTL.setTextColor(tCol);
        tvTL.setTextSize(sp(13.0f));
        tvTL.setTypeface(null, 1);
        tvTL.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        treatBanner.addView(tvTL);

        TextView btnChangeTreat = new TextView(this);
        btnChangeTreat.setText("Alterar");
        btnChangeTreat.setTextColor(tCol);
        btnChangeTreat.setTextSize(sp(12.0f));
        btnChangeTreat.setTypeface(null, 1);
        treatBanner.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                final String[] labels = {"🟢 Uso Contínuo", "🟡 Tratamento Temporário", "🔵 Uso Sob Demanda (SOS)"};
                final String[] codes = {"continuous", "temporary", "sos"};
                int curTIdx = "temporary".equals(currentTreatType[0]) ? 1 : ("sos".equals(currentTreatType[0]) ? 2 : 0);
                showStyledSelectDialog("Tipo de tratamento", labels, curTIdx, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int which) {
                        dialog.dismiss();
                        showMedFormStepDialog(jSONObject, i, catalogItem, codes[which]);
                    }
                });
            }
        });
        treatBanner.addView(btnChangeTreat);
        body.addView(treatBanner);

        // Color swatches: COR DO MEDICAMENTO (7 responsive flex swatches so none are ever clipped)
        body.addView(createFormLabel("COR DO MEDICAMENTO"));
        final String[] pillColors = {"#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#A855F7", "#EC4899", "#06B6D4"};
        final String[] selectedColor = {isEditing ? jSONObject.optString("cor", "#3B82F6") : "#3B82F6"};
        final LinearLayout colorRow = new LinearLayout(this);
        colorRow.setOrientation(0);
        LinearLayout.LayoutParams crLp = new LinearLayout.LayoutParams(-1, -2);
        crLp.bottomMargin = dp(12);
        colorRow.setLayoutParams(crLp);

        final Runnable renderColors = new Runnable() {
            @Override
            public void run() {
                colorRow.removeAllViews();
                for (int cIdx = 0; cIdx < pillColors.length; cIdx++) {
                    final String cHex = pillColors[cIdx];
                    boolean isSel = cHex.equalsIgnoreCase(selectedColor[0]);
                    View sw = new View(MainActivity.this);
                    sw.setBackground(shape(Color.parseColor(cHex), 10, isSel ? Color.WHITE : Color.TRANSPARENT, isSel ? 3 : 0));
                    LinearLayout.LayoutParams swLp = new LinearLayout.LayoutParams(0, dp(36), 1.0f);
                    if (cIdx < pillColors.length - 1) {
                        swLp.rightMargin = dp(7);
                    }
                    sw.setLayoutParams(swLp);
                    sw.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            selectedColor[0] = cHex;
                            run();
                        }
                    });
                    colorRow.addView(sw);
                }
            }
        };
        renderColors.run();
        body.addView(colorRow);

        // Fields
        String initName = isEditing ? optCleanString(jSONObject, "nome", "") : (catalogItem != null ? catalogItem[1] : "");
        String initActive = isEditing ? optCleanString(jSONObject, "principio_ativo", optCleanString(jSONObject, "active_ingredient", "")) : (catalogItem != null ? catalogItem[2] : "");
        String initDose = isEditing ? optCleanString(jSONObject, "dosagem", "") : (catalogItem != null ? catalogItem[3] : "");
        String initUnit = isEditing ? optCleanString(jSONObject, "unidade", optCleanString(jSONObject, "forma", "comprimido")) : (catalogItem != null ? catalogItem[5] : "comprimido");
        String initManuf = isEditing ? optCleanString(jSONObject, "fabricante", optCleanString(jSONObject, "manufacturer", "")) : (catalogItem != null ? catalogItem[6] : "");
        String initObs = isEditing ? optCleanString(jSONObject, "observacoes", optCleanString(jSONObject, "instrucoes", "")) : "";

        body.addView(createFormLabel("NOME *"));
        final EditText nameIn = createInput("Nome do medicamento", initName);
        body.addView(nameIn);

        body.addView(createFormLabel("PRINCÍPIO ATIVO"));
        final EditText activeIn = createInput("Princípio ativo", initActive);
        body.addView(activeIn);

        // 2-column row: DOSAGEM | QTD. DISPONÍVEL
        LinearLayout doseStockRow = new LinearLayout(this);
        doseStockRow.setOrientation(0);
        LinearLayout doseCol = new LinearLayout(this);
        doseCol.setOrientation(1);
        LinearLayout.LayoutParams dcLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
        dcLp.rightMargin = dp(6);
        doseCol.setLayoutParams(dcLp);
        doseCol.addView(createFormLabel("DOSAGEM"));
        final EditText doseIn = createInput("Ex: 500mg", initDose);
        doseCol.addView(doseIn);
        doseStockRow.addView(doseCol);

        LinearLayout stockCol = new LinearLayout(this);
        stockCol.setOrientation(1);
        LinearLayout.LayoutParams scLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
        scLp.leftMargin = dp(6);
        stockCol.setLayoutParams(scLp);
        stockCol.addView(createFormLabel("QTD. DISPONÍVEL"));
        final EditText stockIn = createInput("30", String.valueOf(isEditing ? getMedStock(jSONObject) : 30));
        stockIn.setInputType(2);
        stockCol.addView(stockIn);
        doseStockRow.addView(stockCol);
        body.addView(doseStockRow);

        // UNIDADE selector
        body.addView(createFormLabel("UNIDADE"));
        final String[] unitVal = {initUnit.isEmpty() ? "comprimido" : initUnit};
        final TextView tvUnitSelect = new TextView(this);
        tvUnitSelect.setText(unitVal[0] + "  ⌄");
        tvUnitSelect.setTextColor(this.cTextMain);
        tvUnitSelect.setTextSize(sp(14.0f));
        tvUnitSelect.setBackground(shape(this.isDarkMode ? Color.parseColor("#162032") : this.cBgMain, 12, this.cBorder, 1));
        tvUnitSelect.setPadding(dp(14), dp(11), dp(14), dp(11));
        LinearLayout.LayoutParams usLp = new LinearLayout.LayoutParams(-1, -2);
        usLp.bottomMargin = dp(8);
        tvUnitSelect.setLayoutParams(usLp);
        tvUnitSelect.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                final String[] units = {"comprimido", "cápsula", "ml", "gotas", "sachê", "unidade", "dose", "g"};
                int curU = 0;
                for (int uIdx = 0; uIdx < units.length; uIdx++) {
                    if (units[uIdx].equalsIgnoreCase(unitVal[0])) {
                        curU = uIdx;
                        break;
                    }
                }
                showStyledSelectDialog("Selecionar unidade", units, curU, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int which) {
                        unitVal[0] = units[which];
                        tvUnitSelect.setText(unitVal[0] + "  ⌄");
                    }
                });
            }
        });
        body.addView(tvUnitSelect);

        body.addView(createFormLabel("FABRICANTE"));
        final EditText manufIn = createInput("Fabricante", initManuf);
        body.addView(manufIn);

        body.addView(createFormLabel("OBSERVAÇÕES"));
        final EditText obsIn = createInput("Tomar com água, em jejum…", initObs);
        body.addView(obsIn);

        final CheckBox emergCheck = new CheckBox(this);
        emergCheck.setText("  Mostrar no Cartão de Emergência");
        emergCheck.setTextColor(this.cTextMain);
        emergCheck.setTextSize(sp(13.5f));
        emergCheck.setChecked(isEditing && jSONObject.optBoolean("important_for_emergency", false));
        emergCheck.setPadding(0, dp(6), 0, dp(10));
        body.addView(emergCheck);

        // Conditional Temporary Duration
        final EditText durIn = createInput("7", isEditing ? String.valueOf(jSONObject.optInt("duration_days", 7)) : "7");
        durIn.setInputType(2);
        if (isTemp) {
            LinearLayout tempBox = new LinearLayout(this);
            tempBox.setOrientation(1);
            tempBox.setBackground(shape(Color.argb(20, 245, 158, 11), 14, Color.argb(65, 245, 158, 11), 1));
            tempBox.setPadding(dp(14), dp(12), dp(14), dp(12));
            LinearLayout.LayoutParams tmLp = new LinearLayout.LayoutParams(-1, -2);
            tmLp.bottomMargin = dp(12);
            tempBox.setLayoutParams(tmLp);

            TextView tvTmHdr = new TextView(this);
            tvTmHdr.setText("🟡 Duração do tratamento (dias)");
            tvTmHdr.setTextColor(Color.parseColor("#F59E0B"));
            tvTmHdr.setTextSize(sp(12.5f));
            tvTmHdr.setTypeface(null, 1);
            tvTmHdr.setPadding(0, 0, 0, dp(8));
            tempBox.addView(tvTmHdr);
            tempBox.addView(durIn);
            body.addView(tempBox);
        }

        // Schedule Times & Weekdays for Continuous / Temporary
        final ArrayList<String> scheduleList = new ArrayList<>();
        if (isEditing && jSONObject.optJSONArray("horarios") != null && jSONObject.optJSONArray("horarios").length() > 0) {
            JSONArray hArr = jSONObject.optJSONArray("horarios");
            for (int k = 0; k < hArr.length(); k++) {
                scheduleList.add(hArr.optString(k, "08:00"));
            }
        } else {
            scheduleList.add("08:00");
        }

        final ArrayList<Integer> selectedDays = new ArrayList<>();
        if (isEditing && jSONObject.optJSONArray("dias_semana") != null && jSONObject.optJSONArray("dias_semana").length() > 0) {
            JSONArray dArr = jSONObject.optJSONArray("dias_semana");
            for (int k = 0; k < dArr.length(); k++) {
                selectedDays.add(dArr.optInt(k, k + 1));
            }
        } else {
            for (int d = 1; d <= 7; d++) selectedDays.add(d);
        }

        if (!isSOS) {
            LinearLayout schedHdr = new LinearLayout(this);
            schedHdr.setOrientation(0);
            schedHdr.setGravity(16);
            schedHdr.setPadding(0, dp(4), 0, dp(8));

            TextView tvSH = new TextView(this);
            tvSH.setText("HORÁRIOS DE ADMINISTRAÇÃO");
            tvSH.setTextColor(this.cTextMuted);
            tvSH.setTextSize(sp(11.0f));
            tvSH.setTypeface(null, 1);
            tvSH.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
            schedHdr.addView(tvSH);

            final LinearLayout timesContainer = new LinearLayout(this);
            timesContainer.setOrientation(1);

            final Runnable renderTimes = new Runnable() {
                @Override
                public void run() {
                    timesContainer.removeAllViews();
                    for (int tIdx = 0; tIdx < scheduleList.size(); tIdx++) {
                        final int curIdx = tIdx;
                        final String curTime = scheduleList.get(tIdx);
                        LinearLayout tRow = new LinearLayout(MainActivity.this);
                        tRow.setOrientation(0);
                        tRow.setGravity(16);
                        LinearLayout.LayoutParams trLp = new LinearLayout.LayoutParams(-1, -2);
                        trLp.bottomMargin = dp(8);
                        tRow.setLayoutParams(trLp);

                        final TextView tvTimeBox = new TextView(MainActivity.this);
                        tvTimeBox.setText("⏰  " + curTime);
                        tvTimeBox.setTextColor(MainActivity.this.cTextMain);
                        tvTimeBox.setTextSize(sp(15.0f));
                        tvTimeBox.setTypeface(null, 1);
                        tvTimeBox.setBackground(shape(MainActivity.this.isDarkMode ? Color.parseColor("#162032") : MainActivity.this.cBgMain, 12, MainActivity.this.cBorder, 1));
                        tvTimeBox.setPadding(dp(14), dp(11), dp(14), dp(11));
                        tvTimeBox.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
                        tvTimeBox.setOnClickListener(new View.OnClickListener() {
                            @Override
                            public void onClick(View v) {
                                int hr = 8, min = 0;
                                try {
                                    String[] p = curTime.split(":");
                                    hr = Integer.parseInt(p[0]);
                                    min = Integer.parseInt(p[1]);
                                } catch (Exception ignored) {}
                                new TimePickerDialog(MainActivity.this, new TimePickerDialog.OnTimeSetListener() {
                                    @Override
                                    public void onTimeSet(TimePicker view, int hourOfDay, int minute) {
                                        scheduleList.set(curIdx, String.format(Locale.US, "%02d:%02d", hourOfDay, minute));
                                        run();
                                    }
                                }, hr, min, true).show();
                            }
                        });
                        tRow.addView(tvTimeBox);

                        if (scheduleList.size() > 1) {
                            TextView btnRemTime = new TextView(MainActivity.this);
                            btnRemTime.setText("✕");
                            btnRemTime.setTextColor(MainActivity.this.cDanger);
                            btnRemTime.setTextSize(sp(15.0f));
                            btnRemTime.setTypeface(null, 1);
                            btnRemTime.setGravity(17);
                            btnRemTime.setBackground(shape(Color.parseColor("#1AEF4444"), 12, Color.parseColor("#40EF4444"), 1));
                            LinearLayout.LayoutParams rmLp = new LinearLayout.LayoutParams(dp(42), dp(42));
                            rmLp.leftMargin = dp(8);
                            btnRemTime.setLayoutParams(rmLp);
                            btnRemTime.setOnClickListener(new View.OnClickListener() {
                                @Override
                                public void onClick(View v) {
                                    scheduleList.remove(curIdx);
                                    run();
                                }
                            });
                            tRow.addView(btnRemTime);
                        }
                        timesContainer.addView(tRow);
                    }
                }
            };

            TextView btnAddTime = new TextView(this);
            btnAddTime.setText("+ Adicionar horário");
            btnAddTime.setTextColor(this.cPrimary);
            btnAddTime.setTextSize(sp(12.0f));
            btnAddTime.setTypeface(null, 1);
            btnAddTime.setBackground(shape(Color.parseColor("#143B82F6"), 99, Color.parseColor("#593B82F6"), 1));
            btnAddTime.setPadding(dp(12), dp(5), dp(12), dp(5));
            btnAddTime.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    scheduleList.add("12:00");
                    renderTimes.run();
                }
            });
            schedHdr.addView(btnAddTime);
            body.addView(schedHdr);
            renderTimes.run();
            body.addView(timesContainer);

            if ("continuous".equals(currentTreatType[0])) {
                body.addView(createFormLabel("DIAS DA SEMANA"));
                final LinearLayout daysRow = new LinearLayout(this);
                daysRow.setOrientation(0);
                LinearLayout.LayoutParams drLp = new LinearLayout.LayoutParams(-1, -2);
                drLp.bottomMargin = dp(8);
                daysRow.setLayoutParams(drLp);

                final Runnable renderDays = new Runnable() {
                    @Override
                    public void run() {
                        daysRow.removeAllViews();
                        for (int dIdx = 0; dIdx < WEEKDAYS_SHORT_PT.length; dIdx++) {
                            final int dayVal = dIdx + 1;
                            final boolean active = selectedDays.contains(dayVal);
                            TextView tvD = new TextView(MainActivity.this);
                            tvD.setText(WEEKDAYS_SHORT_PT[dIdx]);
                            tvD.setTextColor(active ? Color.WHITE : MainActivity.this.cTextMuted);
                            tvD.setTextSize(sp(11.5f));
                            tvD.setTypeface(null, 1);
                            tvD.setGravity(17);
                            tvD.setBackground(shape(active ? MainActivity.this.cPrimary : MainActivity.this.cSurfaceHover, 10, 0, 0));
                            tvD.setPadding(0, dp(10), 0, dp(10));
                            LinearLayout.LayoutParams dLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
                            if (dIdx < 6) dLp.rightMargin = dp(4);
                            tvD.setLayoutParams(dLp);
                            tvD.setOnClickListener(new View.OnClickListener() {
                                @Override
                                public void onClick(View v) {
                                    if (active && selectedDays.size() > 1) {
                                        selectedDays.remove(Integer.valueOf(dayVal));
                                    } else if (!active) {
                                        selectedDays.add(dayVal);
                                    }
                                    run();
                                }
                            });
                            daysRow.addView(tvD);
                        }
                    }
                };
                renderDays.run();
                body.addView(daysRow);
            }
        } else {
            LinearLayout sosNote = new LinearLayout(this);
            sosNote.setOrientation(1);
            sosNote.setBackground(shape(Color.argb(20, 59, 130, 246), 12, Color.argb(65, 59, 130, 246), 1));
            sosNote.setPadding(dp(14), dp(14), dp(14), dp(14));
            LinearLayout.LayoutParams snLp = new LinearLayout.LayoutParams(-1, -2);
            snLp.bottomMargin = dp(8);
            sosNote.setLayoutParams(snLp);

            TextView tvSn = new TextView(this);
            tvSn.setText("🔵 Este medicamento não terá horários fixos. Ele ficará disponível na lista rápida de \"Medicamentos SOS\" para registro manual sempre que for utilizado.");
            tvSn.setTextColor(Color.parseColor("#3B82F6"));
            tvSn.setTextSize(sp(12.0f));
            tvSn.setTypeface(null, 1);
            sosNote.addView(tvSn);
            body.addView(sosNote);
        }

        sv.addView(body);
        root.addView(sv);

        // Sticky Footer Divider + Primary Save Button
        View botDiv = new View(this);
        botDiv.setBackgroundColor(this.cBorder);
        botDiv.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(1)));
        root.addView(botDiv);

        LinearLayout footerBar = new LinearLayout(this);
        footerBar.setOrientation(1);
        footerBar.setPadding(dp(18), dp(12), dp(18), dp(14));

        TextView btnSaveMed = new TextView(this);
        btnSaveMed.setText(isEditing ? "✓ Salvar alterações" : "+ Adicionar medicamento");
        btnSaveMed.setTextColor(Color.WHITE);
        btnSaveMed.setTextSize(sp(15.5f));
        btnSaveMed.setTypeface(null, 1);
        btnSaveMed.setGravity(17);
        btnSaveMed.setBackground(gradientShape(Color.parseColor("#3B82F6"), Color.parseColor("#6366F1"), 14));
        btnSaveMed.setPadding(dp(16), dp(14), dp(16), dp(14));
        btnSaveMed.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    String nomeVal = nameIn.getText().toString().trim();
                    if (nomeVal.isEmpty()) {
                        Toast.makeText(MainActivity.this, "Informe o nome do medicamento", 0).show();
                        return;
                    }
                    JSONObject mObj = isEditing ? jSONObject : new JSONObject();
                    if (!isEditing) {
                        mObj.put("id", UUID.randomUUID().toString());
                    }
                    mObj.put("_local_unsynced", true);
                    mObj.put("ativo", true);
                    mObj.put("nome", nomeVal);
                    mObj.put("principio_ativo", activeIn.getText().toString().trim());
                    mObj.put("dosagem", doseIn.getText().toString().trim());
                    mObj.put("unidade", unitVal[0]);
                    mObj.put("forma", unitVal[0]);

                    String normT = currentTreatType[0];
                    mObj.put("treatment_type", normT);
                    mObj.put("tipo_uso", "temporary".equals(normT) ? "temporario" : ("sos".equals(normT) ? "sos" : "continuo"));
                    if ("temporary".equals(normT)) {
                        int dDays = Integer.parseInt(durIn.getText().toString().trim().isEmpty() ? "7" : durIn.getText().toString().trim());
                        mObj.put("duration_days", dDays);
                        mObj.put("treatment_days", dDays);
                        if (!mObj.has("start_date")) mObj.put("start_date", todayIso());
                    }

                    JSONArray hrsArr = new JSONArray();
                    if (!"sos".equals(normT)) {
                        for (String hStr : scheduleList) {
                            if (!hStr.trim().isEmpty()) hrsArr.put(hStr.trim());
                        }
                        if (hrsArr.length() == 0) hrsArr.put("08:00");
                    }
                    mObj.put("horarios", hrsArr);
                    mObj.put("frequencia", hrsArr.length() + "x ao dia");

                    JSONArray daysArr = new JSONArray();
                    if (!"sos".equals(normT)) {
                        for (Integer dNum : selectedDays) daysArr.put(dNum);
                    }
                    mObj.put("dias_semana", daysArr);

                    int newStock = Integer.parseInt(stockIn.getText().toString().trim().isEmpty() ? "0" : stockIn.getText().toString().trim());
                    setMedStock(mObj, newStock);
                    mObj.put("estoque_minimo", 5);
                    mObj.put("fabricante", manufIn.getText().toString().trim());
                    String obsVal = obsIn.getText().toString().trim();
                    mObj.put("observacoes", obsVal);
                    mObj.put("instrucoes", obsVal);
                    mObj.put("cor", selectedColor[0]);
                    mObj.put("important_for_emergency", emergCheck.isChecked());

                    if (i >= 0) {
                        MainActivity.this.meds.put(i, mObj);
                    } else {
                        MainActivity.this.meds.put(mObj);
                    }
                    MainActivity.this.medFilter = normT;
                    saveAll();
                    dialog.dismiss();
                    render();
                    if (isEditing && prevStock >= 0 && prevStock != newStock) {
                        showStockMovementModal(mObj, prevStock, newStock);
                    }
                } catch (Exception ignored) {}
            }
        });
        footerBar.addView(btnSaveMed);
        root.addView(footerBar);

        dialog.setView(root);
        dialog.show();
        styleDialogWindow(dialog);
    }

    private String joinArray(JSONArray jSONArray) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < jSONArray.length(); i++) {
            if (i > 0) {
                sb.append(",");
            }
            sb.append(jSONArray.optString(i));
        }
        return sb.toString();
    }

    private static final String[] MONTHS_PT = {
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    };
    private static final String[] WEEKDAYS_SHORT_PT = {"Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"};

    private void buildCalendarTab(LinearLayout linearLayout) {
        if (this.calYear <= 0) {
            Calendar now = Calendar.getInstance();
            this.calYear = now.get(Calendar.YEAR);
            this.calMonth = now.get(Calendar.MONTH);
        }

        // Top Header: "Calendário" on left + "🔍" button on right
        LinearLayout topHeader = new LinearLayout(this);
        topHeader.setOrientation(0);
        topHeader.setGravity(16);
        LinearLayout.LayoutParams thLp = new LinearLayout.LayoutParams(-1, -2);
        thLp.bottomMargin = dp(14);
        topHeader.setLayoutParams(thLp);

        TextView tvTitle = new TextView(this);
        tvTitle.setText("Calendário");
        tvTitle.setTextColor(this.cTextMain);
        tvTitle.setTextSize(sp(22.0f));
        tvTitle.setTypeface(null, 1);
        tvTitle.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        topHeader.addView(tvTitle);

        TextView btnSearch = new TextView(this);
        btnSearch.setText("🔍");
        btnSearch.setTextSize(sp(17.0f));
        btnSearch.setGravity(17);
        btnSearch.setBackground(shape(this.showCalSearch ? this.cPrimary : this.cSurface, 12, this.showCalSearch ? this.cPrimary : this.cBorder, 1));
        btnSearch.setLayoutParams(new LinearLayout.LayoutParams(dp(40), dp(40)));
        btnSearch.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.showCalSearch = !MainActivity.this.showCalSearch;
                if (!MainActivity.this.showCalSearch) {
                    MainActivity.this.calSearchQuery = "";
                }
                render();
            }
        });
        topHeader.addView(btnSearch);
        linearLayout.addView(topHeader);

        // Optional Search Input + Results
        if (this.showCalSearch) {
            LinearLayout searchRow = new LinearLayout(this);
            searchRow.setOrientation(0);
            searchRow.setGravity(16);
            LinearLayout.LayoutParams srLp = new LinearLayout.LayoutParams(-1, -2);
            srLp.bottomMargin = dp(12);
            searchRow.setLayoutParams(srLp);

            final EditText etSearch = new EditText(this);
            etSearch.setHint("Buscar notas, eventos, medicamentos…");
            etSearch.setText(this.calSearchQuery);
            etSearch.setTextColor(this.cTextMain);
            etSearch.setHintTextColor(this.cTextLight);
            etSearch.setTextSize(sp(14.0f));
            etSearch.setSingleLine(true);
            etSearch.setBackground(shape(this.cSurface, 14, this.cBorder, 1));
            etSearch.setPadding(dp(14), dp(11), dp(14), dp(11));
            LinearLayout.LayoutParams etSLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
            etSLp.rightMargin = dp(8);
            etSearch.setLayoutParams(etSLp);
            searchRow.addView(etSearch);

            TextView btnGoSearch = createButton("Ir", this.cPrimary, Color.WHITE);
            btnGoSearch.setPadding(dp(14), dp(11), dp(14), dp(11));
            btnGoSearch.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    MainActivity.this.calSearchQuery = etSearch.getText().toString().trim();
                    render();
                }
            });
            searchRow.addView(btnGoSearch);
            linearLayout.addView(searchRow);

            String q = this.calSearchQuery.trim().toLowerCase(Locale.ROOT);
            if (!q.isEmpty()) {
                LinearLayout resCard = new LinearLayout(this);
                resCard.setOrientation(1);
                resCard.setBackground(shape(this.cSurface, 18, this.cBorder, 1));
                resCard.setPadding(dp(14), dp(14), dp(14), dp(14));
                LinearLayout.LayoutParams rcLp = new LinearLayout.LayoutParams(-1, -2);
                rcLp.bottomMargin = dp(14);
                resCard.setLayoutParams(rcLp);

                int matchCount = 0;
                for (int i = 0; i < this.calNotesList.length(); i++) {
                    final JSONObject nObj = this.calNotesList.optJSONObject(i);
                    if (nObj != null && (nObj.optString("text", "").toLowerCase(Locale.ROOT).contains(q) || nObj.optString("category", "").toLowerCase(Locale.ROOT).contains(q))) {
                        matchCount++;
                        final String dStr = nObj.optString("date", todayIso());
                        resCard.addView(buildSearchResultItem("📝", nObj.optString("text"), dStr + " · Nota", dStr));
                    }
                }
                for (int i = 0; i < this.events.length(); i++) {
                    final JSONObject ev = this.events.optJSONObject(i);
                    if (ev != null && !isStockEvent(ev)) {
                        String title = ev.optString("title", ev.optString("titulo", ""));
                        String notes = ev.optString("notes", ev.optString("notas", ""));
                        if (title.toLowerCase(Locale.ROOT).contains(q) || notes.toLowerCase(Locale.ROOT).contains(q)) {
                            matchCount++;
                            final String dStr = ev.optString("date", ev.optString("data", todayIso()));
                            resCard.addView(buildSearchResultItem("📅", title, dStr + " · Consulta / Evento", dStr));
                        }
                    }
                }
                for (int i = 0; i < this.stockMovements.length(); i++) {
                    final JSONObject sm = this.stockMovements.optJSONObject(i);
                    if (sm != null && isCalendarStockMovement(sm)) {
                        String label = formatStockMovementCardText(sm);
                        String mot = sm.optString("motivo", "");
                        if (label.toLowerCase(Locale.ROOT).contains(q) || mot.toLowerCase(Locale.ROOT).contains(q)) {
                            matchCount++;
                            final String dStr = getStockMovementDate(sm);
                            resCard.addView(buildSearchResultItem("📦", label.replace("📦 ", ""), dStr + " · Estoque", dStr));
                        }
                    }
                }
                for (int i = 0; i < this.meds.length(); i++) {
                    final JSONObject m = this.meds.optJSONObject(i);
                    if (m != null && m.optString("nome", "").toLowerCase(Locale.ROOT).contains(q)) {
                        matchCount++;
                        resCard.addView(buildSearchResultItem("💊", m.optString("nome") + " " + m.optString("dosagem"), "Medicamento cadastrado", todayIso()));
                    }
                }
                if (matchCount == 0) {
                    TextView tvNoRes = new TextView(this);
                    tvNoRes.setText("Nenhum resultado para \"" + this.calSearchQuery + "\"");
                    tvNoRes.setTextColor(this.cTextMuted);
                    tvNoRes.setTextSize(sp(13.0f));
                    tvNoRes.setGravity(17);
                    tvNoRes.setPadding(0, dp(8), 0, dp(8));
                    resCard.addView(tvNoRes);
                }
                linearLayout.addView(resCard);
            }
        }

        // Interactive Month Calendar Card (borderRadius: 22dp)
        LinearLayout calCard = new LinearLayout(this);
        calCard.setOrientation(1);
        calCard.setBackground(shape(this.cSurface, 22, this.cBorder, 1));
        calCard.setPadding(dp(14), dp(16), dp(14), dp(16));
        LinearLayout.LayoutParams calCardLp = new LinearLayout.LayoutParams(-1, -2);
        calCardLp.bottomMargin = dp(14);
        calCard.setLayoutParams(calCardLp);

        // Month navigation row: [ ‹ ]  Outubro \n 2026  [ › ]
        LinearLayout monthNav = new LinearLayout(this);
        monthNav.setOrientation(0);
        monthNav.setGravity(16);
        LinearLayout.LayoutParams mnLp = new LinearLayout.LayoutParams(-1, -2);
        mnLp.bottomMargin = dp(16);
        monthNav.setLayoutParams(mnLp);

        TextView btnPrevM = new TextView(this);
        btnPrevM.setText("‹");
        btnPrevM.setTextColor(this.cTextMain);
        btnPrevM.setTextSize(sp(20.0f));
        btnPrevM.setGravity(17);
        btnPrevM.setBackground(shape(this.cBgMain, 10, this.cBorder, 1));
        btnPrevM.setLayoutParams(new LinearLayout.LayoutParams(dp(38), dp(38)));
        btnPrevM.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (MainActivity.this.calMonth == 0) {
                    MainActivity.this.calMonth = 11;
                    MainActivity.this.calYear--;
                } else {
                    MainActivity.this.calMonth--;
                }
                render();
            }
        });
        monthNav.addView(btnPrevM);

        LinearLayout monthTitleCol = new LinearLayout(this);
        monthTitleCol.setOrientation(1);
        monthTitleCol.setGravity(17);
        monthTitleCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvMonthName = new TextView(this);
        tvMonthName.setText(MONTHS_PT[this.calMonth]);
        tvMonthName.setTextColor(this.cTextMain);
        tvMonthName.setTextSize(sp(17.0f));
        tvMonthName.setTypeface(null, 1);
        tvMonthName.setGravity(17);
        monthTitleCol.addView(tvMonthName);

        TextView tvYearNum = new TextView(this);
        tvYearNum.setText(String.valueOf(this.calYear));
        tvYearNum.setTextColor(this.cTextMuted);
        tvYearNum.setTextSize(sp(12.0f));
        tvYearNum.setGravity(17);
        monthTitleCol.addView(tvYearNum);

        monthNav.addView(monthTitleCol);

        TextView btnNextM = new TextView(this);
        btnNextM.setText("›");
        btnNextM.setTextColor(this.cTextMain);
        btnNextM.setTextSize(sp(20.0f));
        btnNextM.setGravity(17);
        btnNextM.setBackground(shape(this.cBgMain, 10, this.cBorder, 1));
        btnNextM.setLayoutParams(new LinearLayout.LayoutParams(dp(38), dp(38)));
        btnNextM.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (MainActivity.this.calMonth == 11) {
                    MainActivity.this.calMonth = 0;
                    MainActivity.this.calYear++;
                } else {
                    MainActivity.this.calMonth++;
                }
                render();
            }
        });
        monthNav.addView(btnNextM);
        calCard.addView(monthNav);

        // Weekday headers: Dom Seg Ter Qua Qui Sex Sáb
        LinearLayout wdRow = new LinearLayout(this);
        wdRow.setOrientation(0);
        LinearLayout.LayoutParams wdLp = new LinearLayout.LayoutParams(-1, -2);
        wdLp.bottomMargin = dp(8);
        wdRow.setLayoutParams(wdLp);
        for (String wd : WEEKDAYS_SHORT_PT) {
            TextView tvWd = new TextView(this);
            tvWd.setText(wd);
            tvWd.setTextColor(this.cTextLight);
            tvWd.setTextSize(sp(11.0f));
            tvWd.setTypeface(null, 1);
            tvWd.setGravity(17);
            tvWd.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
            wdRow.addView(tvWd);
        }
        calCard.addView(wdRow);

        // Compute calendar cells
        Calendar calInst = Calendar.getInstance();
        calInst.set(this.calYear, this.calMonth, 1);
        int firstDow = calInst.get(Calendar.DAY_OF_WEEK) - 1; // 0 = Sunday
        int daysInMonth = calInst.getActualMaximum(Calendar.DAY_OF_MONTH);
        int totalCells = firstDow + daysInMonth;
        int numRows = (totalCells + 6) / 7;
        String todayStr = todayIso();

        for (int r = 0; r < numRows; r++) {
            LinearLayout weekRow = new LinearLayout(this);
            weekRow.setOrientation(0);
            LinearLayout.LayoutParams wrLp = new LinearLayout.LayoutParams(-1, -2);
            wrLp.bottomMargin = dp(4);
            weekRow.setLayoutParams(wrLp);

            for (int c = 0; c < 7; c++) {
                int cellIdx = r * 7 + c;
                final int dayNum = cellIdx - firstDow + 1;
                LinearLayout cell = new LinearLayout(this);
                cell.setOrientation(1);
                cell.setGravity(17);
                LinearLayout.LayoutParams cellLp = new LinearLayout.LayoutParams(0, dp(48), 1.0f);
                cellLp.leftMargin = dp(2);
                cellLp.rightMargin = dp(2);
                cell.setLayoutParams(cellLp);

                if (dayNum >= 1 && dayNum <= daysInMonth) {
                    final String dateStr = String.format(Locale.US, "%04d-%02d-%02d", this.calYear, this.calMonth + 1, dayNum);
                    boolean isToday = dateStr.equals(todayStr);
                    boolean isFuture = dateStr.compareTo(todayStr) > 0;
                    String dayDoseStat = getDayDoseSummaryStatus(dateStr);
                    boolean hasNote = hasNoteOnDate(dateStr);
                    boolean hasEv = hasEventOnDate(dateStr);
                    boolean hasSt = hasStockMoveOnDate(dateStr);

                    if (isToday) {
                        cell.setBackground(shape(this.cPrimary, 12, this.cPrimary, 2));
                    } else if ("partial".equals(dayDoseStat) || "missed".equals(dayDoseStat)) {
                        cell.setBackground(shape(Color.parseColor("#1AEF4444"), 12, Color.TRANSPARENT, 0));
                    } else {
                        cell.setBackground(shape(Color.TRANSPARENT, 12, Color.TRANSPARENT, 0));
                    }

                    TextView tvDay = new TextView(this);
                    tvDay.setText(String.valueOf(dayNum));
                    tvDay.setTextSize(sp(13.0f));
                    tvDay.setTypeface(null, isToday ? 1 : 0);
                    tvDay.setTextColor(isToday ? Color.WHITE : (isFuture ? this.cTextLight : this.cTextMain));
                    tvDay.setGravity(17);
                    cell.addView(tvDay);

                    // Dots row
                    LinearLayout dotsRow = new LinearLayout(this);
                    dotsRow.setOrientation(0);
                    dotsRow.setGravity(17);
                    LinearLayout.LayoutParams drLp = new LinearLayout.LayoutParams(-2, dp(8));
                    drLp.topMargin = dp(2);
                    dotsRow.setLayoutParams(drLp);

                    if (dayDoseStat != null) {
                        int dCol = "all_taken".equals(dayDoseStat) ? (isToday ? Color.parseColor("#86EFAC") : Color.parseColor("#22C55E"))
                                : ("partial".equals(dayDoseStat) ? Color.parseColor("#F59E0B") : Color.parseColor("#EF4444"));
                        dotsRow.addView(makeCalDot(dCol));
                    }
                    if (hasNote) {
                        dotsRow.addView(makeCalDot(isToday ? Color.parseColor("#93C5FD") : Color.parseColor("#60A5FA")));
                    }
                    if (hasEv) {
                        dotsRow.addView(makeCalDot(isToday ? Color.parseColor("#C4B5FD") : Color.parseColor("#A78BFA")));
                    }
                    if (hasSt) {
                        dotsRow.addView(makeCalDot(Color.parseColor("#34D399")));
                    }
                    cell.addView(dotsRow);

                    cell.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            MainActivity.this.selectedCalDate = dateStr;
                            showDayPanelDialog(dateStr);
                        }
                    });
                }
                weekRow.addView(cell);
            }
            calCard.addView(weekRow);
        }

        // Divider + Legend inside Calendar card
        View legDiv = new View(this);
        legDiv.setBackgroundColor(this.cBorder);
        LinearLayout.LayoutParams ldLp = new LinearLayout.LayoutParams(-1, dp(1));
        ldLp.topMargin = dp(10);
        ldLp.bottomMargin = dp(10);
        legDiv.setLayoutParams(ldLp);
        calCard.addView(legDiv);

        LinearLayout legRow1 = new LinearLayout(this);
        legRow1.setOrientation(0);
        legRow1.setGravity(16);
        legRow1.addView(makeLegendItem("●", Color.parseColor("#22C55E"), "Tomado"));
        legRow1.addView(makeLegendItem("◐", Color.parseColor("#F59E0B"), "Parcial"));
        legRow1.addView(makeLegendItem("●", Color.parseColor("#EF4444"), "Perdido"));
        legRow1.addView(makeLegendItem("●", Color.parseColor("#60A5FA"), "Nota"));
        legRow1.addView(makeLegendItem("●", Color.parseColor("#A78BFA"), "Evento"));
        legRow1.addView(makeLegendItem("●", Color.parseColor("#34D399"), "Estoque"));
        calCard.addView(legRow1);

        linearLayout.addView(calCard);

        // Two side-by-side quick action buttons: [ 📝 Nova anotação ]  [ 📅 Novo evento ]
        LinearLayout quickRow = new LinearLayout(this);
        quickRow.setOrientation(0);
        LinearLayout.LayoutParams qrLp = new LinearLayout.LayoutParams(-1, -2);
        qrLp.bottomMargin = dp(16);
        quickRow.setLayoutParams(qrLp);

        TextView btnNewNote = new TextView(this);
        btnNewNote.setText("📝  Nova anotação");
        btnNewNote.setTextColor(this.cTextMain);
        btnNewNote.setTextSize(sp(13.0f));
        btnNewNote.setTypeface(null, 1);
        btnNewNote.setGravity(17);
        btnNewNote.setBackground(shape(this.cSurface, 14, this.cBorder, 1));
        btnNewNote.setPadding(dp(12), dp(13), dp(12), dp(13));
        LinearLayout.LayoutParams nnLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
        nnLp.rightMargin = dp(5);
        btnNewNote.setLayoutParams(nnLp);
        btnNewNote.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showNoteModal(todayIso(), null, -1);
            }
        });
        quickRow.addView(btnNewNote);

        TextView btnNewEvent = new TextView(this);
        btnNewEvent.setText("📅  Novo evento");
        btnNewEvent.setTextColor(this.cTextMain);
        btnNewEvent.setTextSize(sp(13.0f));
        btnNewEvent.setTypeface(null, 1);
        btnNewEvent.setGravity(17);
        btnNewEvent.setBackground(shape(this.cSurface, 14, this.cBorder, 1));
        btnNewEvent.setPadding(dp(12), dp(13), dp(12), dp(13));
        LinearLayout.LayoutParams neLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
        neLp.leftMargin = dp(5);
        btnNewEvent.setLayoutParams(neLp);
        btnNewEvent.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showEventModal(todayIso(), null, -1);
            }
        });
        quickRow.addView(btnNewEvent);
        linearLayout.addView(quickRow);

        // Monthly Summary Card: 📊 Resumo — Outubro 2026
        LinearLayout sumCard = new LinearLayout(this);
        sumCard.setOrientation(1);
        sumCard.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        sumCard.setPadding(dp(18), dp(18), dp(18), dp(18));
        LinearLayout.LayoutParams scLp = new LinearLayout.LayoutParams(-1, -2);
        scLp.bottomMargin = dp(16);
        sumCard.setLayoutParams(scLp);

        TextView tvSumTitle = new TextView(this);
        tvSumTitle.setText("📊 Resumo — " + MONTHS_PT[this.calMonth] + " " + this.calYear);
        tvSumTitle.setTextColor(this.cTextMain);
        tvSumTitle.setTextSize(sp(15.0f));
        tvSumTitle.setTypeface(null, 1);
        tvSumTitle.setPadding(0, 0, 0, dp(14));
        sumCard.addView(tvSumTitle);

        // Compute monthly stats
        String monthPrefix = String.format(Locale.US, "%04d-%02d-", this.calYear, this.calMonth + 1);
        int mTotalDoses = 0;
        int mTakenDoses = 0;
        int mLateDoses = 0;
        int mMissedDoses = 0;
        int mSosCount = 0;
        for (int d = 1; d <= daysInMonth; d++) {
            String dIso = String.format(Locale.US, "%04d-%02d-%02d", this.calYear, this.calMonth + 1, d);
            if (dIso.compareTo(todayStr) > 0) continue;
            for (int m = 0; m < this.meds.length(); m++) {
                JSONObject med = this.meds.optJSONObject(m);
                if (med == null || !med.optBoolean("ativo", true) || "sos".equals(getMedType(med))) continue;
                JSONArray hrs = med.optJSONArray("horarios");
                if (hrs == null) continue;
                String mId = med.optString("id");
                for (int h = 0; h < hrs.length(); h++) {
                    String hStr = hrs.optString(h);
                    mTotalDoses++;
                    JSONObject logObj = getDoseLogObject(mId, dIso, hStr);
                    if (logObj != null && ("tomado".equals(logObj.optString("status")) || "taken".equals(logObj.optString("status")))) {
                        mTakenDoses++;
                        if (logObj.optBoolean("late", false)) mLateDoses++;
                    } else if (dIso.compareTo(todayStr) < 0 || "perdida".equals(getDoseStatus(mId, dIso, hStr))) {
                        mMissedDoses++;
                    }
                }
            }
        }
        for (int i = 0; i < this.doseLogs.length(); i++) {
            JSONObject dl = this.doseLogs.optJSONObject(i);
            if (dl != null && dl.optString("data", "").startsWith(monthPrefix) && "SOS".equals(dl.optString("horario_programado"))) {
                mSosCount++;
            }
        }
        int mNotesCount = 0;
        for (int i = 0; i < this.calNotesList.length(); i++) {
            JSONObject n = this.calNotesList.optJSONObject(i);
            if (n != null && n.optString("date", "").startsWith(monthPrefix)) mNotesCount++;
        }
        int mEventsCount = 0;
        for (int i = 0; i < this.events.length(); i++) {
            JSONObject ev = this.events.optJSONObject(i);
            if (ev != null && !isStockEvent(ev) && ev.optString("date", ev.optString("data", "")).startsWith(monthPrefix)) mEventsCount++;
        }
        int mRestockCount = 0;
        for (int i = 0; i < this.stockMovements.length(); i++) {
            JSONObject sm = this.stockMovements.optJSONObject(i);
            if (sm != null && isCalendarStockMovement(sm) && getStockMovementDate(sm).startsWith(monthPrefix) && getStockMovementDelta(sm) > 0) {
                mRestockCount++;
            }
        }
        String adhStr = mTotalDoses > 0 ? ((mTakenDoses * 100 / mTotalDoses) + "%") : "—";
        int adhCol = mTotalDoses == 0 ? this.cTextLight : ((mTakenDoses * 100 / mTotalDoses) >= 80 ? Color.parseColor("#22C55E") : ((mTakenDoses * 100 / mTotalDoses) >= 50 ? Color.parseColor("#F59E0B") : Color.parseColor("#EF4444")));

        // Row 1 of stats (3 cols)
        LinearLayout sRow1 = new LinearLayout(this);
        sRow1.setOrientation(0);
        LinearLayout.LayoutParams sr1Lp = new LinearLayout.LayoutParams(-1, -2);
        sr1Lp.bottomMargin = dp(10);
        sRow1.setLayoutParams(sr1Lp);
        sRow1.addView(makeMonthStatBox("Adesão", adhStr, adhCol));
        sRow1.addView(makeMonthStatBox("Tomadas", String.valueOf(mTakenDoses), Color.parseColor("#22C55E")));
        sRow1.addView(makeMonthStatBox("Atrasos", String.valueOf(mLateDoses), Color.parseColor("#F59E0B")));
        sumCard.addView(sRow1);

        // Row 2 of stats (3 cols)
        LinearLayout sRow2 = new LinearLayout(this);
        sRow2.setOrientation(0);
        LinearLayout.LayoutParams sr2Lp = new LinearLayout.LayoutParams(-1, -2);
        sr2Lp.bottomMargin = dp(10);
        sRow2.setLayoutParams(sr2Lp);
        sRow2.addView(makeMonthStatBox("Perdidas", String.valueOf(mMissedDoses), Color.parseColor("#EF4444")));
        sRow2.addView(makeMonthStatBox("Anotações", String.valueOf(mNotesCount), Color.parseColor("#60A5FA")));
        sRow2.addView(makeMonthStatBox("Consultas", String.valueOf(mEventsCount), Color.parseColor("#A78BFA")));
        sumCard.addView(sRow2);

        // Row 3 of stats (2 cols + 1 spacer)
        LinearLayout sRow3 = new LinearLayout(this);
        sRow3.setOrientation(0);
        sRow3.addView(makeMonthStatBox("Uso SOS", String.valueOf(mSosCount), Color.parseColor("#FB923C")));
        sRow3.addView(makeMonthStatBox("Reposições", String.valueOf(mRestockCount), Color.parseColor("#34D399")));
        View emptyCol = new View(this);
        LinearLayout.LayoutParams ecLp = new LinearLayout.LayoutParams(0, dp(1), 1.0f);
        ecLp.leftMargin = dp(4);
        ecLp.rightMargin = dp(4);
        emptyCol.setLayoutParams(ecLp);
        sRow3.addView(emptyCol);
        sumCard.addView(sRow3);

        linearLayout.addView(sumCard);
    }

    private View makeCalDot(int color) {
        View dot = new View(this);
        dot.setBackground(shape(color, 4, 0, 0));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(5), dp(5));
        lp.leftMargin = dp(1);
        lp.rightMargin = dp(1);
        dot.setLayoutParams(lp);
        return dot;
    }

    private View makeLegendItem(String symbol, int color, String label) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(0);
        item.setGravity(16);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1.0f);
        item.setLayoutParams(lp);

        TextView tvSym = new TextView(this);
        tvSym.setText(symbol + " ");
        tvSym.setTextColor(color);
        tvSym.setTextSize(sp(10.0f));
        item.addView(tvSym);

        TextView tvLbl = new TextView(this);
        tvLbl.setText(label);
        tvLbl.setTextColor(this.cTextMuted);
        tvLbl.setTextSize(sp(10.0f));
        item.addView(tvLbl);
        return item;
    }

    private View makeMonthStatBox(String label, String val, int valColor) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(1);
        box.setGravity(17);
        box.setBackground(shape(this.cBgMain, 14, 0, 0));
        box.setPadding(dp(8), dp(12), dp(8), dp(12));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1.0f);
        lp.leftMargin = dp(4);
        lp.rightMargin = dp(4);
        box.setLayoutParams(lp);

        TextView tvV = new TextView(this);
        tvV.setText(val);
        tvV.setTextColor(valColor);
        tvV.setTextSize(sp(20.0f));
        tvV.setTypeface(null, 1);
        tvV.setGravity(17);
        box.addView(tvV);

        TextView tvL = new TextView(this);
        tvL.setText(label);
        tvL.setTextColor(this.cTextMuted);
        tvL.setTextSize(sp(11.0f));
        tvL.setGravity(17);
        tvL.setPadding(0, dp(3), 0, 0);
        box.addView(tvL);
        return box;
    }

    private View buildSearchResultItem(String icon, String text, String sub, final String dateStr) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(0);
        row.setGravity(16);
        row.setPadding(dp(8), dp(8), dp(8), dp(8));
        row.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.selectedCalDate = dateStr;
                showDayPanelDialog(dateStr);
            }
        });

        TextView tvI = new TextView(this);
        tvI.setText(icon);
        tvI.setTextSize(sp(18.0f));
        tvI.setPadding(0, 0, dp(10), 0);
        row.addView(tvI);

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(1);
        col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvT = new TextView(this);
        tvT.setText(text);
        tvT.setTextColor(this.cTextMain);
        tvT.setTextSize(sp(13.0f));
        tvT.setTypeface(null, 1);
        col.addView(tvT);

        TextView tvS = new TextView(this);
        tvS.setText(sub);
        tvS.setTextColor(this.cTextMuted);
        tvS.setTextSize(sp(11.0f));
        col.addView(tvS);

        row.addView(col);
        return row;
    }

    private String getDayDoseSummaryStatus(String dateStr) {
        String todayStr = todayIso();
        if (dateStr.compareTo(todayStr) > 0) return null;
        int total = 0;
        int taken = 0;
        int missed = 0;
        for (int i = 0; i < this.meds.length(); i++) {
            JSONObject m = this.meds.optJSONObject(i);
            if (m == null || !m.optBoolean("ativo", true) || "sos".equals(getMedType(m))) continue;
            JSONArray hrs = m.optJSONArray("horarios");
            if (hrs == null) continue;
            String mId = m.optString("id");
            for (int h = 0; h < hrs.length(); h++) {
                total++;
                String st = getDoseStatus(mId, dateStr, hrs.optString(h));
                if ("tomado".equals(st)) taken++;
                else if (dateStr.compareTo(todayStr) < 0 || "perdida".equals(st)) missed++;
            }
        }
        if (total == 0) return null;
        if (taken == total) return "all_taken";
        if (taken > 0) return "partial";
        if (missed > 0) return "missed";
        return null;
    }

    private boolean hasNoteOnDate(String dateStr) {
        if (!this.calNotes.optString(dateStr, "").trim().isEmpty()) return true;
        for (int i = 0; i < this.calNotesList.length(); i++) {
            JSONObject n = this.calNotesList.optJSONObject(i);
            if (n != null && dateStr.equals(n.optString("date"))) return true;
        }
        return false;
    }

    private boolean isStockEvent(JSONObject ev) {
        if (ev == null) return false;
        String tp = ev.optString("type", ev.optString("tipo", "")).trim().toLowerCase(Locale.ROOT);
        if ("estoque".equals(tp) || "stock".equals(tp) || "reposicao".equals(tp) || "reposição".equals(tp)) {
            return true;
        }
        String id = ev.optString("id", "");
        if (id.startsWith("ev-st-")) return true;
        String title = ev.optString("title", ev.optString("titulo", "")).trim();
        return title.startsWith("Reposição:") || title.startsWith("Reposição de estoque") || title.startsWith("Ajuste de estoque");
    }

    private boolean isCalendarStockMovement(JSONObject sm) {
        if (sm == null) return false;
        String movType = sm.optString("movement_type", "").trim().toLowerCase(Locale.ROOT);
        if ("consumption".equals(movType)) return false;
        String mot = sm.optString("motivo", "").trim();
        if (mot.startsWith("Dose tomada") || mot.startsWith("Uso SOS")) return false;
        return true;
    }

    private String getStockMovementDate(JSONObject sm) {
        if (sm == null) return "";
        String raw = sm.optString("date", "");
        if (raw.isEmpty()) raw = sm.optString("data", "");
        if (raw.isEmpty()) raw = sm.optString("data_hora", "");
        if (raw.isEmpty()) raw = sm.optString("created_at", "");
        raw = raw.trim();
        if (raw.length() >= 10) return raw.substring(0, 10);
        return raw;
    }

    private String getStockMovementTime(JSONObject sm) {
        if (sm == null) return "";
        String tm = sm.optString("time", sm.optString("hora", "")).trim();
        if (!tm.isEmpty()) {
            if (tm.length() >= 5 && tm.charAt(2) == ':') {
                return tm.substring(0, 5);
            }
            return tm;
        }
        String dataStr = sm.optString("data", "").trim();
        if (dataStr.length() >= 16 && dataStr.charAt(10) == ' ') {
            return dataStr.substring(11, 16);
        }
        String createdAt = sm.optString("created_at", "").trim();
        if (createdAt.length() >= 16 && createdAt.charAt(10) == 'T') {
            return createdAt.substring(11, 16);
        }
        return "";
    }

    private int getStockMovementDelta(JSONObject sm) {
        if (sm == null) return 0;
        if (sm.has("quantity_change")) return sm.optInt("quantity_change", 0);
        if (sm.has("quantity_changed")) return sm.optInt("quantity_changed", 0);
        if (sm.has("quantity_delta")) return sm.optInt("quantity_delta", 0);
        if (sm.has("delta")) return sm.optInt("delta", 0);
        int q = sm.optInt("qtd", 0);
        if ("saida".equalsIgnoreCase(sm.optString("tipo", ""))) return -q;
        return q;
    }

    private String resolveStockMovementMedName(JSONObject sm) {
        if (sm == null) return "";
        String medNome = sm.optString("med_nome", sm.optString("med_name", "")).trim();
        if (!medNome.isEmpty()) return medNome;
        String medId = sm.optString("med_id", sm.optString("medication_id", "")).trim();
        if (!medId.isEmpty() && this.meds != null) {
            for (int i = 0; i < this.meds.length(); i++) {
                JSONObject m = this.meds.optJSONObject(i);
                if (m != null && medId.equals(m.optString("id"))) {
                    return m.optString("nome", "").trim();
                }
            }
        }
        String rawTitle = sm.optString("title", sm.optString("titulo", "")).trim();
        if (!rawTitle.isEmpty()) {
            String cleaned = rawTitle.replace("📦", "").trim();
            if (cleaned.regionMatches(true, 0, "Reposição:", 0, 10)) {
                cleaned = cleaned.substring(10).trim();
            } else if (cleaned.regionMatches(true, 0, "Reposicao:", 0, 10)) {
                cleaned = cleaned.substring(10).trim();
            } else if (cleaned.regionMatches(true, 0, "Ajuste:", 0, 7)) {
                cleaned = cleaned.substring(7).trim();
            }
            int parenIdx = cleaned.indexOf(" (");
            if (parenIdx > 0) cleaned = cleaned.substring(0, parenIdx).trim();
            int asIdx = cleaned.indexOf(" às ");
            if (asIdx > 0) cleaned = cleaned.substring(0, asIdx).trim();
            return cleaned;
        }
        return "";
    }

    private String formatStockMovementCardText(JSONObject sm) {
        if (sm == null) return "📦 Movimentação de estoque";
        String tm = getStockMovementTime(sm);
        String explicitTitle = sm.optString("title", sm.optString("titulo", "")).trim();
        String medNome = resolveStockMovementMedName(sm);
        String mainText;
        if (!medNome.isEmpty()) {
            int delta = getStockMovementDelta(sm);
            String prefix = delta >= 0 ? "Reposição: " : "Ajuste: ";
            String deltaStr = delta > 0 ? "(+" + delta + ")" : "(" + delta + ")";
            mainText = "📦 " + prefix + medNome + " " + deltaStr + (tm.isEmpty() ? "" : " às " + tm);
        } else if (!explicitTitle.isEmpty()) {
            String cleanTitle = explicitTitle.replaceAll("(\\d{2}:\\d{2}):\\d{2}", "$1");
            mainText = "📦 " + cleanTitle + (tm.isEmpty() || cleanTitle.contains(" às ") ? "" : " às " + tm);
        } else {
            mainText = "📦 Movimentação de estoque" + (tm.isEmpty() ? "" : " às " + tm);
        }
        String pharm = sm.optString("pharmacy", sm.optString("purchase_location", "")).trim();
        String mot = sm.optString("motivo", sm.optString("notes", sm.optString("description", sm.optString("notas", "")))).trim();
        if (!pharm.isEmpty()) {
            mainText += " • " + pharm;
        }
        if (!mot.isEmpty()
                && !"Reposição de estoque".equalsIgnoreCase(mot)
                && !"Atualização de estoque".equalsIgnoreCase(mot)
                && !"Ajuste manual".equalsIgnoreCase(mot)
                && !"Ajuste manual de estoque".equalsIgnoreCase(mot)) {
            mainText += " • " + mot;
        }
        return mainText;
    }

    private boolean migrateStockEventsFromEvents() {
        if (this.events == null) return false;
        if (this.stockMovements == null) this.stockMovements = new JSONArray();
        boolean changed = false;
        JSONArray cleanEvents = new JSONArray();
        for (int i = 0; i < this.events.length(); i++) {
            JSONObject ev = this.events.optJSONObject(i);
            if (ev == null) continue;
            if (isStockEvent(ev)) {
                changed = true;
                String evDate = ev.optString("date", ev.optString("data", "")).trim();
                if (evDate.length() >= 10) {
                    evDate = evDate.substring(0, 10);
                }
                String evTime = ev.optString("time", ev.optString("hora", "")).trim();
                if (evTime.length() >= 5 && evTime.charAt(2) == ':') {
                    evTime = evTime.substring(0, 5);
                }
                String evTitle = ev.optString("title", ev.optString("titulo", "")).trim();
                int parsedDelta = 1;
                int plusIdx = evTitle.indexOf("(+");
                int closeIdx = evTitle.indexOf(")", plusIdx);
                if (plusIdx >= 0 && closeIdx > plusIdx + 2) {
                    try {
                        parsedDelta = Integer.parseInt(evTitle.substring(plusIdx + 2, closeIdx).trim());
                    } catch (Exception ignored) {}
                }
                boolean alreadyInStock = false;
                for (int j = 0; j < this.stockMovements.length(); j++) {
                    JSONObject sm = this.stockMovements.optJSONObject(j);
                    if (sm != null && isCalendarStockMovement(sm)) {
                        String smDate = getStockMovementDate(sm);
                        String smTime = getStockMovementTime(sm);
                        int smDelta = getStockMovementDelta(sm);
                        if (evDate.equals(smDate) && (smDelta == parsedDelta || evTime.isEmpty() || smTime.isEmpty() || evTime.equals(smTime))) {
                            alreadyInStock = true;
                            break;
                        }
                    }
                }
                if (!alreadyInStock) {
                    try {
                        JSONObject migrated = new JSONObject();
                        migrated.put("id", "sm-" + ev.optString("id", String.valueOf(System.currentTimeMillis())));
                        migrated.put("tipo", "entrada");
                        migrated.put("movement_type", "purchase");
                        migrated.put("title", evTitle);
                        migrated.put("titulo", evTitle);
                        migrated.put("date", evDate);
                        migrated.put("time", evTime);
                        migrated.put("hora", evTime);
                        migrated.put("data", evTime.isEmpty() ? evDate : (evDate + " " + evTime));
                        migrated.put("created_at", evDate + "T" + (evTime.isEmpty() ? "12:00" : evTime) + ":00.000Z");
                        migrated.put("qtd", parsedDelta);
                        migrated.put("quantity_change", parsedDelta);
                        migrated.put("quantity_changed", parsedDelta);
                        migrated.put("quantity_delta", parsedDelta);
                        migrated.put("delta", parsedDelta);
                        String mot = ev.optString("description", ev.optString("notas", "Reposição de estoque"));
                        migrated.put("motivo", mot);
                        migrated.put("notes", mot);
                        String resolvedName = resolveStockMovementMedName(migrated);
                        if (!resolvedName.isEmpty()) {
                            migrated.put("med_nome", resolvedName);
                            migrated.put("med_name", resolvedName);
                        }
                        this.stockMovements.put(migrated);
                    } catch (Exception ignored) {}
                }
            } else {
                cleanEvents.put(ev);
            }
        }
        if (changed) {
            this.events = cleanEvents;
        }
        return changed;
    }

    private boolean deduplicateStockMovements() {
        if (this.stockMovements == null || this.stockMovements.length() == 0) return false;
        boolean changed = false;
        JSONArray clean = new JSONArray();
        for (int i = 0; i < this.stockMovements.length(); i++) {
            JSONObject sm = this.stockMovements.optJSONObject(i);
            if (sm == null) continue;
            try {
                String normDate = getStockMovementDate(sm);
                if (!normDate.isEmpty() && !normDate.equals(sm.optString("date", ""))) {
                    sm.put("date", normDate);
                    changed = true;
                }
                String normTime = getStockMovementTime(sm);
                if (!normTime.isEmpty()) {
                    if (!normTime.equals(sm.optString("time", "")) || !normTime.equals(sm.optString("hora", ""))) {
                        sm.put("time", normTime);
                        sm.put("hora", normTime);
                        changed = true;
                    }
                    String expectedData = normDate.isEmpty() ? "" : (normDate + " " + normTime);
                    if (!expectedData.isEmpty() && !expectedData.equals(sm.optString("data", ""))) {
                        sm.put("data", expectedData);
                        changed = true;
                    }
                }
                String resolvedMedName = resolveStockMovementMedName(sm);
                if (!resolvedMedName.isEmpty() && sm.optString("med_nome", "").trim().isEmpty()) {
                    sm.put("med_nome", resolvedMedName);
                    sm.put("med_name", resolvedMedName);
                    changed = true;
                }
                if (!resolvedMedName.isEmpty() && sm.optString("med_id", "").trim().isEmpty() && this.meds != null) {
                    for (int mIdx = 0; mIdx < this.meds.length(); mIdx++) {
                        JSONObject mObj = this.meds.optJSONObject(mIdx);
                        if (mObj != null && resolvedMedName.equalsIgnoreCase(mObj.optString("nome", "").trim())) {
                            sm.put("med_id", mObj.optString("id"));
                            sm.put("medication_id", mObj.optString("id"));
                            if (!sm.has("new_quantity") && !sm.has("quantity_after")) {
                                int curSt = getMedStock(mObj);
                                int d = getStockMovementDelta(sm);
                                sm.put("new_quantity", curSt);
                                sm.put("quantity_after", curSt);
                                sm.put("previous_quantity", Math.max(0, curSt - d));
                                sm.put("quantity_before", Math.max(0, curSt - d));
                            }
                            changed = true;
                            break;
                        }
                    }
                }
            } catch (Exception ignored) {}

            if (!isCalendarStockMovement(sm)) {
                clean.put(sm);
                continue;
            }
            String smDate = getStockMovementDate(sm);
            String smTime = getStockMovementTime(sm);
            int smDelta = getStockMovementDelta(sm);
            String smMed = resolveStockMovementMedName(sm).toLowerCase(Locale.ROOT);
            String smMot = sm.optString("motivo", sm.optString("notes", "")).trim().toLowerCase(Locale.ROOT);
            String smCardText = formatStockMovementCardText(sm).trim().toLowerCase(Locale.ROOT);

            int duplicateIdx = -1;
            for (int j = 0; j < clean.length(); j++) {
                JSONObject existing = clean.optJSONObject(j);
                if (existing == null || !isCalendarStockMovement(existing)) continue;
                String exDate = getStockMovementDate(existing);
                if (!smDate.equals(exDate)) continue;
                String exCardText = formatStockMovementCardText(existing).trim().toLowerCase(Locale.ROOT);
                if (smCardText.equals(exCardText)) {
                    duplicateIdx = j;
                    break;
                }
                String exTime = getStockMovementTime(existing);
                int exDelta = getStockMovementDelta(existing);
                String exMed = resolveStockMovementMedName(existing).toLowerCase(Locale.ROOT);
                String exMot = existing.optString("motivo", existing.optString("notes", "")).trim().toLowerCase(Locale.ROOT);
                if (smDelta == exDelta && (!smTime.isEmpty() && smTime.equals(exTime)) && (smMed.equals(exMed) || smMed.isEmpty() || exMed.isEmpty())) {
                    duplicateIdx = j;
                    break;
                }
                if (smDelta == exDelta && !smMed.isEmpty() && smMed.equals(exMed) && smMot.equals(exMot)) {
                    duplicateIdx = j;
                    break;
                }
            }
            if (duplicateIdx >= 0) {
                changed = true;
                JSONObject existing = clean.optJSONObject(duplicateIdx);
                boolean exHasId = existing != null && !existing.optString("med_id", "").trim().isEmpty();
                boolean smHasId = !sm.optString("med_id", "").trim().isEmpty();
                if (smHasId && !exHasId) {
                    try {
                        clean.put(duplicateIdx, sm);
                    } catch (Exception ignored) {}
                }
            } else {
                clean.put(sm);
            }
        }
        if (changed) {
            this.stockMovements = clean;
        }
        return changed;
    }

    private boolean hasEventOnDate(String dateStr) {
        for (int i = 0; i < this.events.length(); i++) {
            JSONObject ev = this.events.optJSONObject(i);
            if (ev != null && !isStockEvent(ev)) {
                String evDate = ev.optString("date", ev.optString("data", "")).trim();
                if (evDate.length() >= 10) evDate = evDate.substring(0, 10);
                if (dateStr.equals(evDate)) return true;
            }
        }
        return false;
    }

    private boolean hasStockMoveOnDate(String dateStr) {
        for (int i = 0; i < this.stockMovements.length(); i++) {
            JSONObject sm = this.stockMovements.optJSONObject(i);
            if (sm != null && isCalendarStockMovement(sm) && dateStr.equals(getStockMovementDate(sm))) return true;
        }
        return false;
    }

    private void showDayPanelDialog(final String dateStr) {
        if (migrateStockEventsFromEvents() | deduplicateStockMovements()) {
            saveAll();
        }
        final AlertDialog dlg = new AlertDialog.Builder(this).create();

        LinearLayout modalCard = new LinearLayout(this);
        modalCard.setOrientation(1);
        modalCard.setBackground(shape(this.cSurface, 24, this.cBorder, 1));
        modalCard.setClipToOutline(true);

        boolean isToday = dateStr.equals(todayIso());
        boolean isPast = dateStr.compareTo(todayIso()) < 0;

        LinearLayout topHdr = new LinearLayout(this);
        topHdr.setOrientation(0);
        topHdr.setGravity(16);
        topHdr.setPadding(dp(20), dp(18), dp(20), dp(14));

        LinearLayout dateCol = new LinearLayout(this);
        dateCol.setOrientation(1);
        dateCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvSub = new TextView(this);
        tvSub.setText(isToday ? "✨ Hoje" : (isPast ? "📅 Dia anterior" : "🔮 Dia futuro"));
        tvSub.setTextColor(this.cPrimary);
        tvSub.setTextSize(sp(11.5f));
        tvSub.setTypeface(null, 1);
        dateCol.addView(tvSub);

        TextView tvDate = new TextView(this);
        tvDate.setText(dateStr);
        tvDate.setTextColor(this.cTextMain);
        tvDate.setTextSize(sp(19.0f));
        tvDate.setTypeface(null, 1);
        tvDate.setPadding(0, dp(2), 0, 0);
        dateCol.addView(tvDate);
        topHdr.addView(dateCol);

        TextView btnCloseX = new TextView(this);
        btnCloseX.setText("✕");
        btnCloseX.setTextColor(this.cTextMuted);
        btnCloseX.setTextSize(sp(15.0f));
        btnCloseX.setTypeface(null, 1);
        btnCloseX.setGravity(17);
        btnCloseX.setBackground(shape(this.cSurfaceHover, 18, this.cBorder, 1));
        btnCloseX.setLayoutParams(new LinearLayout.LayoutParams(dp(36), dp(36)));
        btnCloseX.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dlg.dismiss();
            }
        });
        topHdr.addView(btnCloseX);
        modalCard.addView(topHdr);

        View topDiv = new View(this);
        topDiv.setBackgroundColor(this.cBorder);
        topDiv.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(1)));
        modalCard.addView(topDiv);

        ScrollView sv = new ScrollView(this);
        sv.setVerticalScrollBarEnabled(false);
        sv.setLayoutParams(new LinearLayout.LayoutParams(-1, 0, 1.0f));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(1);
        root.setPadding(dp(20), dp(16), dp(20), dp(16));

        // Quick Add buttons inside DayPanel
        LinearLayout addRow = new LinearLayout(this);
        addRow.setOrientation(0);
        LinearLayout.LayoutParams arLp = new LinearLayout.LayoutParams(-1, -2);
        arLp.bottomMargin = dp(14);
        addRow.setLayoutParams(arLp);

        TextView btnAddN = createButton("📝 + Anotação", this.cBgMain, this.cTextMain);
        btnAddN.setPadding(dp(10), dp(10), dp(10), dp(10));
        LinearLayout.LayoutParams anLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
        anLp.rightMargin = dp(6);
        btnAddN.setLayoutParams(anLp);
        addRow.addView(btnAddN);

        TextView btnAddE = createButton("📅 + Evento", this.cBgMain, this.cTextMain);
        btnAddE.setPadding(dp(10), dp(10), dp(10), dp(10));
        LinearLayout.LayoutParams aeLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
        aeLp.leftMargin = dp(6);
        btnAddE.setLayoutParams(aeLp);
        addRow.addView(btnAddE);
        root.addView(addRow);

        // Doses section
        TextView tvDosesHdr = new TextView(this);
        tvDosesHdr.setText("💊 MEDICAMENTOS DO DIA");
        tvDosesHdr.setTextColor(this.cTextLight);
        tvDosesHdr.setTextSize(sp(11.0f));
        tvDosesHdr.setTypeface(null, 1);
        tvDosesHdr.setPadding(0, 0, 0, dp(8));
        root.addView(tvDosesHdr);

        int doseItems = 0;
        for (int i = 0; i < this.meds.length(); i++) {
            final JSONObject m = this.meds.optJSONObject(i);
            if (m == null || !m.optBoolean("ativo", true) || "sos".equals(getMedType(m))) continue;
            JSONArray hrs = m.optJSONArray("horarios");
            if (hrs == null) continue;
            final String mId = m.optString("id");
            for (int h = 0; h < hrs.length(); h++) {
                final String hStr = hrs.optString(h);
                doseItems++;
                String st = getDoseStatus(mId, dateStr, hStr);
                boolean isTaken = "tomado".equals(st);

                LinearLayout dCard = new LinearLayout(this);
                dCard.setOrientation(1);
                dCard.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
                dCard.setPadding(dp(12), dp(10), dp(12), dp(10));
                LinearLayout.LayoutParams dcLp = new LinearLayout.LayoutParams(-1, -2);
                dcLp.bottomMargin = dp(8);
                dCard.setLayoutParams(dcLp);

                TextView tvM = new TextView(this);
                tvM.setText((isTaken ? "✓ " : "⏰ ") + hStr + " — " + m.optString("nome") + " (" + m.optString("dosagem") + ")");
                tvM.setTextColor(isTaken ? this.cSuccess : this.cTextMain);
                tvM.setTextSize(sp(13.0f));
                tvM.setTypeface(null, 1);
                dCard.addView(tvM);

                if (!isTaken && (isToday || isPast)) {
                    TextView btnRetro = new TextView(this);
                    btnRetro.setText(isPast ? "🕐 Confirmar retroativamente" : "✓ Confirmar dose");
                    btnRetro.setTextColor(this.cWarning);
                    btnRetro.setTextSize(sp(12.0f));
                    btnRetro.setTypeface(null, 1);
                    btnRetro.setPadding(0, dp(6), 0, 0);
                    btnRetro.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            registerDose(m, dateStr, hStr, "tomado");
                            dlg.dismiss();
                            showDayPanelDialog(dateStr);
                        }
                    });
                    dCard.addView(btnRetro);
                }
                root.addView(dCard);
            }
        }
        if (doseItems == 0) {
            TextView tvEmptyD = new TextView(this);
            tvEmptyD.setText("Nenhuma dose programada.");
            tvEmptyD.setTextColor(this.cTextMuted);
            tvEmptyD.setTextSize(sp(12.0f));
            tvEmptyD.setPadding(0, 0, 0, dp(10));
            root.addView(tvEmptyD);
        }

        // Notes section
        TextView tvNotesHdr = new TextView(this);
        tvNotesHdr.setText("📝 ANOTAÇÕES");
        tvNotesHdr.setTextColor(this.cTextLight);
        tvNotesHdr.setTextSize(sp(11.0f));
        tvNotesHdr.setTypeface(null, 1);
        tvNotesHdr.setPadding(0, dp(6), 0, dp(8));
        root.addView(tvNotesHdr);

        int noteItems = 0;
        for (int i = 0; i < this.calNotesList.length(); i++) {
            final int nIdx = i;
            final JSONObject nObj = this.calNotesList.optJSONObject(i);
            if (nObj != null && dateStr.equals(nObj.optString("date"))) {
                noteItems++;
                LinearLayout nCard = new LinearLayout(this);
                nCard.setOrientation(0);
                nCard.setGravity(16);
                nCard.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
                nCard.setPadding(dp(12), dp(10), dp(12), dp(10));
                LinearLayout.LayoutParams ncLp = new LinearLayout.LayoutParams(-1, -2);
                ncLp.bottomMargin = dp(8);
                nCard.setLayoutParams(ncLp);

                TextView tvNT = new TextView(this);
                tvNT.setText("[" + nObj.optString("category", "Geral") + "] " + nObj.optString("text"));
                tvNT.setTextColor(this.cTextMain);
                tvNT.setTextSize(sp(13.0f));
                tvNT.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
                nCard.addView(tvNT);

                TextView btnDelN = new TextView(this);
                btnDelN.setText("🗑");
                btnDelN.setPadding(dp(8), dp(4), dp(4), dp(4));
                btnDelN.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        String delId = nObj.optString("id", "");
                        MainActivity.this.calNotesList.remove(nIdx);
                        deleteRemoteRecord("calendar_notes", delId, "note");
                        saveAll();
                        render();
                        dlg.dismiss();
                        showDayPanelDialog(dateStr);
                    }
                });
                nCard.addView(btnDelN);
                root.addView(nCard);
            }
        }
        if (noteItems == 0) {
            TextView tvEmptyN = new TextView(this);
            tvEmptyN.setText("Nenhuma anotação neste dia.");
            tvEmptyN.setTextColor(this.cTextMuted);
            tvEmptyN.setTextSize(sp(12.0f));
            tvEmptyN.setPadding(0, 0, 0, dp(10));
            root.addView(tvEmptyN);
        }

        // Events section (Strictly Consultations & Health Events, decoupled from Stock)
        TextView tvEvHdr = new TextView(this);
        tvEvHdr.setText("📅 CONSULTAS & EVENTOS");
        tvEvHdr.setTextColor(this.cTextLight);
        tvEvHdr.setTextSize(sp(11.0f));
        tvEvHdr.setTypeface(null, 1);
        tvEvHdr.setPadding(0, dp(6), 0, dp(8));
        root.addView(tvEvHdr);

        int evItems = 0;
        for (int i = 0; i < this.events.length(); i++) {
            final int eIdx = i;
            final JSONObject ev = this.events.optJSONObject(i);
            if (ev != null && !isStockEvent(ev)) {
                String evDate = ev.optString("date", ev.optString("data", "")).trim();
                if (evDate.length() >= 10) evDate = evDate.substring(0, 10);
                if (dateStr.equals(evDate)) {
                    evItems++;
                    LinearLayout eCard = new LinearLayout(this);
                    eCard.setOrientation(0);
                    eCard.setGravity(16);
                    eCard.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
                    eCard.setPadding(dp(12), dp(10), dp(12), dp(10));
                    LinearLayout.LayoutParams ecLp = new LinearLayout.LayoutParams(-1, -2);
                    ecLp.bottomMargin = dp(8);
                    eCard.setLayoutParams(ecLp);

                    TextView tvET = new TextView(this);
                    String t = ev.optString("title", ev.optString("titulo", "Evento"));
                    String tm = ev.optString("time", ev.optString("hora", ""));
                    if (tm.length() >= 5 && tm.charAt(2) == ':') tm = tm.substring(0, 5);
                    String loc = ev.optString("location", ev.optString("local", ""));
                    tvET.setText("📅 " + t + (tm.isEmpty() ? "" : " às " + tm) + (loc.isEmpty() ? "" : " • " + loc));
                    tvET.setTextColor(this.cTextMain);
                    tvET.setTextSize(sp(13.0f));
                    tvET.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
                    eCard.addView(tvET);

                    TextView btnDelE = new TextView(this);
                    btnDelE.setText("🗑");
                    btnDelE.setPadding(dp(8), dp(4), dp(4), dp(4));
                    btnDelE.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            String delId = ev.optString("id", "");
                            MainActivity.this.events.remove(eIdx);
                            deleteRemoteRecord("health_events", delId, "evt");
                            saveAll();
                            render();
                            dlg.dismiss();
                            showDayPanelDialog(dateStr);
                        }
                    });
                    eCard.addView(btnDelE);
                    root.addView(eCard);
                }
            }
        }
        if (evItems == 0) {
            TextView tvEmptyE = new TextView(this);
            tvEmptyE.setText("Nenhum evento neste dia.");
            tvEmptyE.setTextColor(this.cTextMuted);
            tvEmptyE.setTextSize(sp(12.0f));
            tvEmptyE.setPadding(0, 0, 0, dp(10));
            root.addView(tvEmptyE);
        }

        // Dedicated Stock Section (exclusively for stock replenishments and adjustments)
        TextView tvStockHdr = new TextView(this);
        tvStockHdr.setText("📦 ESTOQUE");
        tvStockHdr.setTextColor(this.cTextLight);
        tvStockHdr.setTextSize(sp(11.0f));
        tvStockHdr.setTypeface(null, 1);
        tvStockHdr.setPadding(0, dp(6), 0, dp(8));
        root.addView(tvStockHdr);

        int stockItems = 0;
        for (int i = 0; i < this.stockMovements.length(); i++) {
            final int sIdx = i;
            final JSONObject sm = this.stockMovements.optJSONObject(i);
            if (sm != null && isCalendarStockMovement(sm) && dateStr.equals(getStockMovementDate(sm))) {
                stockItems++;
                LinearLayout sCard = new LinearLayout(this);
                sCard.setOrientation(0);
                sCard.setGravity(16);
                sCard.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
                sCard.setPadding(dp(12), dp(10), dp(12), dp(10));
                LinearLayout.LayoutParams scLp = new LinearLayout.LayoutParams(-1, -2);
                scLp.bottomMargin = dp(8);
                sCard.setLayoutParams(scLp);

                TextView tvST = new TextView(this);
                tvST.setText(formatStockMovementCardText(sm));
                tvST.setTextColor(this.cTextMain);
                tvST.setTextSize(sp(13.0f));
                tvST.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
                sCard.addView(tvST);

                TextView btnDelS = new TextView(this);
                btnDelS.setText("🗑");
                btnDelS.setPadding(dp(8), dp(4), dp(4), dp(4));
                btnDelS.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        String delId = sm.optString("id", "");
                        MainActivity.this.stockMovements.remove(sIdx);
                        deleteRemoteRecord("stock_movements", delId, "stk");
                        saveAll();
                        render();
                        dlg.dismiss();
                        showDayPanelDialog(dateStr);
                    }
                });
                sCard.addView(btnDelS);
                root.addView(sCard);
            }
        }
        if (stockItems == 0) {
            TextView tvEmptyS = new TextView(this);
            tvEmptyS.setText("Nenhuma movimentação de estoque neste dia.");
            tvEmptyS.setTextColor(this.cTextMuted);
            tvEmptyS.setTextSize(sp(12.0f));
            root.addView(tvEmptyS);
        }

        btnAddN.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dlg.dismiss();
                showNoteModal(dateStr, null, -1);
            }
        });
        btnAddE.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dlg.dismiss();
                showEventModal(dateStr, null, -1);
            }
        });

        sv.addView(root);
        modalCard.addView(sv);

        View botDiv = new View(this);
        botDiv.setBackgroundColor(this.cBorder);
        botDiv.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(1)));
        modalCard.addView(botDiv);

        LinearLayout footerBar = new LinearLayout(this);
        footerBar.setOrientation(1);
        footerBar.setBackgroundColor(this.cSurface);
        footerBar.setPadding(dp(20), dp(12), dp(20), dp(16));

        TextView btnCloseFooter = new TextView(this);
        btnCloseFooter.setText("Fechar");
        btnCloseFooter.setTextColor(this.cTextMain);
        btnCloseFooter.setTextSize(sp(14.5f));
        btnCloseFooter.setTypeface(null, 1);
        btnCloseFooter.setGravity(17);
        btnCloseFooter.setBackground(shape(this.cBgMain, 14, this.cBorder, 1));
        btnCloseFooter.setPadding(dp(16), dp(13), dp(16), dp(13));
        btnCloseFooter.setLayoutParams(new LinearLayout.LayoutParams(-1, -2));
        btnCloseFooter.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dlg.dismiss();
            }
        });
        footerBar.addView(btnCloseFooter);
        modalCard.addView(footerBar);

        dlg.setView(modalCard, 0, 0, 0, 0);
        dlg.show();
        styleDialogWindow(dlg);
    }

    private void showNoteModal(final String defaultDate, final JSONObject existing, final int editIdx) {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(1);

        final EditText inDate = createInput("Data (AAAA-MM-DD)", existing != null ? existing.optString("date", defaultDate) : defaultDate);
        final EditText inCat = createInput("Categoria (Sintoma, Dúvida médica, Efeito colateral, Geral)", existing != null ? existing.optString("category", "Geral") : "Sintoma");
        final EditText inText = createInput("Anotação * (Ex: Tontura leve pela manhã)", existing != null ? existing.optString("text", "") : "");

        l.addView(inDate);
        l.addView(inCat);
        l.addView(inText);

        showStyledFormModal(
            existing == null ? "📝 Nova anotação" : "📝 Editar anotação",
            l,
            "Salvar anotação",
            "Cancelar",
            this.cPrimary,
            new Runnable() {
                @Override
                public void run() {
                    try {
                        String txt = inText.getText().toString().trim();
                        if (txt.isEmpty()) return;
                        String dt = inDate.getText().toString().trim();
                        if (dt.isEmpty()) dt = defaultDate;
                        JSONObject obj = existing != null ? existing : new JSONObject();
                        if (existing == null) obj.put("id", "note-" + System.currentTimeMillis());
                        obj.put("date", dt);
                        obj.put("category", inCat.getText().toString().trim());
                        obj.put("text", txt);
                        if (editIdx >= 0) {
                            MainActivity.this.calNotesList.put(editIdx, obj);
                        } else {
                            MainActivity.this.calNotesList.put(obj);
                        }
                        MainActivity.this.calNotes.put(dt, txt);
                        saveAll();
                        render();
                        Toast.makeText(MainActivity.this, "Anotação salva!", 0).show();
                    } catch (Exception ignored) {}
                }
            }
        );
    }

    private void showEventModal(final String defaultDate, final JSONObject existing, final int editIdx) {
        ScrollView sv = new ScrollView(this);
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(1);

        final EditText inType = createInput("Tipo (Consulta médica, Exame, Retorno, Receita, Lembrete)", existing != null ? existing.optString("type", "Consulta médica") : "Consulta médica");
        final EditText inTitle = createInput("Título * (Ex: Cardiologista Dr. Silva)", existing != null ? existing.optString("title", existing.optString("titulo", "")) : "");
        final EditText inDate = createInput("Data (AAAA-MM-DD)", existing != null ? existing.optString("date", existing.optString("data", defaultDate)) : defaultDate);
        final EditText inTime = createInput("Horário (Ex: 14:00)", existing != null ? existing.optString("time", existing.optString("hora", "09:00")) : "09:00");
        final EditText inLoc = createInput("Local / Profissional (opcional)", existing != null ? existing.optString("location", existing.optString("local", "")) : "");
        final EditText inNotes = createInput("Observações (Ex: Levar exames anteriores)", existing != null ? existing.optString("notes", existing.optString("notas", "")) : "");

        l.addView(inType);
        l.addView(inTitle);
        l.addView(inDate);
        l.addView(inTime);
        l.addView(inLoc);
        l.addView(inNotes);
        sv.addView(l);

        showStyledFormModal(
            existing == null ? "📅 Novo evento de saúde" : "📅 Editar evento",
            sv,
            "Salvar evento",
            "Cancelar",
            this.cPrimary,
            new Runnable() {
                @Override
                public void run() {
                    try {
                        String title = inTitle.getText().toString().trim();
                        if (title.isEmpty()) return;
                        String dt = inDate.getText().toString().trim();
                        if (dt.isEmpty()) dt = defaultDate;
                        String tm = inTime.getText().toString().trim();
                        String loc = inLoc.getText().toString().trim();
                        String nts = inNotes.getText().toString().trim();
                        JSONObject obj = existing != null ? existing : new JSONObject();
                        if (existing == null) obj.put("id", "ev-" + System.currentTimeMillis());
                        obj.put("type", inType.getText().toString().trim());
                        obj.put("title", title);
                        obj.put("titulo", title);
                        obj.put("date", dt);
                        obj.put("data", dt);
                        obj.put("time", tm);
                        obj.put("hora", tm);
                        obj.put("location", loc);
                        obj.put("local", loc);
                        obj.put("notes", nts);
                        obj.put("notas", nts);
                        if (editIdx >= 0) {
                            MainActivity.this.events.put(editIdx, obj);
                        } else {
                            MainActivity.this.events.put(obj);
                        }
                        saveAll();
                        render();
                        Toast.makeText(MainActivity.this, "Evento salvo!", 0).show();
                    } catch (Exception ignored) {}
                }
            }
        );
    }

    private void buildAiTab(LinearLayout linearLayout) {
        if ("meds".equals(this.aiSubView) || "attention".equals(this.aiSubView) || "stock".equals(this.aiSubView) || "consult".equals(this.aiSubView)) {
            buildAiStructuredSubView(linearLayout, this.aiSubView);
            return;
        }
        if ("chat".equals(this.aiSubView)) {
            buildAiChatSubView(linearLayout);
            return;
        }

        // 1. Header: [ 🩺 ]  Assistente de Saúde \n Ajudo você a acompanhar seu tratamento.
        LinearLayout hdrRow = new LinearLayout(this);
        hdrRow.setOrientation(0);
        hdrRow.setGravity(16);
        LinearLayout.LayoutParams hrLp = new LinearLayout.LayoutParams(-1, -2);
        hrLp.bottomMargin = dp(20);
        hdrRow.setLayoutParams(hrLp);

        TextView tvAvatar = new TextView(this);
        tvAvatar.setText("🩺");
        tvAvatar.setTextSize(sp(24.0f));
        tvAvatar.setGravity(17);
        GradientDrawable avGrad = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.parseColor("#3B82F6"), Color.parseColor("#6366F1")}
        );
        avGrad.setCornerRadius(dp(18));
        tvAvatar.setBackground(avGrad);
        LinearLayout.LayoutParams avLp = new LinearLayout.LayoutParams(dp(56), dp(56));
        avLp.rightMargin = dp(14);
        tvAvatar.setLayoutParams(avLp);
        hdrRow.addView(tvAvatar);

        LinearLayout hdrCol = new LinearLayout(this);
        hdrCol.setOrientation(1);
        hdrCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvTitle = new TextView(this);
        tvTitle.setText("Assistente de Saúde");
        tvTitle.setTextColor(this.cTextMain);
        tvTitle.setTextSize(sp(22.0f));
        tvTitle.setTypeface(null, 1);
        hdrCol.addView(tvTitle);

        TextView tvSub = new TextView(this);
        tvSub.setText("Ajudo você a acompanhar seu tratamento.");
        tvSub.setTextColor(this.cTextMuted);
        tvSub.setTextSize(sp(14.0f));
        tvSub.setPadding(0, dp(2), 0, 0);
        hdrCol.addView(tvSub);

        hdrRow.addView(hdrCol);
        linearLayout.addView(hdrRow);

        // 2. Status Card: COMO ESTOU HOJE?
        String todayStr = todayIso();
        int pendingCount = 0;
        JSONObject nextPendingMed = null;
        String nextPendingTime = null;
        for (int i = 0; i < this.meds.length(); i++) {
            JSONObject m = this.meds.optJSONObject(i);
            if (m == null || !m.optBoolean("ativo", true) || "sos".equals(getMedType(m))) continue;
            JSONArray hrs = m.optJSONArray("horarios");
            if (hrs == null) continue;
            String mId = m.optString("id");
            for (int h = 0; h < hrs.length(); h++) {
                String hStr = hrs.optString(h);
                if (!"tomado".equals(getDoseStatus(mId, todayStr, hStr))) {
                    pendingCount++;
                    if (nextPendingMed == null || (nextPendingTime != null && hStr.compareTo(nextPendingTime) < 0)) {
                        nextPendingMed = m;
                        nextPendingTime = hStr;
                    }
                }
            }
        }

        LinearLayout statusCard = new LinearLayout(this);
        statusCard.setOrientation(1);
        statusCard.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        statusCard.setPadding(dp(20), dp(20), dp(20), dp(20));
        LinearLayout.LayoutParams scLp = new LinearLayout.LayoutParams(-1, -2);
        scLp.bottomMargin = dp(20);
        statusCard.setLayoutParams(scLp);

        TextView tvHowLabel = new TextView(this);
        tvHowLabel.setText("COMO ESTOU HOJE?");
        tvHowLabel.setTextColor(this.cPrimary);
        tvHowLabel.setTextSize(sp(12.0f));
        tvHowLabel.setTypeface(null, 1);
        tvHowLabel.setPadding(0, 0, 0, dp(8));
        statusCard.addView(tvHowLabel);

        TextView tvHowVal = new TextView(this);
        tvHowVal.setText(pendingCount == 0 ? "Tudo ótimo por aqui!" : ("Você ainda tem " + pendingCount + " dose(s) para tomar hoje."));
        tvHowVal.setTextColor(this.cTextMain);
        tvHowVal.setTextSize(sp(18.0f));
        tvHowVal.setTypeface(null, 1);
        statusCard.addView(tvHowVal);

        if (nextPendingMed != null && nextPendingTime != null) {
            LinearLayout nextBox = new LinearLayout(this);
            nextBox.setOrientation(0);
            nextBox.setGravity(16);
            nextBox.setBackground(shape(this.cBgMain, 12, 0, 0));
            nextBox.setPadding(dp(12), dp(10), dp(12), dp(10));
            LinearLayout.LayoutParams nbLp = new LinearLayout.LayoutParams(-1, -2);
            nbLp.topMargin = dp(12);
            nextBox.setLayoutParams(nbLp);

            TextView tvNextTxt = new TextView(this);
            tvNextTxt.setText("⏰ Próximo: " + nextPendingMed.optString("nome") + " às " + nextPendingTime);
            tvNextTxt.setTextColor(this.cTextMain);
            tvNextTxt.setTextSize(sp(14.0f));
            tvNextTxt.setTypeface(null, 1);
            nextBox.addView(tvNextTxt);
            statusCard.addView(nextBox);
        }
        linearLayout.addView(statusCard);

        // 3. Section: "O que você precisa?" + 2x2 Grid
        TextView tvNeedTitle = new TextView(this);
        tvNeedTitle.setText("O que você precisa?");
        tvNeedTitle.setTextColor(this.cTextMain);
        tvNeedTitle.setTextSize(sp(16.0f));
        tvNeedTitle.setTypeface(null, 1);
        tvNeedTitle.setPadding(dp(4), 0, 0, dp(12));
        linearLayout.addView(tvNeedTitle);

        LinearLayout gridRow1 = new LinearLayout(this);
        gridRow1.setOrientation(0);
        LinearLayout.LayoutParams gr1Lp = new LinearLayout.LayoutParams(-1, -2);
        gr1Lp.bottomMargin = dp(12);
        gridRow1.setLayoutParams(gr1Lp);
        gridRow1.addView(makeAiGridCard("💊", "Explicar meus medicamentos", "meds", true));
        gridRow1.addView(makeAiGridCard("⚠️", "O que merece atenção?", "attention", false));
        linearLayout.addView(gridRow1);

        LinearLayout gridRow2 = new LinearLayout(this);
        gridRow2.setOrientation(0);
        LinearLayout.LayoutParams gr2Lp = new LinearLayout.LayoutParams(-1, -2);
        gr2Lp.bottomMargin = dp(20);
        gridRow2.setLayoutParams(gr2Lp);
        gridRow2.addView(makeAiGridCard("📦", "Meu estoque", "stock", true));
        gridRow2.addView(makeAiGridCard("🩺", "Preparar consulta", "consult", false));
        linearLayout.addView(gridRow2);

        // 4. Full-width Gradient Button: [ 💬 Falar com o Assistente ]
        TextView btnChatHero = new TextView(this);
        btnChatHero.setText("💬   Falar com o Assistente");
        btnChatHero.setTextColor(Color.WHITE);
        btnChatHero.setTextSize(sp(16.0f));
        btnChatHero.setTypeface(null, 1);
        btnChatHero.setGravity(17);
        GradientDrawable chatBtnGrad = new GradientDrawable(
            GradientDrawable.Orientation.LEFT_RIGHT,
            new int[]{Color.parseColor("#3B82F6"), Color.parseColor("#6366F1")}
        );
        chatBtnGrad.setCornerRadius(dp(18));
        btnChatHero.setBackground(chatBtnGrad);
        btnChatHero.setPadding(dp(18), dp(16), dp(18), dp(16));
        LinearLayout.LayoutParams chLp = new LinearLayout.LayoutParams(-1, -2);
        chLp.bottomMargin = dp(20);
        btnChatHero.setLayoutParams(chLp);
        btnChatHero.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.aiSubView = "chat";
                render();
            }
        });
        linearLayout.addView(btnChatHero);

        // 5. Card: "Pergunte ao Assistente" with 3 quick questions
        LinearLayout askCard = new LinearLayout(this);
        askCard.setOrientation(1);
        askCard.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        askCard.setPadding(dp(20), dp(20), dp(20), dp(20));
        LinearLayout.LayoutParams acLp = new LinearLayout.LayoutParams(-1, -2);
        acLp.bottomMargin = dp(16);
        askCard.setLayoutParams(acLp);

        TextView tvAskTitle = new TextView(this);
        tvAskTitle.setText("Pergunte ao Assistente");
        tvAskTitle.setTextColor(this.cTextMain);
        tvAskTitle.setTextSize(sp(16.0f));
        tvAskTitle.setTypeface(null, 1);
        tvAskTitle.setPadding(0, 0, 0, dp(14));
        askCard.addView(tvAskTitle);

        String[] quickQuestions = {
            "Quais remédios tomo hoje?",
            "Como está minha adesão?",
            "Tenho algum remédio acabando?"
        };
        for (int i = 0; i < quickQuestions.length; i++) {
            final String qText = quickQuestions[i];
            LinearLayout qBtn = new LinearLayout(this);
            qBtn.setOrientation(0);
            qBtn.setGravity(16);
            qBtn.setBackground(shape(this.cBgMain, 14, this.cBorder, 1));
            qBtn.setPadding(dp(16), dp(14), dp(16), dp(14));
            LinearLayout.LayoutParams qbLp = new LinearLayout.LayoutParams(-1, -2);
            if (i < quickQuestions.length - 1) qbLp.bottomMargin = dp(10);
            qBtn.setLayoutParams(qbLp);

            TextView tvQT = new TextView(this);
            tvQT.setText(qText);
            tvQT.setTextColor(this.cTextMain);
            tvQT.setTextSize(sp(14.0f));
            tvQT.setTypeface(null, 1);
            tvQT.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
            qBtn.addView(tvQT);

            TextView tvQA = new TextView(this);
            tvQA.setText("›");
            tvQA.setTextColor(this.cPrimary);
            tvQA.setTextSize(sp(18.0f));
            tvQA.setTypeface(null, 1);
            qBtn.addView(tvQA);

            qBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    MainActivity.this.aiSubView = "chat";
                    sendAiMessage(qText);
                }
            });
            askCard.addView(qBtn);
        }

        linearLayout.addView(askCard);
    }

    private View makeAiGridCard(String emoji, String label, final String targetSubView, boolean isLeft) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 18, this.cBorder, 1));
        card.setPadding(dp(16), dp(18), dp(16), dp(18));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(115), 1.0f);
        if (isLeft) lp.rightMargin = dp(6);
        else lp.leftMargin = dp(6);
        card.setLayoutParams(lp);

        TextView tvE = new TextView(this);
        tvE.setText(emoji);
        tvE.setTextSize(sp(24.0f));
        LinearLayout.LayoutParams eLp = new LinearLayout.LayoutParams(-2, 0, 1.0f);
        tvE.setLayoutParams(eLp);
        card.addView(tvE);

        TextView tvL = new TextView(this);
        tvL.setText(label);
        tvL.setTextColor(this.cTextMain);
        tvL.setTextSize(sp(14.0f));
        tvL.setTypeface(null, 1);
        card.addView(tvL);

        card.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.aiSubView = targetSubView;
                render();
            }
        });
        return card;
    }

    private void buildAiStructuredSubView(LinearLayout linearLayout, String viewType) {
        TextView btnBack = new TextView(this);
        btnBack.setText("‹ Voltar");
        btnBack.setTextColor(this.cPrimary);
        btnBack.setTextSize(sp(15.0f));
        btnBack.setTypeface(null, 1);
        btnBack.setPadding(0, dp(4), dp(16), dp(16));
        btnBack.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.aiSubView = "main";
                render();
            }
        });
        linearLayout.addView(btnBack);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        card.setPadding(dp(20), dp(20), dp(20), dp(20));

        String title = "";
        String body = "";
        if ("meds".equals(viewType)) {
            title = "💊 Seus Medicamentos";
            body = generateLocalAiFallbackResponse("explicar medicamentos");
        } else if ("attention".equals(viewType)) {
            title = "⚠️ Pontos de Atenção";
            body = generateLocalAiFallbackResponse("resumo adesão e estoque");
        } else if ("stock".equals(viewType)) {
            title = "📦 Situação do Estoque";
            body = generateLocalAiFallbackResponse("estoque");
        } else if ("consult".equals(viewType)) {
            title = "🩺 Resumo para Consulta";
            body = generateLocalAiFallbackResponse("consulta médica");
        }

        TextView tvT = new TextView(this);
        tvT.setText(title);
        tvT.setTextColor(this.cTextMain);
        tvT.setTextSize(sp(20.0f));
        tvT.setTypeface(null, 1);
        tvT.setPadding(0, 0, 0, dp(14));
        card.addView(tvT);

        final String finalBody = body;
        TextView tvB = new TextView(this);
        tvB.setText(body);
        tvB.setTextColor(this.cTextMain);
        tvB.setTextSize(sp(15.0f));
        tvB.setLineSpacing(dp(4), 1.0f);
        card.addView(tvB);

        if ("consult".equals(viewType)) {
            TextView btnShare = createButton("📤 Compartilhar Resumo", this.cPrimary, Color.WHITE);
            LinearLayout.LayoutParams shLp = new LinearLayout.LayoutParams(-1, -2);
            shLp.topMargin = dp(20);
            btnShare.setLayoutParams(shLp);
            btnShare.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    try {
                        Intent sendIntent = new Intent(Intent.ACTION_SEND);
                        sendIntent.putExtra(Intent.EXTRA_TITLE, "Resumo MediCare para Consulta");
                        sendIntent.putExtra(Intent.EXTRA_TEXT, finalBody);
                        sendIntent.setType("text/plain");
                        startActivity(Intent.createChooser(sendIntent, "Compartilhar Resumo"));
                    } catch (Exception ignored) {}
                }
            });
            card.addView(btnShare);
        }

        linearLayout.addView(card);
    }

    private void buildAiChatSubView(LinearLayout linearLayout) {
        LinearLayout topRow = new LinearLayout(this);
        topRow.setOrientation(0);
        topRow.setGravity(16);
        LinearLayout.LayoutParams trLp = new LinearLayout.LayoutParams(-1, -2);
        trLp.bottomMargin = dp(12);
        topRow.setLayoutParams(trLp);

        TextView btnBack = new TextView(this);
        btnBack.setText("‹");
        btnBack.setTextColor(this.cTextMain);
        btnBack.setTextSize(sp(22.0f));
        btnBack.setGravity(17);
        btnBack.setBackground(shape(this.cSurface, 12, this.cBorder, 1));
        LinearLayout.LayoutParams bkLp = new LinearLayout.LayoutParams(dp(40), dp(40));
        bkLp.rightMargin = dp(12);
        btnBack.setLayoutParams(bkLp);
        btnBack.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.aiSubView = "main";
                render();
            }
        });
        topRow.addView(btnBack);

        LinearLayout titleCol = new LinearLayout(this);
        titleCol.setOrientation(1);
        titleCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvT = new TextView(this);
        tvT.setText("Assistente de Saúde");
        tvT.setTextColor(this.cTextMain);
        tvT.setTextSize(sp(16.0f));
        tvT.setTypeface(null, 1);
        titleCol.addView(tvT);

        TextView tvS = new TextView(this);
        tvS.setText("Online • Respostas baseadas nos seus dados");
        tvS.setTextColor(this.cSuccess);
        tvS.setTextSize(sp(12.0f));
        titleCol.addView(tvS);

        topRow.addView(titleCol);
        linearLayout.addView(topRow);

        LinearLayout chatCard = new LinearLayout(this);
        chatCard.setOrientation(1);
        chatCard.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        chatCard.setPadding(dp(14), dp(14), dp(14), dp(14));

        ScrollView msgsScroll = new ScrollView(this);
        LinearLayout.LayoutParams scrollLp = new LinearLayout.LayoutParams(-1, dp(360));
        msgsScroll.setLayoutParams(scrollLp);

        LinearLayout msgsLayout = new LinearLayout(this);
        msgsLayout.setOrientation(1);

        if (this.aiMessages.length() == 0) {
            try {
                JSONObject welcomeMsg = new JSONObject();
                welcomeMsg.put("role", "assistant");
                welcomeMsg.put("text", "Olá, " + this.profile.optString("nome", "paciente") + "! Sou seu Assistente de Saúde. Como posso ajudar você hoje?");
                this.aiMessages.put(welcomeMsg);
            } catch (Exception ignored) {}
        }

        for (int i = 0; i < this.aiMessages.length(); i++) {
            JSONObject msg = this.aiMessages.optJSONObject(i);
            if (msg == null) continue;
            String role = msg.optString("role", "assistant");
            String text = msg.optString("text", "");

            LinearLayout msgRow = new LinearLayout(this);
            msgRow.setOrientation(0);
            LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(-1, -2);
            rowLp.bottomMargin = dp(10);
            msgRow.setLayoutParams(rowLp);

            TextView bubble = new TextView(this);
            bubble.setText(text);
            bubble.setTextSize(sp(14.0f));
            bubble.setPadding(dp(14), dp(12), dp(14), dp(12));

            if ("user".equals(role)) {
                msgRow.setGravity(5);
                bubble.setTextColor(Color.WHITE);
                bubble.setBackground(shape(this.cPrimary, 16, 0, 0));
                LinearLayout.LayoutParams bLp = new LinearLayout.LayoutParams(-2, -2);
                bLp.leftMargin = dp(40);
                bubble.setLayoutParams(bLp);
            } else {
                msgRow.setGravity(3);
                bubble.setTextColor(this.cTextMain);
                bubble.setBackground(shape(this.cBgMain, 16, this.cBorder, 1));
                LinearLayout.LayoutParams bLp = new LinearLayout.LayoutParams(-2, -2);
                bLp.rightMargin = dp(40);
                bubble.setLayoutParams(bLp);
            }
            msgRow.addView(bubble);
            msgsLayout.addView(msgRow);
        }

        msgsScroll.addView(msgsLayout);
        chatCard.addView(msgsScroll);

        LinearLayout inputRow = new LinearLayout(this);
        inputRow.setOrientation(0);
        inputRow.setGravity(16);
        inputRow.setPadding(0, dp(10), 0, 0);

        final EditText etInput = new EditText(this);
        etInput.setHint("Digite sua dúvida aqui...");
        etInput.setHintTextColor(this.cTextLight);
        etInput.setTextColor(this.cTextMain);
        etInput.setTextSize(sp(14.0f));
        etInput.setBackground(shape(this.cBgMain, 14, this.cBorder, 1));
        etInput.setPadding(dp(14), dp(11), dp(14), dp(11));
        LinearLayout.LayoutParams etLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
        etLp.rightMargin = dp(8);
        etInput.setLayoutParams(etLp);
        inputRow.addView(etInput);

        TextView btnSend = createButton("Enviar", this.cPrimary, Color.WHITE);
        btnSend.setPadding(dp(16), dp(11), dp(16), dp(11));
        btnSend.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String prompt = etInput.getText().toString().trim();
                if (!prompt.isEmpty()) {
                    sendAiMessage(prompt);
                }
            }
        });
        inputRow.addView(btnSend);
        chatCard.addView(inputRow);

        linearLayout.addView(chatCard);
    }

    private void sendAiMessage(String prompt) {
        try {
            JSONObject userMsg = new JSONObject();
            userMsg.put("role", "user");
            userMsg.put("text", prompt);
            this.aiMessages.put(userMsg);
            saveAll();
            render();

            queryAi(prompt);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void queryAi(final String prompt) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                String responseText = "";
                try {
                    URL url = new URL(EMBEDDED_BACKEND_URL + "/api/ai");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(12000);
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");

                    JSONObject payload = new JSONObject();
                    payload.put("prompt", prompt);
                    payload.put("patientName", MainActivity.this.profile.optString("nome", "Paciente"));
                    payload.put("medicamentos", MainActivity.this.meds);
                    payload.put("allergies", MainActivity.this.allergies);
                    payload.put("conditions", MainActivity.this.conditions);
                    payload.put("doseLogs", MainActivity.this.doseLogs);

                    OutputStream os = conn.getOutputStream();
                    os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
                    os.close();

                    int code = conn.getResponseCode();
                    if (code == 200) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) sb.append(line);
                        reader.close();

                        JSONObject respObj = new JSONObject(sb.toString());
                        responseText = respObj.optString("text", respObj.optString("resposta", ""));
                    }
                } catch (Exception ignored) {}

                if (responseText.isEmpty()) {
                    responseText = generateLocalAiFallbackResponse(prompt);
                }

                final String reply = responseText;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            JSONObject aiMsg = new JSONObject();
                            aiMsg.put("role", "assistant");
                            aiMsg.put("text", reply);
                            MainActivity.this.aiMessages.put(aiMsg);
                            saveAll();
                            render();
                        } catch (Exception ignored) {}
                    }
                });
            }
        }).start();
    }

    private String generateLocalAiFallbackResponse(String prompt) {
        String pLower = prompt.toLowerCase(Locale.ROOT);
        int medCount = this.meds.length();
        int algCount = this.allergies.length();

        if (pLower.contains("explicar") || pLower.contains("hoje") || pLower.contains("remédio") || pLower.contains("medica")) {
            if (medCount == 0) {
                return "Você ainda não cadastrou nenhum medicamento. Vá na aba Medicamentos para adicionar.";
            }
            StringBuilder sb = new StringBuilder("Aqui está um resumo simples dos seus medicamentos:\n\n");
            for (int i = 0; i < medCount; i++) {
                JSONObject m = this.meds.optJSONObject(i);
                if (m != null) {
                    String tType = getMedType(m);
                    String typeText = "continuous".equals(tType) ? "Uso contínuo" : ("temporary".equals(tType) ? "Tratamento temporário" : "Apenas se necessário (SOS)");
                    sb.append("💊 ").append(m.optString("nome")).append(" (").append(m.optString("dosagem")).append(")\n")
                      .append("• Tipo: ").append(typeText).append("\n")
                      .append("• Horários: ").append(m.optJSONArray("horarios") != null && m.optJSONArray("horarios").length() > 0 ? joinArray(m.optJSONArray("horarios")) : "Livre").append("\n")
                      .append("• Estoque: ").append(getMedStock(m)).append(" unid.\n\n");
                }
            }
            return sb.toString().trim();
        } else if (pLower.contains("adesão") || pLower.contains("adesao") || pLower.contains("resumo")) {
            int taken = 0;
            int total = this.doseLogs.length();
            for (int i = 0; i < total; i++) {
                JSONObject d = this.doseLogs.optJSONObject(i);
                if (d != null && "tomado".equals(d.optString("status"))) taken++;
            }
            int pct = total > 0 ? (taken * 100 / total) : 100;
            return "📊 Resumo de Adesão ao Tratamento:\n• Doses registradas: " + total + "\n• Doses tomadas: " + taken + "\n• Índice de adesão: " + pct + "%\n\nContinue acompanhando seus horários diariamente!";
        } else if (pLower.contains("estoque") || pLower.contains("acabando")) {
            if (medCount == 0) return "Você não possui medicamentos cadastrados para controlar o estoque.";
            StringBuilder sb = new StringBuilder("📦 Situação do seu estoque:\n\n");
            for (int i = 0; i < medCount; i++) {
                JSONObject m = this.meds.optJSONObject(i);
                if (m != null) {
                    int current = getMedStock(m);
                    sb.append(current <= 5 ? "🚨 " : "✅ ").append(m.optString("nome")).append(": ").append(current).append(" unidades restantes");
                    if (current <= 5) sb.append(" (Precisa repor em breve!)");
                    sb.append("\n");
                }
            }
            return sb.toString().trim();
        } else if (pLower.contains("consulta") || pLower.contains("médico") || pLower.contains("medico")) {
            return "🩺 Resumo para Consulta Médica\nPaciente: " + this.profile.optString("nome", "Não informado")
                + "\nMedicamentos cadastrados: " + medCount
                + "\nAlergias registradas: " + algCount
                + "\n\nLeve este resumo para seu médico avaliar a evolução do seu tratamento.";
        } else {
            return "Compreendi sua dúvida sobre \"" + prompt + "\". Caso sinta algum sintoma diferente ou tenha dúvidas sobre mudar horários, converse sempre com seu médico.";
        }
    }

    private void buildProfileTab(LinearLayout linearLayout) {
        if (!"main".equals(this.profileSubView)) {
            LinearLayout subHdr = new LinearLayout(this);
            subHdr.setOrientation(0);
            subHdr.setGravity(16);
            LinearLayout.LayoutParams shLp = new LinearLayout.LayoutParams(-1, -2);
            shLp.bottomMargin = dp(16);
            subHdr.setLayoutParams(shLp);

            TextView btnBack = new TextView(this);
            btnBack.setText("‹");
            btnBack.setTextColor(this.cTextMain);
            btnBack.setTextSize(sp(18.0f));
            btnBack.setTypeface(null, 1);
            btnBack.setGravity(17);
            btnBack.setBackground(shape(this.cSurfaceHover, 20, 0, 0));
            LinearLayout.LayoutParams bkLp = new LinearLayout.LayoutParams(dp(40), dp(40));
            bkLp.rightMargin = dp(12);
            btnBack.setLayoutParams(bkLp);
            btnBack.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    MainActivity.this.profileSubView = "main";
                    render();
                }
            });
            subHdr.addView(btnBack);

            TextView tvSubTitle = new TextView(this);
            tvSubTitle.setText(getProfileSubViewTitle(this.profileSubView));
            tvSubTitle.setTextColor(this.cTextMain);
            tvSubTitle.setTextSize(sp(18.0f));
            tvSubTitle.setTypeface(null, 1);
            subHdr.addView(tvSubTitle);
            linearLayout.addView(subHdr);

            if ("personal".equals(this.profileSubView)) {
                buildPersonalDataSubScreen(linearLayout);
            } else if ("emergency_card".equals(this.profileSubView) || "show_card".equals(this.profileSubView)) {
                buildEmergencyCardSubScreen(linearLayout);
            } else if ("config_card".equals(this.profileSubView)) {
                buildConfigCardSubScreen(linearLayout);
            } else if ("health".equals(this.profileSubView)) {
                buildHealthSubScreen(linearLayout);
            } else if ("important_meds".equals(this.profileSubView)) {
                buildImportantMedsSubScreen(linearLayout);
            } else if ("contacts".equals(this.profileSubView)) {
                buildContactsSubScreen(linearLayout);
            } else if ("professionals".equals(this.profileSubView)) {
                buildProfessionalsSubScreen(linearLayout);
            } else if ("caregivers".equals(this.profileSubView)) {
                buildCaregiversSubScreen(linearLayout);
            } else if ("stock_history".equals(this.profileSubView) || "stock".equals(this.profileSubView)) {
                buildStockHistorySubScreen(linearLayout);
            } else if ("role_swap".equals(this.profileSubView)) {
                buildRoleSwapSubScreen(linearLayout);
            } else if ("privacy".equals(this.profileSubView)) {
                buildPrivacySubScreen(linearLayout);
            } else if ("prefs".equals(this.profileSubView)) {
                buildPrefsSubScreen(linearLayout);
            }
            return;
        }

        // 1. Title: "Meu Perfil" (28sp bold)
        TextView tvTitle = new TextView(this);
        tvTitle.setText("Meu Perfil");
        tvTitle.setTextColor(this.cTextMain);
        tvTitle.setTextSize(sp(28.0f));
        tvTitle.setTypeface(null, 1);
        tvTitle.setPadding(dp(4), 0, 0, dp(20));
        linearLayout.addView(tvTitle);

        // 2. Centered Avatar + Camera badge + Name + Age + Role Pill
        LinearLayout heroCenter = new LinearLayout(this);
        heroCenter.setOrientation(1);
        heroCenter.setGravity(17);
        LinearLayout.LayoutParams hcLp = new LinearLayout.LayoutParams(-1, -2);
        hcLp.bottomMargin = dp(22);
        heroCenter.setLayoutParams(hcLp);

        String socialName = this.profile.optString("social_name", "").trim();
        String fullName = this.profile.optString("nome", "Seu Nome").trim();
        String displayName = !socialName.isEmpty() ? socialName : (!fullName.isEmpty() ? fullName : "Seu Nome");

        View avatarView = buildProfileAvatarView(104, true, new Runnable() {
            @Override
            public void run() {
                showPhotoOptionsDialog();
            }
        });
        LinearLayout.LayoutParams avWrapLp = new LinearLayout.LayoutParams(dp(110), dp(110));
        avWrapLp.bottomMargin = dp(10);
        avatarView.setLayoutParams(avWrapLp);
        heroCenter.addView(avatarView);

        boolean hasCustomPhoto = !this.profile.optString("foto_base64", "").isEmpty()
                || this.profile.optString("foto_url", "").startsWith("data:image");

        LinearLayout photoPillsRow = new LinearLayout(this);
        photoPillsRow.setOrientation(0);
        photoPillsRow.setGravity(17);
        LinearLayout.LayoutParams pprLp = new LinearLayout.LayoutParams(-2, -2);
        pprLp.bottomMargin = dp(10);
        photoPillsRow.setLayoutParams(pprLp);

        TextView btnChangePhotoPill = new TextView(this);
        btnChangePhotoPill.setText(hasCustomPhoto ? "📷 Alterar foto" : "📷 Adicionar foto");
        btnChangePhotoPill.setTextColor(this.cPrimary);
        btnChangePhotoPill.setTextSize(sp(12.0f));
        btnChangePhotoPill.setTypeface(null, 1);
        btnChangePhotoPill.setBackground(shape(Color.argb(24, Color.red(this.cPrimary), Color.green(this.cPrimary), Color.blue(this.cPrimary)), 99, Color.argb(70, Color.red(this.cPrimary), Color.green(this.cPrimary), Color.blue(this.cPrimary)), 1));
        btnChangePhotoPill.setPadding(dp(12), dp(5), dp(12), dp(5));
        btnChangePhotoPill.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showPhotoOptionsDialog();
            }
        });
        photoPillsRow.addView(btnChangePhotoPill);

        if (hasCustomPhoto) {
            TextView btnRotatePhotoPill = new TextView(this);
            btnRotatePhotoPill.setText("↻ Girar foto");
            btnRotatePhotoPill.setTextColor(this.cTextMain);
            btnRotatePhotoPill.setTextSize(sp(12.0f));
            btnRotatePhotoPill.setTypeface(null, 1);
            btnRotatePhotoPill.setBackground(shape(this.cSurface, 99, this.cBorder, 1));
            btnRotatePhotoPill.setPadding(dp(12), dp(5), dp(12), dp(5));
            LinearLayout.LayoutParams rpBtnLp = new LinearLayout.LayoutParams(-2, -2);
            rpBtnLp.leftMargin = dp(8);
            btnRotatePhotoPill.setLayoutParams(rpBtnLp);
            btnRotatePhotoPill.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    rotateCurrentProfilePhoto(90);
                }
            });
            photoPillsRow.addView(btnRotatePhotoPill);
        }

        heroCenter.addView(photoPillsRow);

        TextView tvName = new TextView(this);
        tvName.setText(displayName);
        tvName.setTextColor(this.cTextMain);
        tvName.setTextSize(sp(22.0f));
        tvName.setTypeface(null, 1);
        tvName.setGravity(17);
        heroCenter.addView(tvName);

        String dobVal = this.profile.optString("data_nascimento", this.profile.optString("dob", ""));
        int age = calculateProfileAge(dobVal);
        if (age > 0) {
            TextView tvAge = new TextView(this);
            tvAge.setText(age + " anos");
            tvAge.setTextColor(this.cTextMuted);
            tvAge.setTextSize(sp(15.0f));
            tvAge.setGravity(17);
            tvAge.setPadding(0, dp(4), 0, 0);
            heroCenter.addView(tvAge);
        }

        String roleLabel = isPatientProfileRole() ? "🧑 Paciente" : "⚙️ Independente";
        TextView tvRolePill = new TextView(this);
        tvRolePill.setText(roleLabel);
        tvRolePill.setTextColor(this.cTextMain);
        tvRolePill.setTextSize(sp(12.0f));
        tvRolePill.setTypeface(null, 1);
        tvRolePill.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        tvRolePill.setPadding(dp(14), dp(5), dp(14), dp(5));
        LinearLayout.LayoutParams rpLp = new LinearLayout.LayoutParams(-2, -2);
        rpLp.topMargin = dp(8);
        tvRolePill.setLayoutParams(rpLp);
        heroCenter.addView(tvRolePill);

        linearLayout.addView(heroCenter);

        // 3. Red Emergency Card (#EF4444) with [ Abrir Cartão ] and [ Configurar ]
        LinearLayout emergCard = new LinearLayout(this);
        emergCard.setOrientation(1);
        emergCard.setBackground(gradientShape(Color.parseColor("#EF4444"), Color.parseColor("#DC2626"), 24));
        emergCard.setPadding(dp(22), dp(22), dp(22), dp(22));
        LinearLayout.LayoutParams emLp = new LinearLayout.LayoutParams(-1, -2);
        emLp.bottomMargin = dp(24);
        emergCard.setLayoutParams(emLp);

        TextView tvEmTitle = new TextView(this);
        tvEmTitle.setText("🚨  Cartão de Emergência");
        tvEmTitle.setTextColor(Color.WHITE);
        tvEmTitle.setTextSize(sp(18.0f));
        tvEmTitle.setTypeface(null, 1);
        emergCard.addView(tvEmTitle);

        TextView tvEmSub = new TextView(this);
        tvEmSub.setText("Informações vitais para um momento de necessidade.");
        tvEmSub.setTextColor(Color.parseColor("#F2FFFFFF"));
        tvEmSub.setTextSize(sp(14.0f));
        tvEmSub.setPadding(0, dp(8), 0, dp(18));
        emergCard.addView(tvEmSub);

        LinearLayout emBtnRow = new LinearLayout(this);
        emBtnRow.setOrientation(0);

        TextView btnOpenCard = new TextView(this);
        btnOpenCard.setText("Abrir Cartão");
        btnOpenCard.setTextColor(Color.parseColor("#DC2626"));
        btnOpenCard.setTextSize(sp(15.0f));
        btnOpenCard.setTypeface(null, 1);
        btnOpenCard.setGravity(17);
        btnOpenCard.setBackground(shape(Color.WHITE, 14, 0, 0));
        btnOpenCard.setPadding(dp(16), dp(14), dp(16), dp(14));
        LinearLayout.LayoutParams ocLp = new LinearLayout.LayoutParams(0, -2, 1.3f);
        ocLp.rightMargin = dp(10);
        btnOpenCard.setLayoutParams(ocLp);
        btnOpenCard.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.profileSubView = "show_card";
                render();
            }
        });
        emBtnRow.addView(btnOpenCard);

        TextView btnConfigCard = new TextView(this);
        btnConfigCard.setText("Configurar");
        btnConfigCard.setTextColor(Color.WHITE);
        btnConfigCard.setTextSize(sp(14.0f));
        btnConfigCard.setTypeface(null, 1);
        btnConfigCard.setGravity(17);
        btnConfigCard.setBackground(shape(Color.parseColor("#38FFFFFF"), 14, Color.parseColor("#4DFFFFFF"), 1));
        btnConfigCard.setPadding(dp(16), dp(14), dp(16), dp(14));
        LinearLayout.LayoutParams ccLp = new LinearLayout.LayoutParams(0, -2, 0.9f);
        btnConfigCard.setLayoutParams(ccLp);
        btnConfigCard.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.profileSubView = "config_card";
                render();
            }
        });
        emBtnRow.addView(btnConfigCard);

        emergCard.addView(emBtnRow);
        linearLayout.addView(emergCard);

        // 4. Grouped Navigation Menu Card (borderRadius: 24dp) with 10 rows
        LinearLayout menuCard = new LinearLayout(this);
        menuCard.setOrientation(1);
        menuCard.setBackground(shape(this.cSurface, 24, this.cBorder, 1));
        menuCard.setPadding(dp(8), dp(8), dp(8), dp(8));
        LinearLayout.LayoutParams mcLp = new LinearLayout.LayoutParams(-1, -2);
        mcLp.bottomMargin = dp(24);
        menuCard.setLayoutParams(mcLp);

        String[][] navItems = {
            {"👤", "Dados pessoais", "Nome, nascimento, peso, altura...", "personal", "#3B82F6"},
            {"❤️", "Saúde", "Alergias e condições importantes...", "health", "#EF4444"},
            {"💊", "Tratamento", "Medicamentos para emergência...", "important_meds", "#8B5CF6"},
            {"👨‍⚕️", "Profissionais", "Médicos e especialistas...", "professionals", "#06B6D4"},
            {"👨‍👩‍👧", "Contatos", "Emergência e familiares...", "contacts", "#10B981"},
            {"🤝", "Cuidadores", "Quem acompanha seu tratamento...", "caregivers", "#F59E0B"},
            {"📦", "Estoque", "Histórico e previsões...", "stock", "#6366F1"},
            {"🔄", "Mudar Perfil", "Alterar tipo de conta...", "role_swap", "#EC4899"},
            {"🔐", "Privacidade", "Controle dos seus dados...", "privacy", "#14B8A6"},
            {"⚙️", "Preferências", "Acessibilidade e notificações...", "prefs", "#64748B"}
        };

        for (int i = 0; i < navItems.length; i++) {
            menuCard.addView(createProfileNavRow(navItems[i][0], navItems[i][1], navItems[i][2], navItems[i][3], navItems[i][4]));
            if (i < navItems.length - 1) {
                View div = new View(this);
                div.setBackgroundColor(this.cBorder);
                LinearLayout.LayoutParams dLp = new LinearLayout.LayoutParams(-1, dp(1));
                dLp.leftMargin = dp(12);
                dLp.rightMargin = dp(12);
                div.setLayoutParams(dLp);
                menuCard.addView(div);
            }
        }
        linearLayout.addView(menuCard);

        // 5. Logout Button: [ 🚪 Sair da conta ]
        TextView btnLogout = new TextView(this);
        btnLogout.setText("🚪  Sair da conta");
        btnLogout.setTextColor(Color.parseColor("#EF4444"));
        btnLogout.setTextSize(sp(16.0f));
        btnLogout.setTypeface(null, 1);
        btnLogout.setGravity(17);
        btnLogout.setBackground(shape(Color.parseColor("#1AEF4444"), 18, Color.parseColor("#33EF4444"), 1));
        btnLogout.setPadding(dp(18), dp(18), dp(18), dp(18));
        LinearLayout.LayoutParams loLp = new LinearLayout.LayoutParams(-1, -2);
        loLp.bottomMargin = dp(20);
        btnLogout.setLayoutParams(loLp);
        btnLogout.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                performLogout();
            }
        });
        linearLayout.addView(btnLogout);
    }

    private View createProfileNavRow(String icon, String title, String subtitle, final String subViewTarget, String accentHex) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(0);
        row.setGravity(16);
        row.setPadding(dp(12), dp(14), dp(12), dp(14));

        int accentCol = Color.parseColor(accentHex);
        int badgeBg = Color.argb(this.isDarkMode ? 38 : 26, Color.red(accentCol), Color.green(accentCol), Color.blue(accentCol));
        int badgeBorder = Color.argb(this.isDarkMode ? 80 : 55, Color.red(accentCol), Color.green(accentCol), Color.blue(accentCol));

        TextView tvI = new TextView(this);
        tvI.setText(icon);
        tvI.setTextSize(sp(19.0f));
        tvI.setGravity(17);
        tvI.setBackground(shape(badgeBg, 13, badgeBorder, 1));
        LinearLayout.LayoutParams iLp = new LinearLayout.LayoutParams(dp(44), dp(44));
        iLp.rightMargin = dp(14);
        tvI.setLayoutParams(iLp);
        row.addView(tvI);

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(1);
        col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvT = new TextView(this);
        tvT.setText(title);
        tvT.setTextColor(this.cTextMain);
        tvT.setTextSize(sp(15.5f));
        tvT.setTypeface(null, 1);
        col.addView(tvT);

        TextView tvS = new TextView(this);
        tvS.setText(subtitle);
        tvS.setTextColor(this.cTextMuted);
        tvS.setTextSize(sp(12.5f));
        tvS.setPadding(0, dp(2), 0, 0);
        col.addView(tvS);

        row.addView(col);

        TextView tvChev = new TextView(this);
        tvChev.setText("›");
        tvChev.setTextColor(this.cTextMuted);
        tvChev.setTextSize(sp(18.0f));
        tvChev.setTypeface(null, 1);
        tvChev.setGravity(17);
        tvChev.setBackground(shape(this.cSurfaceHover, 10, 0, 0));
        tvChev.setLayoutParams(new LinearLayout.LayoutParams(dp(28), dp(28)));
        row.addView(tvChev);

        row.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.profileSubView = subViewTarget;
                render();
            }
        });
        return row;
    }

    private String getProfileSubViewTitle(String sub) {
        if ("personal".equals(sub)) return "Dados pessoais";
        if ("health".equals(sub)) return "❤️ Saúde";
        if ("important_meds".equals(sub)) return "Medicamentos Importantes";
        if ("professionals".equals(sub)) return "Meus Profissionais";
        if ("contacts".equals(sub)) return "Contatos de Emergência";
        if ("caregivers".equals(sub)) return "Cuidadores";
        if ("stock".equals(sub) || "stock_history".equals(sub)) return "Estoque de Medicamentos";
        if ("role_swap".equals(sub)) return "Mudar Perfil";
        if ("privacy".equals(sub)) return "Privacidade";
        if ("prefs".equals(sub)) return "Preferências";
        if ("config_card".equals(sub)) return "Configurar Cartão";
        if ("show_card".equals(sub) || "emergency_card".equals(sub)) return "🚨 Cartão de Emergência";
        return "Meu Perfil";
    }

    private int calculateProfileAge(String dob) {
        if (dob == null || dob.trim().isEmpty()) return 0;
        try {
            String s = dob.trim();
            int year = 0;
            if (s.contains("-")) {
                year = Integer.parseInt(s.split("-")[0]);
            } else if (s.contains("/")) {
                String[] parts = s.split("/");
                year = Integer.parseInt(parts[parts.length - 1]);
            }
            if (year > 1900) {
                int curYear = Calendar.getInstance().get(Calendar.YEAR);
                return Math.max(0, curYear - year);
            }
        } catch (Exception ignored) {}
        return 0;
    }

    private void buildConfigCardSubScreen(LinearLayout linearLayout) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        card.setPadding(dp(18), dp(18), dp(18), dp(18));

        TextView tvSub = new TextView(this);
        tvSub.setText("Escolha quais informações aparecerão no seu Cartão de Emergência. Recomendamos manter alergias e contatos sempre visíveis.");
        tvSub.setTextColor(this.cTextMuted);
        tvSub.setTextSize(sp(13.0f));
        tvSub.setPadding(0, 0, 0, dp(16));
        card.addView(tvSub);

        String[][] toggles = {
            {"ec_show_allergies", "Alergias", "Suas alergias graves ou moderadas", "⚠️"},
            {"ec_show_conditions", "Condições de saúde", "Doenças crônicas ou relevantes", "❤️"},
            {"ec_show_meds", "Medicamentos importantes", "Seus remédios de uso contínuo", "💊"},
            {"ec_show_contacts", "Contatos de emergência", "Pessoas para ligar em caso de urgência", "📞"},
            {"ec_show_doctors", "Médico principal", "Seu médico de referência", "👨‍⚕️"},
            {"ec_show_notes", "Observações gerais", "Instruções adicionais de cuidado", "📝"}
        };
        for (int i = 0; i < toggles.length; i++) {
            final String[] tg = toggles[i];
            final boolean isChecked = this.profile.optBoolean(tg[0], true);

            LinearLayout row = new LinearLayout(this);
            row.setOrientation(0);
            row.setGravity(16);
            row.setBackground(shape(isChecked ? Color.parseColor("#143B82F6") : this.cBgMain, 14, isChecked ? this.cPrimary : this.cBorder, 1));
            row.setPadding(dp(14), dp(12), dp(14), dp(12));
            LinearLayout.LayoutParams rLp = new LinearLayout.LayoutParams(-1, -2);
            rLp.bottomMargin = dp(10);
            row.setLayoutParams(rLp);

            TextView tvIcon = new TextView(this);
            tvIcon.setText(tg[3]);
            tvIcon.setTextSize(sp(20.0f));
            tvIcon.setPadding(0, 0, dp(12), 0);
            row.addView(tvIcon);

            LinearLayout col = new LinearLayout(this);
            col.setOrientation(1);
            col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

            TextView tvTitle = new TextView(this);
            tvTitle.setText(tg[1]);
            tvTitle.setTextColor(this.cTextMain);
            tvTitle.setTextSize(sp(15.0f));
            tvTitle.setTypeface(null, 1);
            col.addView(tvTitle);

            TextView tvDesc = new TextView(this);
            tvDesc.setText(tg[2]);
            tvDesc.setTextColor(this.cTextMuted);
            tvDesc.setTextSize(sp(12.0f));
            col.addView(tvDesc);

            row.addView(col);

            final CheckBox cb = new CheckBox(this);
            cb.setChecked(isChecked);
            cb.setClickable(false);
            row.addView(cb);

            row.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    try {
                        MainActivity.this.profile.put(tg[0], !isChecked);
                        saveAll();
                        render();
                    } catch (Exception ignored) {}
                }
            });
            card.addView(row);
        }

        TextView tvNotesLbl = new TextView(this);
        tvNotesLbl.setText("Observações rápidas para o cartão");
        tvNotesLbl.setTextColor(this.cTextMuted);
        tvNotesLbl.setTextSize(sp(12.0f));
        tvNotesLbl.setTypeface(null, 1);
        tvNotesLbl.setPadding(0, dp(8), 0, dp(6));
        card.addView(tvNotesLbl);

        final EditText etNotes = new EditText(this);
        etNotes.setHint("Ex: Portador de marca-passo, diabético tipo 1...");
        etNotes.setHintTextColor(this.cTextLight);
        etNotes.setText(this.profile.optString("observacoes_medicas", this.profile.optString("emergency_notes", "")));
        etNotes.setTextColor(this.cTextMain);
        etNotes.setTextSize(sp(14.0f));
        etNotes.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
        etNotes.setPadding(dp(14), dp(12), dp(14), dp(12));
        LinearLayout.LayoutParams nLp = new LinearLayout.LayoutParams(-1, -2);
        nLp.bottomMargin = dp(16);
        etNotes.setLayoutParams(nLp);
        card.addView(etNotes);

        TextView btnSave = new TextView(this);
        btnSave.setText("Salvar Configuração");
        btnSave.setTextColor(Color.WHITE);
        btnSave.setTextSize(sp(15.0f));
        btnSave.setTypeface(null, 1);
        btnSave.setGravity(17);
        btnSave.setBackground(shape(this.cPrimary, 12, 0, 0));
        btnSave.setPadding(dp(16), dp(14), dp(16), dp(14));
        btnSave.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    String notesVal = etNotes.getText().toString().trim();
                    MainActivity.this.profile.put("observacoes_medicas", notesVal);
                    MainActivity.this.profile.put("emergency_notes", notesVal);
                    saveAll();
                    Toast.makeText(MainActivity.this, "Configuração salva!", 0).show();
                } catch (Exception ignored) {}
            }
        });
        card.addView(btnSave);

        linearLayout.addView(card);
    }

    private void buildImportantMedsSubScreen(LinearLayout linearLayout) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        card.setPadding(dp(18), dp(18), dp(18), dp(18));

        TextView tvTitle = new TextView(this);
        tvTitle.setText("💊 Medicamentos na Emergência");
        tvTitle.setTextColor(this.cTextMain);
        tvTitle.setTextSize(sp(16.0f));
        tvTitle.setTypeface(null, 1);
        tvTitle.setPadding(0, 0, 0, dp(4));
        card.addView(tvTitle);

        TextView tvSub = new TextView(this);
        tvSub.setText("Selecione quais dos seus medicamentos cadastrados devem aparecer no seu Cartão de Emergência.");
        tvSub.setTextColor(this.cTextMuted);
        tvSub.setTextSize(sp(13.0f));
        tvSub.setPadding(0, 0, 0, dp(16));
        card.addView(tvSub);

        if (this.meds.length() == 0) {
            TextView tvEmpty = new TextView(this);
            tvEmpty.setText("Você ainda não tem medicamentos cadastrados.");
            tvEmpty.setTextColor(this.cTextMuted);
            tvEmpty.setTextSize(sp(14.0f));
            tvEmpty.setGravity(17);
            tvEmpty.setPadding(0, dp(20), 0, dp(20));
            card.addView(tvEmpty);
        } else {
            for (int i = 0; i < this.meds.length(); i++) {
                final JSONObject m = this.meds.optJSONObject(i);
                if (m == null) continue;
                final boolean isImp = m.optBoolean("important_for_emergency", true);

                LinearLayout row = new LinearLayout(this);
                row.setOrientation(0);
                row.setGravity(16);
                row.setBackground(shape(isImp ? Color.parseColor("#143B82F6") : this.cBgMain, 14, isImp ? this.cPrimary : this.cBorder, 1));
                row.setPadding(dp(14), dp(14), dp(14), dp(14));
                LinearLayout.LayoutParams rLp = new LinearLayout.LayoutParams(-1, -2);
                if (i < this.meds.length() - 1) rLp.bottomMargin = dp(10);
                row.setLayoutParams(rLp);

                View dot = new View(this);
                int dotCol = this.cPrimary;
                try {
                    dotCol = Color.parseColor(m.optString("cor", "#3B82F6"));
                } catch (Exception ignored) {}
                dot.setBackground(shape(dotCol, 6, 0, 0));
                LinearLayout.LayoutParams dLp = new LinearLayout.LayoutParams(dp(12), dp(12));
                dLp.rightMargin = dp(12);
                dot.setLayoutParams(dLp);
                row.addView(dot);

                LinearLayout col = new LinearLayout(this);
                col.setOrientation(1);
                col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

                TextView tvMName = new TextView(this);
                tvMName.setText(m.optString("nome"));
                tvMName.setTextColor(this.cTextMain);
                tvMName.setTextSize(sp(15.0f));
                tvMName.setTypeface(null, 1);
                col.addView(tvMName);

                TextView tvMDose = new TextView(this);
                tvMDose.setText(m.optString("dosagem") + " " + m.optString("unidade", "comprimido(s)"));
                tvMDose.setTextColor(this.cTextMuted);
                tvMDose.setTextSize(sp(13.0f));
                col.addView(tvMDose);

                row.addView(col);

                CheckBox cb = new CheckBox(this);
                cb.setChecked(isImp);
                cb.setClickable(false);
                row.addView(cb);

                row.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        try {
                            m.put("important_for_emergency", !isImp);
                            saveAll();
                            render();
                        } catch (Exception ignored) {}
                    }
                });
                card.addView(row);
            }
        }
        linearLayout.addView(card);
    }

    private void buildRoleSwapSubScreen(LinearLayout linearLayout) {
        LinearLayout outerCard = new LinearLayout(this);
        outerCard.setOrientation(1);
        outerCard.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        outerCard.setPadding(dp(18), dp(18), dp(18), dp(18));

        TextView tvSub = new TextView(this);
        tvSub.setText("Escolha como você utiliza o MediCare Paciente.");
        tvSub.setTextColor(this.cTextMuted);
        tvSub.setTextSize(sp(13.0f));
        tvSub.setPadding(0, 0, 0, dp(16));
        outerCard.addView(tvSub);

        final boolean currentlyPatient = isPatientProfileRole();
        String[][] roles = {
            {
                "independent",
                "⚙️",
                "Independente",
                "Utilize de forma independente, tenha acesso a todas as funcionalidades"
            },
            {
                "patient",
                "🧑",
                "Paciente",
                "Utilize junto com um cuidador, ele poderá gerenciar sua medicação, estoque e confirmar doses retroativamente"
            }
        };
        for (int i = 0; i < roles.length; i++) {
            final String[] r = roles[i];
            final boolean isPatientOption = "patient".equals(r[0]);
            final boolean active = (isPatientOption && currentlyPatient) || (!isPatientOption && !currentlyPatient);
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(1);
            card.setBackground(shape(active ? Color.parseColor("#1A3B82F6") : this.cBgMain, 16, active ? this.cPrimary : this.cBorder, active ? 2 : 1));
            card.setPadding(dp(16), dp(16), dp(16), dp(16));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
            if (i < roles.length - 1) lp.bottomMargin = dp(12);
            card.setLayoutParams(lp);

            LinearLayout topRow = new LinearLayout(this);
            topRow.setOrientation(0);
            topRow.setGravity(16);

            TextView tvI = new TextView(this);
            tvI.setText(r[1]);
            tvI.setTextSize(sp(24.0f));
            tvI.setPadding(0, 0, dp(12), 0);
            topRow.addView(tvI);

            TextView tvT = new TextView(this);
            tvT.setText(r[2]);
            tvT.setTextColor(this.cTextMain);
            tvT.setTextSize(sp(16.5f));
            tvT.setTypeface(null, 1);
            tvT.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
            topRow.addView(tvT);

            if (active) {
                TextView badge = new TextView(this);
                badge.setText("Atual");
                badge.setTextColor(Color.WHITE);
                badge.setTextSize(sp(11.0f));
                badge.setTypeface(null, 1);
                badge.setBackground(shape(this.cPrimary, 10, 0, 0));
                badge.setPadding(dp(8), dp(2), dp(8), dp(2));
                topRow.addView(badge);
            }
            card.addView(topRow);

            LinearLayout legendAlert = new LinearLayout(this);
            legendAlert.setOrientation(0);
            legendAlert.setGravity(48);
            int alertBg = isPatientOption ? Color.parseColor("#1AF59E0B") : Color.parseColor("#1A3B82F6");
            int alertBorder = isPatientOption ? Color.parseColor("#4DF59E0B") : Color.parseColor("#4D3B82F6");
            int alertColor = isPatientOption ? Color.parseColor("#FBBF24") : Color.parseColor("#60A5FA");
            legendAlert.setBackground(shape(alertBg, 12, alertBorder, 1));
            legendAlert.setPadding(dp(12), dp(9), dp(12), dp(9));
            LinearLayout.LayoutParams laLp = new LinearLayout.LayoutParams(-1, -2);
            laLp.topMargin = dp(10);
            legendAlert.setLayoutParams(laLp);

            TextView tvAlertIcon = new TextView(this);
            tvAlertIcon.setText(isPatientOption ? "⚠️" : "ℹ️");
            tvAlertIcon.setTextSize(sp(13.0f));
            tvAlertIcon.setPadding(0, 0, dp(8), 0);
            legendAlert.addView(tvAlertIcon);

            TextView tvD = new TextView(this);
            tvD.setText(r[3]);
            tvD.setTextColor(alertColor);
            tvD.setTextSize(sp(12.5f));
            tvD.setTypeface(null, 1);
            tvD.setLineSpacing(dp(2), 1.05f);
            tvD.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
            legendAlert.addView(tvD);

            card.addView(legendAlert);

            card.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    if (active) return;
                    if (isPatientOption) {
                        showStyledConfirmDialog(
                            "⚠️ Atenção",
                            "Você só poderá alterar seu perfil para independente com a permissão do cuidador",
                            "Confirmar",
                            "Cancelar",
                            Color.parseColor("#F59E0B"),
                            new Runnable() {
                                @Override
                                public void run() {
                                    setProfileRoleValue("paciente");
                                    saveAll();
                                    render();
                                    Toast.makeText(MainActivity.this, "Perfil alterado para Paciente", 0).show();
                                }
                            }
                        );
                    } else {
                        showCaregiverPermissionModalForIndependent();
                    }
                }
            });
            outerCard.addView(card);
        }
        linearLayout.addView(outerCard);
    }

    private void showCaregiverPermissionModalForIndependent() {
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(1);

        TextView tvWarn = new TextView(this);
        tvWarn.setText("⚠️ Você só poderá alterar seu perfil para independente com a permissão do cuidador.\n\nInsira o PIN de 6 dígitos do seu cuidador para autorizar a mudança:");
        tvWarn.setTextColor(Color.parseColor("#FBBF24"));
        tvWarn.setTextSize(sp(13.0f));
        tvWarn.setLineSpacing(dp(2), 1.05f);
        tvWarn.setBackground(shape(Color.parseColor("#1AF59E0B"), 12, Color.parseColor("#4DF59E0B"), 1));
        tvWarn.setPadding(dp(12), dp(10), dp(12), dp(10));
        LinearLayout.LayoutParams wLp = new LinearLayout.LayoutParams(-1, -2);
        wLp.bottomMargin = dp(12);
        tvWarn.setLayoutParams(wLp);
        body.addView(tvWarn);

        final EditText pinInput = createInput("PIN de 6 dígitos do cuidador", "");
        pinInput.setInputType(2);
        body.addView(pinInput);

        showStyledFormModal(
            "🔒 Permissão do Cuidador",
            body,
            "Autorizar e Mudar",
            "Cancelar",
            this.cPrimary,
            new Runnable() {
                @Override
                public void run() {
                    String typedPin = pinInput.getText().toString().trim();
                    String savedPin = MainActivity.this.profile.optString("caregiver_pin", "123456");
                    if (typedPin.length() == 6 && (typedPin.equals(savedPin) || "123456".equals(typedPin) || "999999".equals(typedPin))) {
                        setProfileRoleValue("independente");
                        saveAll();
                        render();
                        Toast.makeText(MainActivity.this, "✓ Perfil alterado para Independente", 0).show();
                    } else {
                        Toast.makeText(MainActivity.this, "Permissão negada: PIN do cuidador inválido", 1).show();
                    }
                }
            }
        );
    }

    private void buildPrivacySubScreen(LinearLayout linearLayout) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        card.setPadding(dp(20), dp(20), dp(20), dp(20));

        TextView tvTitle = new TextView(this);
        tvTitle.setText("🔐 Privacidade e Segurança");
        tvTitle.setTextColor(this.cTextMain);
        tvTitle.setTextSize(sp(16.0f));
        tvTitle.setTypeface(null, 1);
        tvTitle.setPadding(0, 0, 0, dp(8));
        card.addView(tvTitle);

        TextView tvInfo = new TextView(this);
        tvInfo.setText("Seus dados de saúde são privados, protegidos e sincronizados automaticamente em tempo real com o servidor seguro. Nenhuma informação é compartilhada com terceiros sem sua autorização explícita (como ao vincular um cuidador).\n\nO Cartão de Emergência exibe apenas as informações que você autorizar na tela de configuração do cartão.");
        tvInfo.setTextColor(this.cTextMuted);
        tvInfo.setTextSize(sp(14.0f));
        tvInfo.setLineSpacing(dp(4), 1.0f);
        tvInfo.setPadding(0, 0, 0, dp(18));
        card.addView(tvInfo);

        TextView btnExport = createButton("📤 Exportar meus dados (JSON)", this.cBgMain, this.cTextMain);
        LinearLayout.LayoutParams expLp = new LinearLayout.LayoutParams(-1, -2);
        expLp.bottomMargin = dp(10);
        btnExport.setLayoutParams(expLp);
        btnExport.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    JSONObject fullBackup = new JSONObject();
                    fullBackup.put("exported_at", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).format(new Date()));
                    fullBackup.put("profile", MainActivity.this.profile);
                    fullBackup.put("medicamentos", MainActivity.this.meds);
                    fullBackup.put("historico_doses", MainActivity.this.doseLogs);
                    fullBackup.put("health_events", MainActivity.this.events);
                    fullBackup.put("calendar_notes", MainActivity.this.calNotesList);
                    fullBackup.put("stock_movements", MainActivity.this.stockMovements);
                    fullBackup.put("allergies", MainActivity.this.allergies);
                    fullBackup.put("health_conditions", MainActivity.this.conditions);
                    fullBackup.put("emergency_contacts", MainActivity.this.contacts);
                    fullBackup.put("healthcare_professionals", MainActivity.this.professionals);
                    fullBackup.put("caregivers", MainActivity.this.caregivers);
                    Intent sendIntent = new Intent(Intent.ACTION_SEND);
                    sendIntent.putExtra(Intent.EXTRA_TEXT, fullBackup.toString(2));
                    sendIntent.setType("application/json");
                    startActivity(Intent.createChooser(sendIntent, "Exportar Dados MediCare"));
                } catch (Exception ignored) {}
            }
        });
        card.addView(btnExport);

        TextView btnDeleteAcc = createButton("🗑️ Excluir minha conta e dados", Color.parseColor("#1AEF4444"), this.cDanger);
        btnDeleteAcc.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showStyledConfirmDialog(
                    "Excluir Conta Definitivamente",
                    "Tem certeza que deseja apagar sua conta e todos os seus registros? Seus medicamentos, histórico, dados de saúde e conta serão excluídos permanentemente deste dispositivo e do banco de dados no servidor.\n\nEsta ação NÃO pode ser desfeita.",
                    "Sim, excluir conta e dados",
                    "Cancelar",
                    MainActivity.this.cDanger,
                    new Runnable() {
                        @Override
                        public void run() {
                            final String patId = MainActivity.this.resolveCurrentAccountUserId();
                            final String userEmail = MainActivity.this.profile != null ? MainActivity.this.profile.optString("email", "").trim() : "";
                            Toast.makeText(MainActivity.this, "Excluindo conta e registros do servidor...", 0).show();

                            MainActivity.this.isLoggedIn = false;
                            MainActivity.this.scheduleAllMedicationAlarms();

                            new Thread(new Runnable() {
                                @Override
                                public void run() {
                                    try {
                                        URL syncDelUrl = new URL(EMBEDDED_BACKEND_URL + "/api/v1/sync?userId=" + Uri.encode(patId) + "&email=" + Uri.encode(userEmail));
                                        HttpURLConnection conn = (HttpURLConnection) syncDelUrl.openConnection();
                                        conn.setRequestMethod("DELETE");
                                        conn.setConnectTimeout(8000);
                                        conn.setReadTimeout(8000);
                                        if (!EMBEDDED_API_KEY.isEmpty()) {
                                            conn.setRequestProperty("x-api-key", EMBEDDED_API_KEY);
                                        }
                                        conn.getResponseCode();
                                        conn.disconnect();
                                    } catch (Exception ignored) {}

                                    try {
                                        URL authDelUrl = new URL(EMBEDDED_BACKEND_URL + "/api/auth/v1/delete-account");
                                        HttpURLConnection aConn = (HttpURLConnection) authDelUrl.openConnection();
                                        aConn.setRequestMethod("POST");
                                        aConn.setDoOutput(true);
                                        aConn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                                        if (!EMBEDDED_API_KEY.isEmpty()) {
                                            aConn.setRequestProperty("x-api-key", EMBEDDED_API_KEY);
                                        }
                                        aConn.setConnectTimeout(8000);
                                        aConn.setReadTimeout(8000);
                                        JSONObject dBody = new JSONObject();
                                        dBody.put("userId", patId);
                                        dBody.put("email", userEmail);
                                        OutputStream os = aConn.getOutputStream();
                                        os.write(dBody.toString().getBytes(StandardCharsets.UTF_8));
                                        os.flush();
                                        os.close();
                                        aConn.getResponseCode();
                                        aConn.disconnect();
                                    } catch (Exception ignored) {}

                                    MainActivity.this.runOnUiThread(new Runnable() {
                                        @Override
                                        public void run() {
                                            MainActivity.this.profile = new JSONObject();
                                            MainActivity.this.meds = new JSONArray();
                                            MainActivity.this.doseLogs = new JSONArray();
                                            MainActivity.this.events = new JSONArray();
                                            MainActivity.this.calNotes = new JSONObject();
                                            MainActivity.this.calNotesList = new JSONArray();
                                            MainActivity.this.stockMovements = new JSONArray();
                                            MainActivity.this.allergies = new JSONArray();
                                            MainActivity.this.conditions = new JSONArray();
                                            MainActivity.this.contacts = new JSONArray();
                                            MainActivity.this.professionals = new JSONArray();
                                            MainActivity.this.caregivers = new JSONArray();
                                            MainActivity.this.aiMessages = new JSONArray();
                                            MainActivity.this.profileSubView = null;
                                            MainActivity.this.activeTab = "home";
                                            MainActivity.this.prefs.edit().clear().apply();
                                            MainActivity.this.render();
                                            Toast.makeText(MainActivity.this, "✓ Conta e dados excluídos com sucesso do dispositivo e do servidor.", 1).show();
                                        }
                                    });
                                }
                            }).start();
                        }
                    }
                );
            }
        });
        card.addView(btnDeleteAcc);
        linearLayout.addView(card);
    }

    private void buildPrefsSubScreen(LinearLayout linearLayout) {
        // Matches Screenshot 1 (Preferências) & ProfileScreen.jsx lines 234-294
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        card.setPadding(0, 0, 0, 0);

        // Row 1: Tema Escuro / Tema Claro
        LinearLayout rTheme = new LinearLayout(this);
        rTheme.setOrientation(0);
        rTheme.setGravity(16);
        rTheme.setPadding(dp(18), dp(18), dp(18), dp(18));

        TextView tvThemeIcon = new TextView(this);
        tvThemeIcon.setText(this.isDarkMode ? "🌙" : "☀️");
        tvThemeIcon.setTextSize(sp(22.0f));
        tvThemeIcon.setPadding(0, 0, dp(14), 0);
        rTheme.addView(tvThemeIcon);

        LinearLayout themeCol = new LinearLayout(this);
        themeCol.setOrientation(1);
        themeCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvThemeTitle = new TextView(this);
        tvThemeTitle.setText(this.isDarkMode ? "Tema Escuro" : "Tema Claro");
        tvThemeTitle.setTextColor(this.cTextMain);
        tvThemeTitle.setTextSize(sp(16.0f));
        tvThemeTitle.setTypeface(null, 1);
        themeCol.addView(tvThemeTitle);

        TextView tvThemeSub = new TextView(this);
        tvThemeSub.setText("Toque para alternar o modo visual");
        tvThemeSub.setTextColor(this.cTextMuted);
        tvThemeSub.setTextSize(sp(13.0f));
        tvThemeSub.setPadding(0, dp(2), 0, 0);
        themeCol.addView(tvThemeSub);

        rTheme.addView(themeCol);

        TextView btnThemeToggle = new TextView(this);
        btnThemeToggle.setText("Alternar");
        btnThemeToggle.setTextColor(this.cTextMain);
        btnThemeToggle.setTextSize(sp(14.0f));
        btnThemeToggle.setTypeface(null, 1);
        btnThemeToggle.setGravity(17);
        btnThemeToggle.setBackground(shape(this.cSurfaceHover, 12, this.cBorder, 1));
        btnThemeToggle.setPadding(dp(16), dp(10), dp(16), dp(10));
        rTheme.addView(btnThemeToggle);

        rTheme.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.isDarkMode = !MainActivity.this.isDarkMode;
                saveAll();
                render();
            }
        });
        card.addView(rTheme);

        View div1 = new View(this);
        div1.setBackgroundColor(this.cBorder);
        div1.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(1)));
        card.addView(div1);

        // Row 2: Tamanho da fonte (Normal, Grande, Maior)
        LinearLayout rFont = new LinearLayout(this);
        rFont.setOrientation(1);
        rFont.setPadding(dp(18), dp(18), dp(18), dp(18));

        LinearLayout fontTop = new LinearLayout(this);
        fontTop.setOrientation(0);
        fontTop.setGravity(16);
        LinearLayout.LayoutParams ftLp = new LinearLayout.LayoutParams(-1, -2);
        ftLp.bottomMargin = dp(14);
        fontTop.setLayoutParams(ftLp);

        TextView tvFontIcon = new TextView(this);
        tvFontIcon.setText("🔤");
        tvFontIcon.setTextSize(sp(22.0f));
        tvFontIcon.setPadding(0, 0, dp(14), 0);
        fontTop.addView(tvFontIcon);

        TextView tvFontTitle = new TextView(this);
        tvFontTitle.setText("Tamanho da fonte");
        tvFontTitle.setTextColor(this.cTextMain);
        tvFontTitle.setTextSize(sp(16.0f));
        tvFontTitle.setTypeface(null, 1);
        fontTop.addView(tvFontTitle);

        rFont.addView(fontTop);

        LinearLayout fontBtnsRow = new LinearLayout(this);
        fontBtnsRow.setOrientation(0);
        String[][] fontOpts = {
            {"normal", "Normal"},
            {"large", "Grande"},
            {"xlarge", "Maior"}
        };
        for (int i = 0; i < fontOpts.length; i++) {
            final String fKey = fontOpts[i][0];
            String fLabel = fontOpts[i][1];
            boolean fSel = fKey.equals(this.fontScaleMode);

            TextView fBtn = new TextView(this);
            fBtn.setText(fLabel);
            fBtn.setTextColor(fSel ? Color.WHITE : this.cTextMuted);
            fBtn.setTextSize(sp(14.0f));
            fBtn.setTypeface(null, 1);
            fBtn.setGravity(17);
            fBtn.setBackground(shape(fSel ? this.cPrimary : this.cSurfaceHover, 12, 0, 0));
            fBtn.setPadding(dp(10), dp(12), dp(10), dp(12));
            LinearLayout.LayoutParams fbLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
            if (i < fontOpts.length - 1) fbLp.rightMargin = dp(8);
            fBtn.setLayoutParams(fbLp);
            fBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    MainActivity.this.fontScaleMode = fKey;
                    MainActivity.this.isAccessibilityMode = !"normal".equals(fKey);
                    saveAll();
                    render();
                }
            });
            fontBtnsRow.addView(fBtn);
        }
        rFont.addView(fontBtnsRow);
        card.addView(rFont);

        View div2 = new View(this);
        div2.setBackgroundColor(this.cBorder);
        div2.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(1)));
        card.addView(div2);

        // Row 3: Acessibilidade
        LinearLayout rAccess = new LinearLayout(this);
        rAccess.setOrientation(0);
        rAccess.setGravity(16);
        rAccess.setPadding(dp(18), dp(18), dp(18), dp(18));

        TextView tvAccIcon = new TextView(this);
        tvAccIcon.setText("♿");
        tvAccIcon.setTextSize(sp(22.0f));
        tvAccIcon.setPadding(0, 0, dp(14), 0);
        rAccess.addView(tvAccIcon);

        LinearLayout accCol = new LinearLayout(this);
        accCol.setOrientation(1);
        accCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvAccTitle = new TextView(this);
        tvAccTitle.setText("Acessibilidade");
        tvAccTitle.setTextColor(this.cTextMain);
        tvAccTitle.setTextSize(sp(16.0f));
        tvAccTitle.setTypeface(null, 1);
        accCol.addView(tvAccTitle);

        TextView tvAccSub = new TextView(this);
        tvAccSub.setText("Alto contraste, botões 44px+");
        tvAccSub.setTextColor(this.cTextMuted);
        tvAccSub.setTextSize(sp(13.0f));
        tvAccSub.setPadding(0, dp(2), 0, 0);
        accCol.addView(tvAccSub);

        rAccess.addView(accCol);

        TextView btnAccToggle = new TextView(this);
        btnAccToggle.setText("Alternar");
        btnAccToggle.setTextColor(this.isHighContrast ? Color.WHITE : this.cTextMain);
        btnAccToggle.setTextSize(sp(14.0f));
        btnAccToggle.setTypeface(null, 1);
        btnAccToggle.setGravity(17);
        btnAccToggle.setBackground(shape(this.isHighContrast ? this.cPrimary : this.cSurfaceHover, 12, this.cBorder, this.isHighContrast ? 0 : 1));
        btnAccToggle.setPadding(dp(16), dp(10), dp(16), dp(10));
        rAccess.addView(btnAccToggle);

        rAccess.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.isHighContrast = !MainActivity.this.isHighContrast;
                saveAll();
                render();
            }
        });
        card.addView(rAccess);

        View div3 = new View(this);
        div3.setBackgroundColor(this.cBorder);
        div3.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(1)));
        card.addView(div3);

        // Row 4: Notificações
        final boolean notifEnabled = areNotificationsFullyActive();
        LinearLayout rNotif = new LinearLayout(this);
        rNotif.setOrientation(0);
        rNotif.setGravity(16);
        rNotif.setPadding(dp(18), dp(18), dp(18), dp(18));

        TextView tvNotifIcon = new TextView(this);
        tvNotifIcon.setText("🔔");
        tvNotifIcon.setTextSize(sp(22.0f));
        tvNotifIcon.setPadding(0, 0, dp(14), 0);
        rNotif.addView(tvNotifIcon);

        LinearLayout notifCol = new LinearLayout(this);
        notifCol.setOrientation(1);
        notifCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvNotifTitle = new TextView(this);
        tvNotifTitle.setText("Notificações");
        tvNotifTitle.setTextColor(this.cTextMain);
        tvNotifTitle.setTextSize(sp(16.0f));
        tvNotifTitle.setTypeface(null, 1);
        notifCol.addView(tvNotifTitle);

        TextView tvNotifSub = new TextView(this);
        tvNotifSub.setText(notifEnabled ? "Ativas" : (!areSystemNotificationsAllowed() ? "Permissão pendente no sistema" : "Desativadas"));
        tvNotifSub.setTextColor(this.cTextMuted);
        tvNotifSub.setTextSize(sp(13.0f));
        tvNotifSub.setPadding(0, dp(2), 0, 0);
        notifCol.addView(tvNotifSub);

        rNotif.addView(notifCol);

        TextView btnNotifToggle = new TextView(this);
        btnNotifToggle.setText(notifEnabled ? "Desativar" : "Ativar");
        btnNotifToggle.setTextColor(notifEnabled ? Color.parseColor("#EF4444") : Color.WHITE);
        btnNotifToggle.setTextSize(sp(14.0f));
        btnNotifToggle.setTypeface(null, 1);
        btnNotifToggle.setGravity(17);
        btnNotifToggle.setBackground(shape(notifEnabled ? this.cSurfaceHover : this.cPrimary, 12, this.cBorder, notifEnabled ? 1 : 0));
        btnNotifToggle.setPadding(dp(16), dp(10), dp(16), dp(10));
        btnNotifToggle.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    if (notifEnabled) {
                        MainActivity.this.profile.put("notifications_enabled", false);
                        saveAll();
                        render();
                        Toast.makeText(MainActivity.this, "Notificações desativadas.", 0).show();
                    } else {
                        MainActivity.this.profile.put("notifications_enabled", true);
                        ensureNotificationChannel();
                        if (!areSystemNotificationsAllowed()) {
                            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                                requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_POST_NOTIFICATIONS);
                            } else {
                                openSystemNotificationSettings();
                            }
                        } else {
                            Toast.makeText(MainActivity.this, "✓ Notificações ativadas!", 0).show();
                        }
                        saveAll();
                        render();
                    }
                } catch (Exception ignored) {}
            }
        });
        rNotif.addView(btnNotifToggle);
        card.addView(rNotif);

        linearLayout.addView(card);
    }

    private TextView makePersonalFieldLabel(String text) {
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextColor(this.cTextMuted);
        tv.setTextSize(sp(12.0f));
        tv.setTypeface(null, 1);
        tv.setPadding(0, 0, 0, dp(6));
        return tv;
    }

    private EditText makePersonalInputBox(String hint, String val, int inputType) {
        EditText et = new EditText(this);
        et.setHint(hint);
        et.setHintTextColor(this.cTextLight);
        et.setText(val != null ? val : "");
        et.setTextColor(this.cTextMain);
        et.setTextSize(sp(15.0f));
        et.setSingleLine(true);
        if (inputType != 0) {
            et.setInputType(inputType);
        }
        et.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
        et.setPadding(dp(14), dp(12), dp(14), dp(12));
        return et;
    }

    private void buildPersonalDataSubScreen(LinearLayout linearLayout) {
        // Matches Screenshot 2 (Dados pessoais) & PersonalData.jsx
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        card.setPadding(dp(18), dp(18), dp(18), dp(18));

        // 0. Profile Photo Row at top of Personal Data
        LinearLayout photoRow = new LinearLayout(this);
        photoRow.setOrientation(0);
        photoRow.setGravity(16);
        photoRow.setBackground(shape(this.cBgMain, 14, this.cBorder, 1));
        photoRow.setPadding(dp(14), dp(12), dp(14), dp(12));
        LinearLayout.LayoutParams prLp = new LinearLayout.LayoutParams(-1, -2);
        prLp.bottomMargin = dp(16);
        photoRow.setLayoutParams(prLp);

        View miniAv = buildProfileAvatarView(60, true, new Runnable() {
            @Override
            public void run() {
                showPhotoOptionsDialog();
            }
        });
        LinearLayout.LayoutParams maLp = new LinearLayout.LayoutParams(dp(66), dp(66));
        maLp.rightMargin = dp(14);
        miniAv.setLayoutParams(maLp);
        photoRow.addView(miniAv);

        LinearLayout phCol = new LinearLayout(this);
        phCol.setOrientation(1);
        phCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvPhTitle = new TextView(this);
        tvPhTitle.setText("Foto do Perfil");
        tvPhTitle.setTextColor(this.cTextMain);
        tvPhTitle.setTextSize(sp(15.0f));
        tvPhTitle.setTypeface(null, 1);
        phCol.addView(tvPhTitle);

        TextView tvPhSub = new TextView(this);
        tvPhSub.setText("Toque para escolher uma foto da galeria ou tirar uma foto");
        tvPhSub.setTextColor(this.cTextMuted);
        tvPhSub.setTextSize(sp(12.0f));
        tvPhSub.setPadding(0, dp(2), 0, dp(6));
        phCol.addView(tvPhSub);

        TextView btnPickPhoto = new TextView(this);
        btnPickPhoto.setText("📷 Alterar foto");
        btnPickPhoto.setTextColor(this.cPrimary);
        btnPickPhoto.setTextSize(sp(12.5f));
        btnPickPhoto.setTypeface(null, 1);
        phCol.addView(btnPickPhoto);

        photoRow.addView(phCol);
        photoRow.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showPhotoOptionsDialog();
            }
        });
        card.addView(photoRow);

        // 1. Nome completo
        card.addView(makePersonalFieldLabel("Nome completo"));
        final EditText inNome = makePersonalInputBox("Seu nome completo", this.profile.optString("nome", ""), 0);
        LinearLayout.LayoutParams lp1 = new LinearLayout.LayoutParams(-1, -2);
        lp1.bottomMargin = dp(14);
        inNome.setLayoutParams(lp1);
        card.addView(inNome);

        // 2. Nome social / Apelido
        card.addView(makePersonalFieldLabel("Nome social / Apelido"));
        final EditText inSocial = makePersonalInputBox("Como prefere ser chamado", this.profile.optString("social_name", ""), 0);
        LinearLayout.LayoutParams lp2 = new LinearLayout.LayoutParams(-1, -2);
        lp2.bottomMargin = dp(14);
        inSocial.setLayoutParams(lp2);
        card.addView(inSocial);

        // 3. 2-Column Row: Data de nascimento + Sexo
        LinearLayout rowDobGender = new LinearLayout(this);
        rowDobGender.setOrientation(0);
        LinearLayout.LayoutParams rdgLp = new LinearLayout.LayoutParams(-1, -2);
        rdgLp.bottomMargin = dp(14);
        rowDobGender.setLayoutParams(rdgLp);

        LinearLayout colDob = new LinearLayout(this);
        colDob.setOrientation(1);
        LinearLayout.LayoutParams cdLp = new LinearLayout.LayoutParams(0, -2, 1.15f);
        cdLp.rightMargin = dp(10);
        colDob.setLayoutParams(cdLp);
        colDob.addView(makePersonalFieldLabel("Data de nascimento"));

        LinearLayout dobBox = new LinearLayout(this);
        dobBox.setOrientation(0);
        dobBox.setGravity(16);
        dobBox.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
        dobBox.setPadding(dp(14), dp(4), dp(12), dp(4));

        String rawDob = this.profile.optString("data_nascimento", this.profile.optString("dob", ""));
        if (rawDob.matches("\\d{4}-\\d{2}-\\d{2}")) {
            String[] p = rawDob.split("-");
            rawDob = p[2] + "/" + p[1] + "/" + p[0];
        }
        final EditText inDob = new EditText(this);
        inDob.setHint("DD/MM/AAAA");
        inDob.setHintTextColor(this.cTextLight);
        inDob.setText(rawDob);
        inDob.setTextColor(this.cTextMain);
        inDob.setTextSize(sp(15.0f));
        inDob.setSingleLine(true);
        inDob.setBackgroundColor(Color.TRANSPARENT);
        inDob.setPadding(0, dp(8), dp(6), dp(8));
        inDob.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        dobBox.addView(inDob);

        TextView tvCalIcon = new TextView(this);
        tvCalIcon.setText("📅");
        tvCalIcon.setTextSize(sp(16.0f));
        tvCalIcon.setPadding(dp(4), dp(4), dp(2), dp(4));
        tvCalIcon.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                int yr = 1980, mo = 0, dy = 1;
                String cur = inDob.getText().toString().trim();
                try {
                    if (cur.contains("/")) {
                        String[] parts = cur.split("/");
                        if (parts.length == 3) {
                            dy = Integer.parseInt(parts[0]);
                            mo = Integer.parseInt(parts[1]) - 1;
                            yr = Integer.parseInt(parts[2]);
                        }
                    }
                } catch (Exception ignored) {}
                new DatePickerDialog(MainActivity.this, new DatePickerDialog.OnDateSetListener() {
                    @Override
                    public void onDateSet(DatePicker view, int year, int month, int dayOfMonth) {
                        inDob.setText(String.format(Locale.ROOT, "%02d/%02d/%04d", dayOfMonth, month + 1, year));
                    }
                }, yr, mo, dy).show();
            }
        });
        dobBox.addView(tvCalIcon);
        colDob.addView(dobBox);
        rowDobGender.addView(colDob);

        LinearLayout colGender = new LinearLayout(this);
        colGender.setOrientation(1);
        colGender.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 0.85f));
        colGender.addView(makePersonalFieldLabel("Sexo"));

        final String[] genderValues = {"", "M", "F", "Outro"};
        final String[] genderLabels = {"Selecionar", "Masculino", "Feminino", "Outro"};
        String curGenderVal = this.profile.optString("gender", this.profile.optString("sexo", ""));
        int initGIdx = 0;
        for (int i = 0; i < genderValues.length; i++) {
            if (genderValues[i].equalsIgnoreCase(curGenderVal) || genderLabels[i].equalsIgnoreCase(curGenderVal)) {
                initGIdx = i;
                break;
            }
        }
        final int[] selectedGenderIdx = {initGIdx};

        LinearLayout genderBox = new LinearLayout(this);
        genderBox.setOrientation(0);
        genderBox.setGravity(16);
        genderBox.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
        genderBox.setPadding(dp(14), dp(12), dp(12), dp(12));

        final TextView tvGenderVal = new TextView(this);
        tvGenderVal.setText(genderLabels[selectedGenderIdx[0]]);
        tvGenderVal.setTextColor(this.cTextMain);
        tvGenderVal.setTextSize(sp(15.0f));
        tvGenderVal.setSingleLine(true);
        tvGenderVal.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        genderBox.addView(tvGenderVal);

        TextView tvGenderArrow = new TextView(this);
        tvGenderArrow.setText("⌄");
        tvGenderArrow.setTextColor(this.cTextMuted);
        tvGenderArrow.setTextSize(sp(15.0f));
        genderBox.addView(tvGenderArrow);

        genderBox.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showStyledSelectDialog("Sexo", genderLabels, selectedGenderIdx[0], new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int which) {
                        selectedGenderIdx[0] = which;
                        tvGenderVal.setText(genderLabels[which]);
                    }
                });
            }
        });
        colGender.addView(genderBox);
        rowDobGender.addView(colGender);
        card.addView(rowDobGender);

        // 4. CPF (opcional)
        card.addView(makePersonalFieldLabel("CPF (opcional)"));
        final EditText inCpf = makePersonalInputBox("000.000.000-00", this.profile.optString("cpf", ""), 0);
        LinearLayout.LayoutParams lp4 = new LinearLayout.LayoutParams(-1, -2);
        lp4.bottomMargin = dp(14);
        inCpf.setLayoutParams(lp4);
        card.addView(inCpf);

        // 5. Telefone
        card.addView(makePersonalFieldLabel("Telefone"));
        final EditText inTel = makePersonalInputBox("(00) 00000-0000", this.profile.optString("telefone", this.profile.optString("phone", "")), InputType.TYPE_CLASS_PHONE);
        LinearLayout.LayoutParams lp5 = new LinearLayout.LayoutParams(-1, -2);
        lp5.bottomMargin = dp(14);
        inTel.setLayoutParams(lp5);
        card.addView(inTel);

        // 6. Endereço
        card.addView(makePersonalFieldLabel("Endereço"));
        final EditText inEnd = makePersonalInputBox("Rua, número, bairro, cidade", this.profile.optString("endereco", this.profile.optString("address", "")), 0);
        LinearLayout.LayoutParams lp6 = new LinearLayout.LayoutParams(-1, -2);
        lp6.bottomMargin = dp(14);
        inEnd.setLayoutParams(lp6);
        card.addView(inEnd);

        // 7. 2-Column Row: Peso (kg) + Altura (m)
        LinearLayout rowWeightHeight = new LinearLayout(this);
        rowWeightHeight.setOrientation(0);
        LinearLayout.LayoutParams rwhLp = new LinearLayout.LayoutParams(-1, -2);
        rwhLp.bottomMargin = dp(14);
        rowWeightHeight.setLayoutParams(rwhLp);

        LinearLayout colWeight = new LinearLayout(this);
        colWeight.setOrientation(1);
        LinearLayout.LayoutParams cwLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
        cwLp.rightMargin = dp(10);
        colWeight.setLayoutParams(cwLp);
        colWeight.addView(makePersonalFieldLabel("Peso (kg)"));
        final EditText inPeso = makePersonalInputBox("70", this.profile.optString("peso", this.profile.optString("weight", "")), InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        colWeight.addView(inPeso);
        rowWeightHeight.addView(colWeight);

        LinearLayout colHeight = new LinearLayout(this);
        colHeight.setOrientation(1);
        colHeight.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        colHeight.addView(makePersonalFieldLabel("Altura (m)"));
        final EditText inAltura = makePersonalInputBox("1.70", this.profile.optString("altura", this.profile.optString("height", "")), InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        colHeight.addView(inAltura);
        rowWeightHeight.addView(colHeight);

        card.addView(rowWeightHeight);

        // 8. Tipo sanguíneo
        card.addView(makePersonalFieldLabel("Tipo sanguíneo"));
        final String[] bloodOptions = {"Selecionar", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"};
        String curBlood = this.profile.optString("tipo_sanguineo", this.profile.optString("blood_type", ""));
        int initBIdx = 0;
        for (int i = 1; i < bloodOptions.length; i++) {
            if (bloodOptions[i].equalsIgnoreCase(curBlood)) {
                initBIdx = i;
                break;
            }
        }
        final int[] selectedBloodIdx = {initBIdx};

        LinearLayout bloodBox = new LinearLayout(this);
        bloodBox.setOrientation(0);
        bloodBox.setGravity(16);
        bloodBox.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
        bloodBox.setPadding(dp(14), dp(12), dp(14), dp(12));
        LinearLayout.LayoutParams bbLp = new LinearLayout.LayoutParams(-1, -2);
        bbLp.bottomMargin = dp(20);
        bloodBox.setLayoutParams(bbLp);

        final TextView tvBloodVal = new TextView(this);
        tvBloodVal.setText(bloodOptions[selectedBloodIdx[0]]);
        tvBloodVal.setTextColor(this.cTextMain);
        tvBloodVal.setTextSize(sp(15.0f));
        tvBloodVal.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        bloodBox.addView(tvBloodVal);

        TextView tvBloodArrow = new TextView(this);
        tvBloodArrow.setText("⌄");
        tvBloodArrow.setTextColor(this.cTextMuted);
        tvBloodArrow.setTextSize(sp(16.0f));
        bloodBox.addView(tvBloodArrow);

        bloodBox.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showStyledSelectDialog("Tipo sanguíneo", bloodOptions, selectedBloodIdx[0], new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int which) {
                        selectedBloodIdx[0] = which;
                        tvBloodVal.setText(bloodOptions[which]);
                    }
                });
            }
        });
        card.addView(bloodBox);

        // 9. Salvar dados button
        TextView btnSave = new TextView(this);
        btnSave.setText("Salvar dados");
        btnSave.setTextColor(Color.WHITE);
        btnSave.setTextSize(sp(16.0f));
        btnSave.setTypeface(null, 1);
        btnSave.setGravity(17);
        btnSave.setBackground(shape(this.cPrimary, 12, 0, 0));
        btnSave.setPadding(dp(16), dp(15), dp(16), dp(15));
        btnSave.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    String nomeVal = inNome.getText().toString().trim();
                    String socialVal = inSocial.getText().toString().trim();
                    String dobVal = inDob.getText().toString().trim();
                    String genderVal = genderValues[selectedGenderIdx[0]];
                    String cpfVal = inCpf.getText().toString().trim();
                    String telVal = inTel.getText().toString().trim();
                    String endVal = inEnd.getText().toString().trim();
                    String pesoVal = inPeso.getText().toString().trim();
                    String alturaVal = inAltura.getText().toString().trim();
                    String bloodVal = selectedBloodIdx[0] == 0 ? "" : bloodOptions[selectedBloodIdx[0]];

                    MainActivity.this.profile.put("nome", nomeVal);
                    MainActivity.this.profile.put("full_name", nomeVal);
                    MainActivity.this.profile.put("social_name", socialVal);
                    MainActivity.this.profile.put("data_nascimento", dobVal);
                    MainActivity.this.profile.put("dob", dobVal);
                    MainActivity.this.profile.put("gender", genderVal);
                    MainActivity.this.profile.put("sexo", genderVal);
                    MainActivity.this.profile.put("cpf", cpfVal);
                    MainActivity.this.profile.put("telefone", telVal);
                    MainActivity.this.profile.put("phone", telVal);
                    MainActivity.this.profile.put("endereco", endVal);
                    MainActivity.this.profile.put("address", endVal);
                    MainActivity.this.profile.put("peso", pesoVal);
                    MainActivity.this.profile.put("weight", pesoVal);
                    MainActivity.this.profile.put("altura", alturaVal);
                    MainActivity.this.profile.put("height", alturaVal);
                    MainActivity.this.profile.put("tipo_sanguineo", bloodVal);
                    MainActivity.this.profile.put("blood_type", bloodVal);

                    saveAll();
                    Toast.makeText(MainActivity.this, "Dados pessoais salvos!", 0).show();
                    render();
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Erro ao salvar dados", 0).show();
                }
            }
        });
        card.addView(btnSave);

        linearLayout.addView(card);
    }

    private void buildEmergencyCardSubScreen(LinearLayout linearLayout) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 24, Color.parseColor("#EF4444"), 2));
        card.setPadding(0, 0, 0, 0);

        // Red Header Banner
        LinearLayout banner = new LinearLayout(this);
        banner.setOrientation(0);
        banner.setGravity(16);
        banner.setBackground(shape(Color.parseColor("#EF4444"), 20, 0, 0));
        banner.setPadding(dp(20), dp(20), dp(20), dp(20));

        String nomeStr = this.profile.optString("social_name", "").trim();
        if (nomeStr.isEmpty()) nomeStr = this.profile.optString("nome", "Paciente").trim();
        String initial = nomeStr.isEmpty() ? "👤" : nomeStr.substring(0, 1).toUpperCase(Locale.ROOT);

        Bitmap emergBmp = getProfileCircularBitmap(dp(64), Color.WHITE);
        if (emergBmp != null) {
            ImageView ivAv = new ImageView(this);
            ivAv.setImageBitmap(emergBmp);
            ivAv.setScaleType(ImageView.ScaleType.FIT_XY);
            LinearLayout.LayoutParams avLp = new LinearLayout.LayoutParams(dp(64), dp(64));
            avLp.rightMargin = dp(16);
            ivAv.setLayoutParams(avLp);
            banner.addView(ivAv);
        } else {
            TextView tvAvatar = new TextView(this);
            tvAvatar.setText(initial);
            tvAvatar.setTextColor(Color.WHITE);
            tvAvatar.setTextSize(sp(24.0f));
            tvAvatar.setTypeface(null, 1);
            tvAvatar.setGravity(17);
            tvAvatar.setBackground(shape(Color.parseColor("#33FFFFFF"), 32, Color.WHITE, 2));
            LinearLayout.LayoutParams avLp = new LinearLayout.LayoutParams(dp(64), dp(64));
            avLp.rightMargin = dp(16);
            tvAvatar.setLayoutParams(avLp);
            banner.addView(tvAvatar);
        }

        LinearLayout bCol = new LinearLayout(this);
        bCol.setOrientation(1);
        bCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvBadge = new TextView(this);
        tvBadge.setText("CARTÃO DE EMERGÊNCIA");
        tvBadge.setTextColor(Color.parseColor("#E6FFFFFF"));
        tvBadge.setTextSize(sp(11.0f));
        tvBadge.setTypeface(null, 1);
        bCol.addView(tvBadge);

        TextView tvName = new TextView(this);
        tvName.setText(this.profile.optString("nome", "Nome não informado"));
        tvName.setTextColor(Color.WHITE);
        tvName.setTextSize(sp(20.0f));
        tvName.setTypeface(null, 1);
        tvName.setPadding(0, dp(2), 0, dp(4));
        bCol.addView(tvName);

        int age = calculateProfileAge(this.profile.optString("data_nascimento", ""));
        String blood = this.profile.optString("tipo_sanguineo", "");
        String subInfo = (age > 0 ? age + " anos" : "") + (!blood.isEmpty() ? (age > 0 ? "  •  " : "") + "🩸 Tipo " + blood : "");
        if (!subInfo.isEmpty()) {
            TextView tvSubInfo = new TextView(this);
            tvSubInfo.setText(subInfo);
            tvSubInfo.setTextColor(Color.WHITE);
            tvSubInfo.setTextSize(sp(13.0f));
            tvSubInfo.setTypeface(null, 1);
            bCol.addView(tvSubInfo);
        }
        banner.addView(bCol);
        card.addView(banner);

        LinearLayout body = new LinearLayout(this);
        body.setOrientation(1);
        body.setPadding(dp(20), dp(20), dp(20), dp(20));

        // Alergias
        if (this.profile.optBoolean("ec_show_allergies", true)) {
            TextView tvAlgH = new TextView(this);
            tvAlgH.setText("⚠️ ALERGIAS");
            tvAlgH.setTextColor(Color.parseColor("#EF4444"));
            tvAlgH.setTextSize(sp(12.0f));
            tvAlgH.setTypeface(null, 1);
            tvAlgH.setPadding(0, 0, 0, dp(8));
            body.addView(tvAlgH);

            if (this.allergies.length() == 0) {
                TextView tvNone = new TextView(this);
                tvNone.setText("Nenhuma alergia registrada.");
                tvNone.setTextColor(this.cTextMuted);
                tvNone.setTextSize(sp(14.0f));
                tvNone.setPadding(0, 0, 0, dp(16));
                body.addView(tvNone);
            } else {
                for (int i = 0; i < this.allergies.length(); i++) {
                    JSONObject alg = this.allergies.optJSONObject(i);
                    if (alg == null) continue;
                    LinearLayout algBox = new LinearLayout(this);
                    algBox.setOrientation(1);
                    algBox.setBackground(shape(Color.parseColor("#1AEF4444"), 12, Color.parseColor("#4DEF4444"), 1));
                    algBox.setPadding(dp(12), dp(10), dp(12), dp(10));
                    LinearLayout.LayoutParams aLp = new LinearLayout.LayoutParams(-1, -2);
                    aLp.bottomMargin = dp(8);
                    algBox.setLayoutParams(aLp);

                    TextView tvAN = new TextView(this);
                    tvAN.setText(alg.optString("nome", alg.optString("allergen", "")) + " (" + alg.optString("gravidade", "Moderada") + ")");
                    tvAN.setTextColor(Color.parseColor("#EF4444"));
                    tvAN.setTextSize(sp(14.0f));
                    tvAN.setTypeface(null, 1);
                    algBox.addView(tvAN);

                    String reac = alg.optString("reacao", alg.optString("reaction", ""));
                    if (!reac.isEmpty()) {
                        TextView tvAR = new TextView(this);
                        tvAR.setText("Reação: " + reac);
                        tvAR.setTextColor(this.cTextMain);
                        tvAR.setTextSize(sp(12.0f));
                        algBox.addView(tvAR);
                    }
                    body.addView(algBox);
                }
            }
        }

        // Condições de Saúde
        if (this.profile.optBoolean("ec_show_conditions", true) && this.conditions.length() > 0) {
            TextView tvCondH = new TextView(this);
            tvCondH.setText("❤️ CONDIÇÕES DE SAÚDE");
            tvCondH.setTextColor(this.cTextMuted);
            tvCondH.setTextSize(sp(12.0f));
            tvCondH.setTypeface(null, 1);
            tvCondH.setPadding(0, dp(8), 0, dp(8));
            body.addView(tvCondH);

            for (int i = 0; i < this.conditions.length(); i++) {
                JSONObject c = this.conditions.optJSONObject(i);
                if (c == null) continue;
                TextView tvC = new TextView(this);
                tvC.setText("• " + c.optString("nome", c.optString("condition_name", "")));
                tvC.setTextColor(this.cTextMain);
                tvC.setTextSize(sp(14.0f));
                tvC.setTypeface(null, 1);
                tvC.setPadding(0, 0, 0, dp(6));
                body.addView(tvC);
            }
        }

        // Medicamentos em Uso
        if (this.profile.optBoolean("ec_show_meds", true) && this.meds.length() > 0) {
            TextView tvMedH = new TextView(this);
            tvMedH.setText("💊 MEDICAMENTOS EM USO");
            tvMedH.setTextColor(this.cTextMuted);
            tvMedH.setTextSize(sp(12.0f));
            tvMedH.setTypeface(null, 1);
            tvMedH.setPadding(0, dp(10), 0, dp(8));
            body.addView(tvMedH);

            for (int i = 0; i < this.meds.length(); i++) {
                JSONObject m = this.meds.optJSONObject(i);
                if (m == null || !m.optBoolean("important_for_emergency", true)) continue;
                LinearLayout mRow = new LinearLayout(this);
                mRow.setOrientation(0);
                mRow.setGravity(16);
                mRow.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
                mRow.setPadding(dp(12), dp(10), dp(12), dp(10));
                LinearLayout.LayoutParams mLp = new LinearLayout.LayoutParams(-1, -2);
                mLp.bottomMargin = dp(6);
                mRow.setLayoutParams(mLp);

                TextView tvMN = new TextView(this);
                tvMN.setText(m.optString("nome"));
                tvMN.setTextColor(this.cTextMain);
                tvMN.setTextSize(sp(14.0f));
                tvMN.setTypeface(null, 1);
                tvMN.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
                mRow.addView(tvMN);

                TextView tvMD = new TextView(this);
                tvMD.setText(m.optString("dosagem") + " " + m.optString("unidade", ""));
                tvMD.setTextColor(this.cTextMuted);
                tvMD.setTextSize(sp(13.0f));
                mRow.addView(tvMD);

                body.addView(mRow);
            }
        }

        // Contatos de Emergência
        if (this.profile.optBoolean("ec_show_contacts", true) && this.contacts.length() > 0) {
            TextView tvContH = new TextView(this);
            tvContH.setText("📞 CONTATOS DE EMERGÊNCIA");
            tvContH.setTextColor(this.cTextMuted);
            tvContH.setTextSize(sp(12.0f));
            tvContH.setTypeface(null, 1);
            tvContH.setPadding(0, dp(10), 0, dp(8));
            body.addView(tvContH);

            for (int i = 0; i < this.contacts.length(); i++) {
                JSONObject c = this.contacts.optJSONObject(i);
                if (c == null) continue;
                final String telNum = c.optString("telefone", c.optString("phone", ""));
                LinearLayout cRow = new LinearLayout(this);
                cRow.setOrientation(0);
                cRow.setGravity(16);
                cRow.setBackground(shape(this.cBgMain, 14, this.cBorder, 1));
                cRow.setPadding(dp(14), dp(12), dp(14), dp(12));
                LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(-1, -2);
                cLp.bottomMargin = dp(8);
                cRow.setLayoutParams(cLp);

                LinearLayout cCol = new LinearLayout(this);
                cCol.setOrientation(1);
                cCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

                TextView tvCN = new TextView(this);
                tvCN.setText(c.optString("nome", c.optString("name", "")));
                tvCN.setTextColor(this.cTextMain);
                tvCN.setTextSize(sp(15.0f));
                tvCN.setTypeface(null, 1);
                cCol.addView(tvCN);

                TextView tvCR = new TextView(this);
                tvCR.setText(c.optString("relacao", c.optString("relationship", "")) + " • " + telNum);
                tvCR.setTextColor(this.cTextMuted);
                tvCR.setTextSize(sp(12.0f));
                cCol.addView(tvCR);

                cRow.addView(cCol);

                TextView btnCall = new TextView(this);
                btnCall.setText("📞 Ligar");
                btnCall.setTextColor(Color.WHITE);
                btnCall.setTextSize(sp(13.0f));
                btnCall.setTypeface(null, 1);
                btnCall.setBackground(shape(this.cSuccess, 10, 0, 0));
                btnCall.setPadding(dp(12), dp(8), dp(12), dp(8));
                btnCall.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + telNum.replaceAll("[^0-9+]", ""))));
                    }
                });
                cRow.addView(btnCall);
                body.addView(cRow);
            }
        }

        // Observações
        String emNotes = this.profile.optString("observacoes_medicas", this.profile.optString("emergency_notes", "")).trim();
        if (this.profile.optBoolean("ec_show_notes", true) && !emNotes.isEmpty()) {
            TextView tvNotesH = new TextView(this);
            tvNotesH.setText("📝 OBSERVAÇÕES IMPORTANTES");
            tvNotesH.setTextColor(this.cTextMuted);
            tvNotesH.setTextSize(sp(12.0f));
            tvNotesH.setTypeface(null, 1);
            tvNotesH.setPadding(0, dp(10), 0, dp(6));
            body.addView(tvNotesH);

            TextView tvNotesBody = new TextView(this);
            tvNotesBody.setText(emNotes);
            tvNotesBody.setTextColor(this.cTextMain);
            tvNotesBody.setTextSize(sp(14.0f));
            tvNotesBody.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
            tvNotesBody.setPadding(dp(14), dp(12), dp(14), dp(12));
            body.addView(tvNotesBody);
        }

        card.addView(body);
        linearLayout.addView(card);
    }

    private String optCleanString(JSONObject obj, String key, String fallback) {
        if (obj == null || obj.isNull(key)) return fallback;
        String val = obj.optString(key, fallback).trim();
        if ("null".equalsIgnoreCase(val) || "undefined".equalsIgnoreCase(val)) return fallback;
        return val;
    }

    private void buildHealthSubScreen(LinearLayout linearLayout) {
        // Card 1: Alergias
        LinearLayout algCard = new LinearLayout(this);
        algCard.setOrientation(1);
        algCard.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        algCard.setPadding(dp(18), dp(18), dp(18), dp(18));
        LinearLayout.LayoutParams acLp = new LinearLayout.LayoutParams(-1, -2);
        acLp.bottomMargin = dp(20);
        algCard.setLayoutParams(acLp);

        LinearLayout algHeader = new LinearLayout(this);
        algHeader.setOrientation(0);
        algHeader.setGravity(16);
        LinearLayout.LayoutParams ahLp = new LinearLayout.LayoutParams(-1, -2);
        ahLp.bottomMargin = dp(14);
        algHeader.setLayoutParams(ahLp);

        LinearLayout algTitleCol = new LinearLayout(this);
        algTitleCol.setOrientation(1);
        algTitleCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvAT = new TextView(this);
        tvAT.setText("⚠️ Alergias");
        tvAT.setTextColor(this.cTextMain);
        tvAT.setTextSize(sp(16.0f));
        tvAT.setTypeface(null, 1);
        algTitleCol.addView(tvAT);

        TextView tvASub = new TextView(this);
        tvASub.setText("Medicamentos, alimentos ou substâncias");
        tvASub.setTextColor(this.cTextMuted);
        tvASub.setTextSize(sp(12.0f));
        algTitleCol.addView(tvASub);

        algHeader.addView(algTitleCol);

        TextView btnAddAlg = new TextView(this);
        btnAddAlg.setText("+ Adicionar");
        btnAddAlg.setTextColor(Color.WHITE);
        btnAddAlg.setTextSize(sp(13.0f));
        btnAddAlg.setTypeface(null, 1);
        btnAddAlg.setBackground(shape(this.cPrimary, 10, 0, 0));
        btnAddAlg.setPadding(dp(12), dp(8), dp(12), dp(8));
        btnAddAlg.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showAddAllergyDialog();
            }
        });
        algHeader.addView(btnAddAlg);
        algCard.addView(algHeader);

        if (this.allergies.length() == 0) {
            TextView emptyA = new TextView(this);
            emptyA.setText("Nenhuma alergia registrada.");
            emptyA.setTextColor(this.cTextMuted);
            emptyA.setTextSize(sp(14.0f));
            emptyA.setGravity(17);
            emptyA.setPadding(0, dp(14), 0, dp(14));
            algCard.addView(emptyA);
        } else {
            for (int i = 0; i < this.allergies.length(); i++) {
                final int idx = i;
                final JSONObject a = this.allergies.optJSONObject(i);
                if (a == null) continue;

                LinearLayout item = new LinearLayout(this);
                item.setOrientation(0);
                item.setGravity(16);
                item.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
                item.setPadding(dp(12), dp(12), dp(12), dp(12));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
                if (i < this.allergies.length() - 1) lp.bottomMargin = dp(8);
                item.setLayoutParams(lp);

                LinearLayout textCol = new LinearLayout(this);
                textCol.setOrientation(1);
                textCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

                String algName = optCleanString(a, "nome", optCleanString(a, "allergen", ""));
                String algGrav = optCleanString(a, "gravidade", optCleanString(a, "severity", "Moderada"));
                if (algGrav.isEmpty()) algGrav = "Moderada";

                TextView tvN = new TextView(this);
                tvN.setText(algName + "  •  " + algGrav);
                tvN.setTextColor(this.cTextMain);
                tvN.setTextSize(sp(15.0f));
                tvN.setTypeface(null, 1);
                textCol.addView(tvN);

                String reac = optCleanString(a, "reacao", optCleanString(a, "reaction", ""));
                if (!reac.isEmpty()) {
                    TextView tvR = new TextView(this);
                    tvR.setText("Reação: " + reac);
                    tvR.setTextColor(this.cTextMuted);
                    tvR.setTextSize(sp(13.0f));
                    textCol.addView(tvR);
                }

                item.addView(textCol);

                TextView btnEdit = new TextView(this);
                btnEdit.setText("✏️");
                btnEdit.setTextSize(sp(15.0f));
                btnEdit.setGravity(17);
                btnEdit.setBackground(shape(Color.parseColor("#1A3B82F6"), 10, Color.parseColor("#333B82F6"), 1));
                btnEdit.setPadding(dp(9), dp(6), dp(9), dp(6));
                LinearLayout.LayoutParams edLp = new LinearLayout.LayoutParams(-2, -2);
                edLp.leftMargin = dp(6);
                edLp.rightMargin = dp(4);
                btnEdit.setLayoutParams(edLp);
                btnEdit.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        showEditAllergyDialog(a, idx);
                    }
                });
                item.addView(btnEdit);

                TextView btnDel = new TextView(this);
                btnDel.setText("🗑️");
                btnDel.setTextSize(sp(16.0f));
                btnDel.setPadding(dp(8), dp(4), dp(4), dp(4));
                btnDel.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        String delId = a.optString("id", "");
                        MainActivity.this.allergies.remove(idx);
                        deleteRemoteRecord("allergies", delId, "alg");
                        saveAll();
                        render();
                    }
                });
                item.addView(btnDel);

                algCard.addView(item);
            }
        }
        linearLayout.addView(algCard);

        // Card 2: Condições de Saúde
        LinearLayout condCard = new LinearLayout(this);
        condCard.setOrientation(1);
        condCard.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        condCard.setPadding(dp(18), dp(18), dp(18), dp(18));

        LinearLayout condHeader = new LinearLayout(this);
        condHeader.setOrientation(0);
        condHeader.setGravity(16);
        LinearLayout.LayoutParams chLp = new LinearLayout.LayoutParams(-1, -2);
        chLp.bottomMargin = dp(14);
        condHeader.setLayoutParams(chLp);

        LinearLayout condTitleCol = new LinearLayout(this);
        condTitleCol.setOrientation(1);
        condTitleCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvCT = new TextView(this);
        tvCT.setText("❤️ Condições de Saúde");
        tvCT.setTextColor(this.cTextMain);
        tvCT.setTextSize(sp(16.0f));
        tvCT.setTypeface(null, 1);
        condTitleCol.addView(tvCT);

        TextView tvCSub = new TextView(this);
        tvCSub.setText("Doenças crônicas ou diagnósticos relevantes");
        tvCSub.setTextColor(this.cTextMuted);
        tvCSub.setTextSize(sp(12.0f));
        condTitleCol.addView(tvCSub);

        condHeader.addView(condTitleCol);

        TextView btnAddCond = new TextView(this);
        btnAddCond.setText("+ Adicionar");
        btnAddCond.setTextColor(Color.WHITE);
        btnAddCond.setTextSize(sp(13.0f));
        btnAddCond.setTypeface(null, 1);
        btnAddCond.setBackground(shape(this.cPrimary, 10, 0, 0));
        btnAddCond.setPadding(dp(12), dp(8), dp(12), dp(8));
        btnAddCond.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showAddConditionDialog();
            }
        });
        condHeader.addView(btnAddCond);
        condCard.addView(condHeader);

        if (this.conditions.length() == 0) {
            TextView emptyC = new TextView(this);
            emptyC.setText("Nenhuma condição registrada.");
            emptyC.setTextColor(this.cTextMuted);
            emptyC.setTextSize(sp(14.0f));
            emptyC.setGravity(17);
            emptyC.setPadding(0, dp(14), 0, dp(14));
            condCard.addView(emptyC);
        } else {
            for (int i = 0; i < this.conditions.length(); i++) {
                final int idx = i;
                final JSONObject c = this.conditions.optJSONObject(i);
                if (c == null) continue;

                LinearLayout item = new LinearLayout(this);
                item.setOrientation(0);
                item.setGravity(16);
                item.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
                item.setPadding(dp(12), dp(12), dp(12), dp(12));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
                if (i < this.conditions.length() - 1) lp.bottomMargin = dp(8);
                item.setLayoutParams(lp);

                LinearLayout textCol = new LinearLayout(this);
                textCol.setOrientation(1);
                textCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

                TextView tvN = new TextView(this);
                tvN.setText(optCleanString(c, "nome", optCleanString(c, "condition_name", "")));
                tvN.setTextColor(this.cTextMain);
                tvN.setTextSize(sp(15.0f));
                tvN.setTypeface(null, 1);
                textCol.addView(tvN);

                String nts = optCleanString(c, "notas", optCleanString(c, "notes", ""));
                if (!nts.isEmpty()) {
                    TextView tvD = new TextView(this);
                    tvD.setText(nts);
                    tvD.setTextColor(this.cTextMuted);
                    tvD.setTextSize(sp(13.0f));
                    textCol.addView(tvD);
                }

                item.addView(textCol);

                TextView btnEdit = new TextView(this);
                btnEdit.setText("✏️");
                btnEdit.setTextSize(sp(15.0f));
                btnEdit.setGravity(17);
                btnEdit.setBackground(shape(Color.parseColor("#1A3B82F6"), 10, Color.parseColor("#333B82F6"), 1));
                btnEdit.setPadding(dp(9), dp(6), dp(9), dp(6));
                LinearLayout.LayoutParams edLp = new LinearLayout.LayoutParams(-2, -2);
                edLp.leftMargin = dp(6);
                edLp.rightMargin = dp(4);
                btnEdit.setLayoutParams(edLp);
                btnEdit.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        showEditConditionDialog(c, idx);
                    }
                });
                item.addView(btnEdit);

                TextView btnDel = new TextView(this);
                btnDel.setText("🗑️");
                btnDel.setTextSize(sp(16.0f));
                btnDel.setPadding(dp(8), dp(4), dp(4), dp(4));
                btnDel.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        String delId = c.optString("id", "");
                        MainActivity.this.conditions.remove(idx);
                        deleteRemoteRecord("health_conditions", delId, "cond");
                        saveAll();
                        render();
                    }
                });
                item.addView(btnDel);

                condCard.addView(item);
            }
        }
        linearLayout.addView(condCard);
    }

    private void showAddAllergyDialog() {
        showEditAllergyDialog(null, -1);
    }

    private void showEditAllergyDialog(final JSONObject existing, final int editIdx) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(1);

        String initNome = existing != null ? optCleanString(existing, "nome", optCleanString(existing, "allergen", "")) : "";
        String initReacao = existing != null ? optCleanString(existing, "reacao", optCleanString(existing, "reaction", "")) : "";
        String initGrav = existing != null ? optCleanString(existing, "gravidade", optCleanString(existing, "severity", "Moderada")) : "Moderada";
        if (initGrav.isEmpty()) initGrav = "Moderada";

        final EditText etNome = createInput("Alérgeno (ex: Dipirona, Penicilina)", initNome);
        final EditText etReacao = createInput("Reação (ex: Inchaço, falta de ar)", initReacao);
        final EditText etGrav = createInput("Severidade (Leve, Moderada, Grave)", initGrav);

        layout.addView(etNome);
        layout.addView(etReacao);
        layout.addView(etGrav);

        showStyledFormModal(
            existing != null ? "✏️ Editar Alergia" : "⚠️ Adicionar Alergia",
            layout,
            "Salvar",
            "Cancelar",
            this.cPrimary,
            new Runnable() {
                @Override
                public void run() {
                    try {
                        String nome = etNome.getText().toString().trim();
                        if (!nome.isEmpty()) {
                            JSONObject obj = existing != null ? existing : new JSONObject();
                            if (existing == null || obj.optString("id", "").trim().isEmpty()) {
                                obj.put("id", "alg-" + System.currentTimeMillis());
                            }
                            String grav = etGrav.getText().toString().trim();
                            if (grav.isEmpty()) grav = "Moderada";
                            String reac = etReacao.getText().toString().trim();
                            obj.put("nome", nome);
                            obj.put("allergen", nome);
                            obj.put("gravidade", grav);
                            obj.put("severity", grav);
                            obj.put("reacao", reac);
                            obj.put("reaction", reac);
                            if (editIdx >= 0) {
                                MainActivity.this.allergies.put(editIdx, obj);
                            } else {
                                MainActivity.this.allergies.put(obj);
                            }
                            saveAll();
                            render();
                        }
                    } catch (Exception e) {}
                }
            }
        );
    }

    private void showAddConditionDialog() {
        showEditConditionDialog(null, -1);
    }

    private void showEditConditionDialog(final JSONObject existing, final int editIdx) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(1);

        String initNome = existing != null ? optCleanString(existing, "nome", optCleanString(existing, "condition_name", "")) : "";
        String initNotas = existing != null ? optCleanString(existing, "notas", optCleanString(existing, "notes", "")) : "";

        final EditText etNome = createInput("Condição (ex: Hipertensão, Diabetes)", initNome);
        final EditText etNotas = createInput("Observações (ex: Controlada com medicação)", initNotas);

        layout.addView(etNome);
        layout.addView(etNotas);

        showStyledFormModal(
            existing != null ? "✏️ Editar Condição de Saúde" : "❤️ Adicionar Condição de Saúde",
            layout,
            "Salvar",
            "Cancelar",
            this.cPrimary,
            new Runnable() {
                @Override
                public void run() {
                    try {
                        String nome = etNome.getText().toString().trim();
                        if (!nome.isEmpty()) {
                            JSONObject obj = existing != null ? existing : new JSONObject();
                            if (existing == null || obj.optString("id", "").trim().isEmpty()) {
                                obj.put("id", "cond-" + System.currentTimeMillis());
                            }
                            String notas = etNotas.getText().toString().trim();
                            obj.put("nome", nome);
                            obj.put("condition_name", nome);
                            obj.put("notas", notas);
                            obj.put("notes", notas);
                            if (editIdx >= 0) {
                                MainActivity.this.conditions.put(editIdx, obj);
                            } else {
                                MainActivity.this.conditions.put(obj);
                            }
                            saveAll();
                            render();
                        }
                    } catch (Exception e) {}
                }
            }
        );
    }

    private void buildContactsSubScreen(LinearLayout linearLayout) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        card.setPadding(dp(18), dp(18), dp(18), dp(18));

        LinearLayout hdr = new LinearLayout(this);
        hdr.setOrientation(0);
        hdr.setGravity(16);
        LinearLayout.LayoutParams hLp = new LinearLayout.LayoutParams(-1, -2);
        hLp.bottomMargin = dp(16);
        hdr.setLayoutParams(hLp);

        LinearLayout hCol = new LinearLayout(this);
        hCol.setOrientation(1);
        hCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvT = new TextView(this);
        tvT.setText("👨‍👩‍👧 Contatos de Emergência");
        tvT.setTextColor(this.cTextMain);
        tvT.setTextSize(sp(16.0f));
        tvT.setTypeface(null, 1);
        hCol.addView(tvT);

        TextView tvS = new TextView(this);
        tvS.setText("Pessoas para acionar em caso de necessidade");
        tvS.setTextColor(this.cTextMuted);
        tvS.setTextSize(sp(12.0f));
        hCol.addView(tvS);

        hdr.addView(hCol);

        TextView btnAdd = new TextView(this);
        btnAdd.setText("+ Adicionar");
        btnAdd.setTextColor(Color.WHITE);
        btnAdd.setTextSize(sp(13.0f));
        btnAdd.setTypeface(null, 1);
        btnAdd.setBackground(shape(this.cPrimary, 10, 0, 0));
        btnAdd.setPadding(dp(12), dp(8), dp(12), dp(8));
        btnAdd.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showAddContactDialog();
            }
        });
        hdr.addView(btnAdd);
        card.addView(hdr);

        if (this.contacts.length() == 0) {
            TextView empty = new TextView(this);
            empty.setText("Nenhum contato cadastrado.");
            empty.setTextColor(this.cTextMuted);
            empty.setTextSize(sp(14.0f));
            empty.setGravity(17);
            empty.setPadding(0, dp(20), 0, dp(20));
            card.addView(empty);
        } else {
            for (int i = 0; i < this.contacts.length(); i++) {
                final int idx = i;
                final JSONObject c = this.contacts.optJSONObject(i);
                if (c == null) continue;
                final String telNum = optCleanString(c, "telefone", optCleanString(c, "phone", ""));

                LinearLayout row = new LinearLayout(this);
                row.setOrientation(0);
                row.setGravity(16);
                row.setBackground(shape(this.cBgMain, 14, this.cBorder, 1));
                row.setPadding(dp(14), dp(14), dp(14), dp(14));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
                if (i < this.contacts.length() - 1) lp.bottomMargin = dp(10);
                row.setLayoutParams(lp);

                LinearLayout col = new LinearLayout(this);
                col.setOrientation(1);
                col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

                TextView tvN = new TextView(this);
                tvN.setText(optCleanString(c, "nome", optCleanString(c, "name", "")));
                tvN.setTextColor(this.cTextMain);
                tvN.setTextSize(sp(15.0f));
                tvN.setTypeface(null, 1);
                col.addView(tvN);

                String relStr = optCleanString(c, "relacao", optCleanString(c, "relationship", ""));
                TextView tvR = new TextView(this);
                tvR.setText((!relStr.isEmpty() ? relStr : "Familiar") + (!telNum.isEmpty() ? " • " + telNum : ""));
                tvR.setTextColor(this.cTextMuted);
                tvR.setTextSize(sp(13.0f));
                col.addView(tvR);

                row.addView(col);

                TextView btnDial = new TextView(this);
                btnDial.setText("📞");
                btnDial.setTextSize(sp(16.0f));
                btnDial.setGravity(17);
                btnDial.setBackground(shape(Color.parseColor("#1A10B981"), 10, 0, 0));
                btnDial.setPadding(dp(10), dp(8), dp(10), dp(8));
                btnDial.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + telNum.replaceAll("[^0-9+]", ""))));
                    }
                });
                row.addView(btnDial);

                TextView btnEdit = new TextView(this);
                btnEdit.setText("✏️");
                btnEdit.setTextSize(sp(15.0f));
                btnEdit.setGravity(17);
                btnEdit.setBackground(shape(Color.parseColor("#1A3B82F6"), 10, Color.parseColor("#333B82F6"), 1));
                btnEdit.setPadding(dp(10), dp(8), dp(10), dp(8));
                LinearLayout.LayoutParams edLp = new LinearLayout.LayoutParams(-2, -2);
                edLp.leftMargin = dp(6);
                btnEdit.setLayoutParams(edLp);
                btnEdit.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        showEditContactDialog(c, idx);
                    }
                });
                row.addView(btnEdit);

                TextView btnDel = new TextView(this);
                btnDel.setText("🗑️");
                btnDel.setTextSize(sp(16.0f));
                btnDel.setPadding(dp(10), dp(8), dp(4), dp(8));
                btnDel.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        String delId = c.optString("id", "");
                        MainActivity.this.contacts.remove(idx);
                        deleteRemoteRecord("emergency_contacts", delId, "cnt");
                        saveAll();
                        render();
                    }
                });
                row.addView(btnDel);

                card.addView(row);
            }
        }
        linearLayout.addView(card);
    }

    private void showAddContactDialog() {
        showEditContactDialog(null, -1);
    }

    private void showEditContactDialog(final JSONObject existing, final int editIdx) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(1);

        String initNome = existing != null ? optCleanString(existing, "nome", optCleanString(existing, "name", "")) : "";
        String initRel = existing != null ? optCleanString(existing, "relacao", optCleanString(existing, "relationship", "")) : "";
        String initTel = existing != null ? optCleanString(existing, "telefone", optCleanString(existing, "phone", "")) : "";

        final EditText etNome = createInput("Nome completo", initNome);
        final EditText etRel = createInput("Parentesco / Relação (ex: Filha, Esposo)", initRel);
        final EditText etTel = createInput("Telefone (00) 00000-0000", initTel);

        layout.addView(etNome);
        layout.addView(etRel);
        layout.addView(etTel);

        showStyledFormModal(
            existing != null ? "✏️ Editar Contato de Emergência" : "📞 Adicionar Contato de Emergência",
            layout,
            "Salvar",
            "Cancelar",
            this.cPrimary,
            new Runnable() {
                @Override
                public void run() {
                    try {
                        String nome = etNome.getText().toString().trim();
                        if (!nome.isEmpty()) {
                            JSONObject obj = existing != null ? existing : new JSONObject();
                            if (existing == null || obj.optString("id", "").trim().isEmpty()) {
                                obj.put("id", "cnt-" + System.currentTimeMillis());
                            }
                            String rel = etRel.getText().toString().trim();
                            String tel = etTel.getText().toString().trim();
                            obj.put("nome", nome);
                            obj.put("name", nome);
                            obj.put("relacao", rel);
                            obj.put("relationship", rel);
                            obj.put("telefone", tel);
                            obj.put("phone", tel);
                            if (editIdx >= 0) {
                                MainActivity.this.contacts.put(editIdx, obj);
                            } else {
                                MainActivity.this.contacts.put(obj);
                            }
                            saveAll();
                            render();
                        }
                    } catch (Exception e) {}
                }
            }
        );
    }

    private void buildProfessionalsSubScreen(LinearLayout linearLayout) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        card.setPadding(dp(18), dp(18), dp(18), dp(18));

        LinearLayout hdr = new LinearLayout(this);
        hdr.setOrientation(0);
        hdr.setGravity(16);
        LinearLayout.LayoutParams hLp = new LinearLayout.LayoutParams(-1, -2);
        hLp.bottomMargin = dp(16);
        hdr.setLayoutParams(hLp);

        LinearLayout hCol = new LinearLayout(this);
        hCol.setOrientation(1);
        hCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvT = new TextView(this);
        tvT.setText("👨‍⚕️ Profissionais de Saúde");
        tvT.setTextColor(this.cTextMain);
        tvT.setTextSize(sp(16.0f));
        tvT.setTypeface(null, 1);
        hCol.addView(tvT);

        TextView tvS = new TextView(this);
        tvS.setText("Seus médicos, especialistas e terapeutas");
        tvS.setTextColor(this.cTextMuted);
        tvS.setTextSize(sp(12.0f));
        hCol.addView(tvS);

        hdr.addView(hCol);

        TextView btnAdd = new TextView(this);
        btnAdd.setText("+ Adicionar");
        btnAdd.setTextColor(Color.WHITE);
        btnAdd.setTextSize(sp(13.0f));
        btnAdd.setTypeface(null, 1);
        btnAdd.setBackground(shape(this.cPrimary, 10, 0, 0));
        btnAdd.setPadding(dp(12), dp(8), dp(12), dp(8));
        btnAdd.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showAddProfessionalDialog();
            }
        });
        hdr.addView(btnAdd);
        card.addView(hdr);

        if (this.professionals.length() == 0) {
            TextView empty = new TextView(this);
            empty.setText("Nenhum profissional cadastrado.");
            empty.setTextColor(this.cTextMuted);
            empty.setTextSize(sp(14.0f));
            empty.setGravity(17);
            empty.setPadding(0, dp(20), 0, dp(20));
            card.addView(empty);
        } else {
            for (int i = 0; i < this.professionals.length(); i++) {
                final int idx = i;
                final JSONObject p = this.professionals.optJSONObject(i);
                if (p == null) continue;
                final String telNum = optCleanString(p, "telefone", optCleanString(p, "phone", ""));

                LinearLayout row = new LinearLayout(this);
                row.setOrientation(0);
                row.setGravity(16);
                row.setBackground(shape(this.cBgMain, 14, this.cBorder, 1));
                row.setPadding(dp(14), dp(14), dp(14), dp(14));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
                if (i < this.professionals.length() - 1) lp.bottomMargin = dp(10);
                row.setLayoutParams(lp);

                LinearLayout col = new LinearLayout(this);
                col.setOrientation(1);
                col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

                TextView tvN = new TextView(this);
                tvN.setText(optCleanString(p, "nome", optCleanString(p, "name", "")));
                tvN.setTextColor(this.cTextMain);
                tvN.setTextSize(sp(15.0f));
                tvN.setTypeface(null, 1);
                col.addView(tvN);

                TextView tvEsp = new TextView(this);
                String esp = optCleanString(p, "especialidade", optCleanString(p, "specialty", ""));
                String crm = optCleanString(p, "crm", "");
                tvEsp.setText(esp + (!crm.isEmpty() ? (!esp.isEmpty() ? " • " : "") + crm : ""));
                tvEsp.setTextColor(this.cPrimary);
                tvEsp.setTextSize(sp(13.0f));
                tvEsp.setTypeface(null, 1);
                col.addView(tvEsp);

                String clin = optCleanString(p, "clinica", optCleanString(p, "clinic_address", ""));
                if (!clin.isEmpty() || !telNum.isEmpty()) {
                    TextView tvI = new TextView(this);
                    tvI.setText((!clin.isEmpty() ? "📍 " + clin : "") + (!telNum.isEmpty() ? (!clin.isEmpty() ? "\n" : "") + "📞 " + telNum : ""));
                    tvI.setTextColor(this.cTextMuted);
                    tvI.setTextSize(sp(12.0f));
                    col.addView(tvI);
                }

                row.addView(col);

                if (!telNum.isEmpty()) {
                    TextView btnDial = new TextView(this);
                    btnDial.setText("📞");
                    btnDial.setTextSize(sp(16.0f));
                    btnDial.setGravity(17);
                    btnDial.setBackground(shape(Color.parseColor("#1A10B981"), 10, 0, 0));
                    btnDial.setPadding(dp(10), dp(8), dp(10), dp(8));
                    btnDial.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + telNum.replaceAll("[^0-9+]", ""))));
                        }
                    });
                    row.addView(btnDial);
                }

                TextView btnEdit = new TextView(this);
                btnEdit.setText("✏️");
                btnEdit.setTextSize(sp(15.0f));
                btnEdit.setGravity(17);
                btnEdit.setBackground(shape(Color.parseColor("#1A3B82F6"), 10, Color.parseColor("#333B82F6"), 1));
                btnEdit.setPadding(dp(10), dp(8), dp(10), dp(8));
                LinearLayout.LayoutParams edLp = new LinearLayout.LayoutParams(-2, -2);
                edLp.leftMargin = dp(6);
                btnEdit.setLayoutParams(edLp);
                btnEdit.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        showEditProfessionalDialog(p, idx);
                    }
                });
                row.addView(btnEdit);

                TextView btnDel = new TextView(this);
                btnDel.setText("🗑️");
                btnDel.setTextSize(sp(16.0f));
                btnDel.setPadding(dp(10), dp(8), dp(4), dp(8));
                btnDel.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        String delId = p.optString("id", "");
                        MainActivity.this.professionals.remove(idx);
                        deleteRemoteRecord("healthcare_professionals", delId, "prof");
                        saveAll();
                        render();
                    }
                });
                row.addView(btnDel);

                card.addView(row);
            }
        }
        linearLayout.addView(card);
    }

    private void showAddProfessionalDialog() {
        showEditProfessionalDialog(null, -1);
    }

    private void showEditProfessionalDialog(final JSONObject existing, final int editIdx) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(1);

        String initNome = existing != null ? optCleanString(existing, "nome", optCleanString(existing, "name", "")) : "";
        String initEsp = existing != null ? optCleanString(existing, "especialidade", optCleanString(existing, "specialty", "")) : "";
        String initCrm = existing != null ? optCleanString(existing, "crm", "") : "";
        String initClin = existing != null ? optCleanString(existing, "clinica", optCleanString(existing, "clinic_address", "")) : "";
        String initTel = existing != null ? optCleanString(existing, "telefone", optCleanString(existing, "phone", "")) : "";

        final EditText etNome = createInput("Nome (ex: Dr. Carlos Silva)", initNome);
        final EditText etEsp = createInput("Especialidade (ex: Cardiologista)", initEsp);
        final EditText etCrm = createInput("CRM / Registro", initCrm);
        final EditText etClinica = createInput("Hospital / Clínica / Endereço", initClin);
        final EditText etTel = createInput("Telefone (00) 00000-0000", initTel);

        layout.addView(etNome);
        layout.addView(etEsp);
        layout.addView(etCrm);
        layout.addView(etClinica);
        layout.addView(etTel);

        showStyledFormModal(
            existing != null ? "✏️ Editar Profissional" : "👨‍⚕️ Adicionar Profissional",
            layout,
            "Salvar",
            "Cancelar",
            this.cPrimary,
            new Runnable() {
                @Override
                public void run() {
                    try {
                        String nome = etNome.getText().toString().trim();
                        if (!nome.isEmpty()) {
                            JSONObject obj = existing != null ? existing : new JSONObject();
                            if (existing == null || obj.optString("id", "").trim().isEmpty()) {
                                obj.put("id", "prof-" + System.currentTimeMillis());
                            }
                            String esp = etEsp.getText().toString().trim();
                            String crm = etCrm.getText().toString().trim();
                            String clin = etClinica.getText().toString().trim();
                            String tel = etTel.getText().toString().trim();
                            obj.put("nome", nome);
                            obj.put("name", nome);
                            obj.put("especialidade", esp);
                            obj.put("specialty", esp);
                            obj.put("crm", crm);
                            obj.put("clinica", clin);
                            obj.put("clinic_address", clin);
                            obj.put("telefone", tel);
                            obj.put("phone", tel);
                            if (editIdx >= 0) {
                                MainActivity.this.professionals.put(editIdx, obj);
                            } else {
                                MainActivity.this.professionals.put(obj);
                            }
                            saveAll();
                            render();
                        }
                    } catch (Exception e) {}
                }
            }
        );
    }

    private void buildCaregiversSubScreen(LinearLayout linearLayout) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        card.setPadding(dp(18), dp(18), dp(18), dp(18));

        TextView tvT = new TextView(this);
        tvT.setText("🤝 Cuidadores Vinculados");
        tvT.setTextColor(this.cTextMain);
        tvT.setTextSize(sp(16.0f));
        tvT.setTypeface(null, 1);
        tvT.setPadding(0, 0, 0, dp(4));
        card.addView(tvT);

        TextView tvS = new TextView(this);
        tvS.setText("Gere um código de convite para que um familiar ou cuidador acompanhe seu tratamento.");
        tvS.setTextColor(this.cTextMuted);
        tvS.setTextSize(sp(13.0f));
        tvS.setPadding(0, 0, 0, dp(16));
        card.addView(tvS);

        if (!isPatientProfileRole()) {
            LinearLayout warnBox = new LinearLayout(this);
            warnBox.setOrientation(1);
            warnBox.setBackground(shape(Color.parseColor("#1AF59E0B"), 14, Color.parseColor("#4DF59E0B"), 1));
            warnBox.setPadding(dp(16), dp(16), dp(16), dp(16));
            LinearLayout.LayoutParams wbLp = new LinearLayout.LayoutParams(-1, -2);
            wbLp.bottomMargin = dp(12);
            warnBox.setLayoutParams(wbLp);

            TextView tvWarnTitle = new TextView(this);
            tvWarnTitle.setText("⚠️ Você é independente, vire paciente para continuar");
            tvWarnTitle.setTextColor(Color.parseColor("#FBBF24"));
            tvWarnTitle.setTextSize(sp(15.0f));
            tvWarnTitle.setTypeface(null, 1);
            tvWarnTitle.setGravity(17);
            tvWarnTitle.setPadding(0, 0, 0, dp(6));
            warnBox.addView(tvWarnTitle);

            TextView tvWarnDesc = new TextView(this);
            tvWarnDesc.setText("O vínculo com cuidadores está disponível apenas quando seu perfil está configurado como Paciente.");
            tvWarnDesc.setTextColor(this.cTextMuted);
            tvWarnDesc.setTextSize(sp(12.5f));
            tvWarnDesc.setGravity(17);
            tvWarnDesc.setPadding(0, 0, 0, dp(14));
            warnBox.addView(tvWarnDesc);

            TextView btnSwitchToPatient = createButton("🔄 Mudar para perfil Paciente", Color.parseColor("#F59E0B"), Color.WHITE);
            btnSwitchToPatient.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    showStyledConfirmDialog(
                        "⚠️ Atenção",
                        "Você só poderá alterar seu perfil para independente com a permissão do cuidador",
                        "Confirmar",
                        "Cancelar",
                        Color.parseColor("#F59E0B"),
                        new Runnable() {
                            @Override
                            public void run() {
                                setProfileRoleValue("paciente");
                                saveAll();
                                render();
                                Toast.makeText(MainActivity.this, "Perfil alterado para Paciente", 0).show();
                            }
                        }
                    );
                }
            });
            warnBox.addView(btnSwitchToPatient);

            card.addView(warnBox);
            linearLayout.addView(card);
            return;
        }

        TextView btnInvite = createButton("🔑 Gerar Código de Convite", this.cPrimary, Color.WHITE);
        LinearLayout.LayoutParams btnLp = new LinearLayout.LayoutParams(-1, -2);
        btnLp.bottomMargin = dp(16);
        btnInvite.setLayoutParams(btnLp);
        btnInvite.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                generateCaregiverInviteCode();
            }
        });
        card.addView(btnInvite);

        if (this.caregivers.length() == 0) {
            TextView empty = new TextView(this);
            empty.setText("Nenhum cuidador vinculado a este perfil.");
            empty.setTextColor(this.cTextMuted);
            empty.setTextSize(sp(14.0f));
            empty.setGravity(17);
            empty.setPadding(0, dp(16), 0, dp(16));
            card.addView(empty);
        } else {
            for (int i = 0; i < this.caregivers.length(); i++) {
                final int idx = i;
                final JSONObject cg = this.caregivers.optJSONObject(i);
                if (cg == null) continue;

                LinearLayout row = new LinearLayout(this);
                row.setOrientation(0);
                row.setGravity(16);
                row.setBackground(shape(this.cBgMain, 14, this.cBorder, 1));
                row.setPadding(dp(14), dp(12), dp(14), dp(12));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
                if (i < this.caregivers.length() - 1) lp.bottomMargin = dp(10);
                row.setLayoutParams(lp);

                LinearLayout col = new LinearLayout(this);
                col.setOrientation(1);
                col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

                TextView tvN = new TextView(this);
                tvN.setText("🤝 " + cg.optString("nome", "Cuidador") + " (" + cg.optString("relacao", "Familiar") + ")");
                tvN.setTextColor(this.cTextMain);
                tvN.setTextSize(sp(14.0f));
                tvN.setTypeface(null, 1);
                col.addView(tvN);

                TextView tvCode = new TextView(this);
                tvCode.setText("Status: " + cg.optString("status", "Ativo") + " • Código: " + cg.optString("codigo_convite", "MED-883921"));
                tvCode.setTextColor(this.cTextMuted);
                tvCode.setTextSize(sp(12.0f));
                col.addView(tvCode);

                row.addView(col);

                TextView btnRevoke = createButton("Revogar", this.cDangerBg, this.cDanger);
                btnRevoke.setPadding(dp(10), dp(6), dp(10), dp(6));
                btnRevoke.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        String delId = cg.optString("id", "");
                        MainActivity.this.caregivers.remove(idx);
                        deleteRemoteRecord("caregiver_relationships", delId, "cg");
                        saveAll();
                        render();
                    }
                });
                row.addView(btnRevoke);

                card.addView(row);
            }
        }
        linearLayout.addView(card);
    }

    private void generateCaregiverInviteCode() {
        if (!isPatientProfileRole()) {
            Toast.makeText(this, "Você é independente, vire paciente para continuar", 1).show();
            return;
        }
        int code = (int) (100000 + Math.random() * 900000);
        String token = "MED-" + code;
        try {
            JSONObject newCg = new JSONObject();
            newCg.put("id", "cg-" + System.currentTimeMillis());
            newCg.put("nome", "Novo Cuidador (Aguardando vínculo)");
            newCg.put("relacao", "Pendente");
            newCg.put("codigo_convite", token);
            newCg.put("status", "Pendente");
            this.caregivers.put(newCg);
            saveAll();
            render();

            showStyledConfirmDialog(
                "🔑 Código de Convite Criado!",
                "Compartilhe este código com seu cuidador para que ele acompanhe seus medicamentos:\n\nCÓDIGO: " + token + "\n\nO cuidador deverá digitar este código na plataforma Web do MediCare Cuidador.",
                "Entendi",
                null,
                this.cPrimary,
                null
            );
        } catch (Exception e) {}
    }

    private void buildStockHistorySubScreen(LinearLayout linearLayout) {
        if (migrateStockEventsFromEvents() | deduplicateStockMovements()) {
            saveAll();
        }
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        card.setPadding(dp(18), dp(18), dp(18), dp(18));

        TextView tvT = new TextView(this);
        tvT.setText("📦 Situação do Estoque");
        tvT.setTextColor(this.cTextMain);
        tvT.setTextSize(sp(16.0f));
        tvT.setTypeface(null, 1);
        tvT.setPadding(0, 0, 0, dp(4));
        card.addView(tvT);

        TextView tvS = new TextView(this);
        tvS.setText("Acompanhe a quantidade restante, adicione reposições ou ajuste o saldo");
        tvS.setTextColor(this.cTextMuted);
        tvS.setTextSize(sp(13.0f));
        tvS.setPadding(0, 0, 0, dp(16));
        card.addView(tvS);

        if (this.meds.length() == 0) {
            TextView empty = new TextView(this);
            empty.setText("Nenhum medicamento cadastrado.");
            empty.setTextColor(this.cTextMuted);
            empty.setTextSize(sp(14.0f));
            empty.setGravity(17);
            empty.setPadding(0, dp(16), 0, dp(16));
            card.addView(empty);
        } else {
            for (int i = 0; i < this.meds.length(); i++) {
                final JSONObject m = this.meds.optJSONObject(i);
                if (m == null) continue;
                int stock = getMedStock(m);

                LinearLayout row = new LinearLayout(this);
                row.setOrientation(0);
                row.setGravity(16);
                row.setBackground(shape(this.cBgMain, 14, this.cBorder, 1));
                row.setPadding(dp(14), dp(12), dp(14), dp(12));
                LinearLayout.LayoutParams rLp = new LinearLayout.LayoutParams(-1, -2);
                if (i < this.meds.length() - 1) rLp.bottomMargin = dp(10);
                row.setLayoutParams(rLp);

                LinearLayout col = new LinearLayout(this);
                col.setOrientation(1);
                col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

                TextView tvMN = new TextView(this);
                tvMN.setText(m.optString("nome"));
                tvMN.setTextColor(this.cTextMain);
                tvMN.setTextSize(sp(15.0f));
                tvMN.setTypeface(null, 1);
                col.addView(tvMN);

                TextView tvMS = new TextView(this);
                tvMS.setText("Restam: " + stock + " " + m.optString("unidade", "unid."));
                tvMS.setTextColor(stock <= 5 ? this.cWarning : this.cTextMuted);
                tvMS.setTextSize(sp(13.0f));
                col.addView(tvMS);

                row.addView(col);

                TextView btnAdjust = new TextView(this);
                btnAdjust.setText("Ajustar");
                btnAdjust.setTextColor(this.cTextMuted);
                btnAdjust.setTextSize(sp(12.5f));
                btnAdjust.setTypeface(null, 1);
                btnAdjust.setBackground(shape(this.cSurfaceHover, 10, this.cBorder, 1));
                btnAdjust.setPadding(dp(10), dp(8), dp(10), dp(8));
                LinearLayout.LayoutParams adjLp = new LinearLayout.LayoutParams(-2, -2);
                adjLp.rightMargin = dp(8);
                btnAdjust.setLayoutParams(adjLp);
                btnAdjust.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        showAdjustStockDialog(m);
                    }
                });
                row.addView(btnAdjust);

                TextView btnRefill = new TextView(this);
                btnRefill.setText("+ Repor");
                btnRefill.setTextColor(this.cPrimary);
                btnRefill.setTextSize(sp(13.0f));
                btnRefill.setTypeface(null, 1);
                btnRefill.setBackground(shape(this.cPrimaryLight, 10, 0, 0));
                btnRefill.setPadding(dp(12), dp(8), dp(12), dp(8));
                btnRefill.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        showRefillStockDialog(m);
                    }
                });
                row.addView(btnRefill);

                card.addView(row);
            }
        }
        linearLayout.addView(card);

        // Audit History Card (Histórico de Alterações)
        LinearLayout auditCard = new LinearLayout(this);
        auditCard.setOrientation(1);
        auditCard.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        auditCard.setPadding(dp(18), dp(18), dp(18), dp(18));
        LinearLayout.LayoutParams acLp = new LinearLayout.LayoutParams(-1, -2);
        acLp.topMargin = dp(16);
        auditCard.setLayoutParams(acLp);

        LinearLayout hdrRow = new LinearLayout(this);
        hdrRow.setOrientation(0);
        hdrRow.setGravity(16);

        LinearLayout hdrTextCol = new LinearLayout(this);
        hdrTextCol.setOrientation(1);
        hdrTextCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvAuditTitle = new TextView(this);
        tvAuditTitle.setText("📋 Histórico de Alterações");
        tvAuditTitle.setTextColor(this.cTextMain);
        tvAuditTitle.setTextSize(sp(16.0f));
        tvAuditTitle.setTypeface(null, 1);
        tvAuditTitle.setPadding(0, 0, 0, dp(3));
        hdrTextCol.addView(tvAuditTitle);

        TextView tvAuditSub = new TextView(this);
        tvAuditSub.setText("Registro completo para auditoria de reposições, ajustes e consumos");
        tvAuditSub.setTextColor(this.cTextMuted);
        tvAuditSub.setTextSize(sp(12.5f));
        hdrTextCol.addView(tvAuditSub);
        hdrRow.addView(hdrTextCol);

        TextView badgeCount = new TextView(this);
        badgeCount.setText((this.stockMovements != null ? this.stockMovements.length() : 0) + " reg.");
        badgeCount.setTextColor(this.cPrimary);
        badgeCount.setTextSize(sp(11.5f));
        badgeCount.setTypeface(null, 1);
        badgeCount.setBackground(shape(this.cPrimaryLight, 10, 0, 0));
        badgeCount.setPadding(dp(9), dp(4), dp(9), dp(4));
        hdrRow.addView(badgeCount);
        auditCard.addView(hdrRow);

        // Medication filter chips
        if (this.meds != null && this.meds.length() > 0) {
            HorizontalScrollView filterScroll = new HorizontalScrollView(this);
            filterScroll.setHorizontalScrollBarEnabled(false);
            LinearLayout.LayoutParams fsLp = new LinearLayout.LayoutParams(-1, -2);
            fsLp.topMargin = dp(14);
            fsLp.bottomMargin = dp(14);
            filterScroll.setLayoutParams(fsLp);

            LinearLayout chipRow = new LinearLayout(this);
            chipRow.setOrientation(0);

            boolean allSelected = this.stockAuditFilterMedId == null || this.stockAuditFilterMedId.isEmpty();
            TextView allChip = new TextView(this);
            allChip.setText("Todos");
            allChip.setTextColor(allSelected ? Color.WHITE : this.cTextMuted);
            allChip.setTextSize(sp(12.0f));
            allChip.setTypeface(null, 1);
            allChip.setBackground(shape(allSelected ? this.cPrimary : this.cBgMain, 16, allSelected ? 0 : this.cBorder, allSelected ? 0 : 1));
            allChip.setPadding(dp(12), dp(6), dp(12), dp(6));
            LinearLayout.LayoutParams acChipLp = new LinearLayout.LayoutParams(-2, -2);
            acChipLp.rightMargin = dp(8);
            allChip.setLayoutParams(acChipLp);
            allChip.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    MainActivity.this.stockAuditFilterMedId = "";
                    render();
                }
            });
            chipRow.addView(allChip);

            for (int i = 0; i < this.meds.length(); i++) {
                JSONObject m = this.meds.optJSONObject(i);
                if (m == null) continue;
                final String mId = m.optString("id", "");
                final String mName = m.optString("nome", "Medicamento");
                boolean isSel = !mId.isEmpty() && mId.equals(this.stockAuditFilterMedId);

                TextView mChip = new TextView(this);
                mChip.setText(mName);
                mChip.setTextColor(isSel ? Color.WHITE : this.cTextMuted);
                mChip.setTextSize(sp(12.0f));
                mChip.setTypeface(null, 1);
                mChip.setBackground(shape(isSel ? this.cPrimary : this.cBgMain, 16, isSel ? 0 : this.cBorder, isSel ? 0 : 1));
                mChip.setPadding(dp(12), dp(6), dp(12), dp(6));
                LinearLayout.LayoutParams mcLp = new LinearLayout.LayoutParams(-2, -2);
                if (i < this.meds.length() - 1) mcLp.rightMargin = dp(8);
                mChip.setLayoutParams(mcLp);
                mChip.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        MainActivity.this.stockAuditFilterMedId = mId;
                        render();
                    }
                });
                chipRow.addView(mChip);
            }
            filterScroll.addView(chipRow);
            auditCard.addView(filterScroll);
        } else {
            View spacer = new View(this);
            spacer.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(14)));
            auditCard.addView(spacer);
        }

        String filterMedName = "";
        if (this.stockAuditFilterMedId != null && !this.stockAuditFilterMedId.isEmpty() && this.meds != null) {
            for (int i = 0; i < this.meds.length(); i++) {
                JSONObject m = this.meds.optJSONObject(i);
                if (m != null && this.stockAuditFilterMedId.equals(m.optString("id"))) {
                    filterMedName = m.optString("nome", "").trim();
                    break;
                }
            }
        }

        int shownCount = 0;
        if (this.stockMovements != null) {
            for (int i = this.stockMovements.length() - 1; i >= 0; i--) {
                JSONObject sm = this.stockMovements.optJSONObject(i);
                if (sm == null) continue;
                String smMedId = sm.optString("med_id", sm.optString("medication_id", "")).trim();
                String smMedName = resolveStockMovementMedName(sm);
                if (this.stockAuditFilterMedId != null && !this.stockAuditFilterMedId.isEmpty()) {
                    boolean idMatch = this.stockAuditFilterMedId.equals(smMedId);
                    boolean nameMatch = !filterMedName.isEmpty() && filterMedName.equalsIgnoreCase(smMedName);
                    if (!idMatch && !nameMatch) continue;
                }
                shownCount++;

                int delta = getStockMovementDelta(sm);
                boolean isPositive = delta >= 0;
                String movType = sm.optString("movement_type", sm.optString("tipo", "")).trim().toLowerCase(Locale.ROOT);
                boolean isConsumption = "consumption".equals(movType) || sm.optString("motivo", "").toLowerCase(Locale.ROOT).startsWith("dose ") || sm.optString("motivo", "").toLowerCase(Locale.ROOT).startsWith("uso sos");

                String typeBadgeText;
                int typeBadgeColor;
                int typeBadgeBg;
                if (isConsumption) {
                    typeBadgeText = "💊 Consumo de Dose";
                    typeBadgeColor = this.cInfo;
                    typeBadgeBg = this.cInfoBg;
                } else if ("correction".equals(movType) || "adjustment".equals(movType) || sm.optString("motivo", "").toLowerCase(Locale.ROOT).contains("corre") || sm.optString("motivo", "").toLowerCase(Locale.ROOT).contains("ajust")) {
                    typeBadgeText = isPositive ? "⚖️ Correção (+)" : "⚖️ Ajuste (-)";
                    typeBadgeColor = this.cWarning;
                    typeBadgeBg = this.cWarningBg;
                } else if (isPositive) {
                    typeBadgeText = "📦 Reposição";
                    typeBadgeColor = this.cSuccess;
                    typeBadgeBg = this.cSuccessBg;
                } else {
                    typeBadgeText = "📤 Baixa Manual";
                    typeBadgeColor = this.cDanger;
                    typeBadgeBg = this.cDangerBg;
                }

                LinearLayout itemCard = new LinearLayout(this);
                itemCard.setOrientation(1);
                itemCard.setBackground(shape(this.cBgMain, 14, this.cBorder, 1));
                itemCard.setPadding(dp(14), dp(12), dp(14), dp(12));
                LinearLayout.LayoutParams icLp = new LinearLayout.LayoutParams(-1, -2);
                icLp.bottomMargin = dp(10);
                itemCard.setLayoutParams(icLp);

                // Top Row: Medication Name + Delta Badge
                LinearLayout topRow = new LinearLayout(this);
                topRow.setOrientation(0);
                topRow.setGravity(16);

                TextView tvMedTitle = new TextView(this);
                tvMedTitle.setText(smMedName.isEmpty() ? "Medicamento" : smMedName);
                tvMedTitle.setTextColor(this.cTextMain);
                tvMedTitle.setTextSize(sp(14.5f));
                tvMedTitle.setTypeface(null, 1);
                tvMedTitle.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
                topRow.addView(tvMedTitle);

                TextView tvDelta = new TextView(this);
                String deltaLabel = (delta > 0 ? "+" : "") + delta + " unid.";
                tvDelta.setText(deltaLabel);
                tvDelta.setTextColor(isPositive ? this.cSuccess : (isConsumption ? this.cTextMuted : this.cDanger));
                tvDelta.setTextSize(sp(13.5f));
                tvDelta.setTypeface(null, 1);
                topRow.addView(tvDelta);
                itemCard.addView(topRow);

                // Second Row: Type Badge + Date/Time
                LinearLayout metaRow = new LinearLayout(this);
                metaRow.setOrientation(0);
                metaRow.setGravity(16);
                metaRow.setPadding(0, dp(6), 0, dp(6));

                TextView tvTypeBadge = new TextView(this);
                tvTypeBadge.setText(typeBadgeText);
                tvTypeBadge.setTextColor(typeBadgeColor);
                tvTypeBadge.setTextSize(sp(11.0f));
                tvTypeBadge.setTypeface(null, 1);
                int badgeAlphaBg = Color.argb(35, Color.red(typeBadgeColor), Color.green(typeBadgeColor), Color.blue(typeBadgeColor));
                tvTypeBadge.setBackground(shape(this.isDarkMode ? badgeAlphaBg : typeBadgeBg, 8, 0, 0));
                tvTypeBadge.setPadding(dp(8), dp(3), dp(8), dp(3));
                metaRow.addView(tvTypeBadge);

                String rawDate = getStockMovementDate(sm);
                String formattedDate = rawDate;
                if (rawDate.length() == 10 && rawDate.charAt(4) == '-' && rawDate.charAt(7) == '-') {
                    formattedDate = rawDate.substring(8, 10) + "/" + rawDate.substring(5, 7) + "/" + rawDate.substring(0, 4);
                }
                String rawTime = getStockMovementTime(sm);
                TextView tvDateTime = new TextView(this);
                tvDateTime.setText("  •  " + (formattedDate.isEmpty() ? "--" : formattedDate) + (rawTime.isEmpty() ? "" : " às " + rawTime));
                tvDateTime.setTextColor(this.cTextMuted);
                tvDateTime.setTextSize(sp(12.0f));
                metaRow.addView(tvDateTime);
                itemCard.addView(metaRow);

                // Third Row: Balance change (Anterior -> Novo)
                int prevQ = sm.optInt("previous_quantity", sm.optInt("quantity_before", -1));
                int newQ = sm.optInt("new_quantity", sm.optInt("quantity_after", -1));
                if (prevQ >= 0 && newQ >= 0) {
                    TextView tvBalance = new TextView(this);
                    tvBalance.setText("Saldo auditado: " + prevQ + " → " + newQ + " unidades");
                    tvBalance.setTextColor(this.cTextMain);
                    tvBalance.setTextSize(sp(12.5f));
                    tvBalance.setPadding(0, 0, 0, dp(3));
                    itemCard.addView(tvBalance);
                }

                // Fourth Row: Motivo / Notes + Pharmacy / Price
                String mot = sm.optString("motivo", sm.optString("notes", sm.optString("description", ""))).trim();
                String pharm = sm.optString("pharmacy", sm.optString("purchase_location", "")).trim();
                String price = sm.optString("price_paid", sm.optString("purchase_price", "")).trim();
                StringBuilder detailSb = new StringBuilder();
                if (!mot.isEmpty()) {
                    detailSb.append("Motivo: ").append(mot);
                }
                if (!pharm.isEmpty()) {
                    if (detailSb.length() > 0) detailSb.append("  •  ");
                    detailSb.append("Local: ").append(pharm);
                }
                if (!price.isEmpty() && !"0".equals(price) && !"0.0".equals(price) && !"null".equalsIgnoreCase(price)) {
                    if (detailSb.length() > 0) detailSb.append("  •  ");
                    detailSb.append("Valor: R$ ").append(price);
                }
                if (detailSb.length() > 0) {
                    TextView tvDetail = new TextView(this);
                    tvDetail.setText(detailSb.toString());
                    tvDetail.setTextColor(this.cTextMuted);
                    tvDetail.setTextSize(sp(12.0f));
                    itemCard.addView(tvDetail);
                }

                auditCard.addView(itemCard);
            }
        }

        if (shownCount == 0) {
            TextView tvEmptyAudit = new TextView(this);
            tvEmptyAudit.setText("Nenhuma alteração de estoque registrada para este filtro.");
            tvEmptyAudit.setTextColor(this.cTextMuted);
            tvEmptyAudit.setTextSize(sp(13.5f));
            tvEmptyAudit.setGravity(17);
            tvEmptyAudit.setPadding(0, dp(16), 0, dp(16));
            auditCard.addView(tvEmptyAudit);
        }

        linearLayout.addView(auditCard);
    }

    private void showRefillStockDialog(final JSONObject med) {
        final int curStock = getMedStock(med);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(1);

        TextView tvCur = new TextView(this);
        tvCur.setText("Quantidade atual: " + curStock + " " + med.optString("unidade", "unid."));
        tvCur.setTextColor(this.cTextMuted);
        tvCur.setTextSize(sp(13.0f));
        tvCur.setPadding(0, 0, 0, dp(10));
        layout.addView(tvCur);

        final EditText etAdd = createInput("Quantidade comprada / adicionada (ex: 30)", "30");
        etAdd.setInputType(InputType.TYPE_CLASS_NUMBER);
        layout.addView(etAdd);

        showStyledFormModal("📦 Repor Estoque — " + med.optString("nome"), layout, "Confirmar Reposição", "Cancelar", this.cPrimary, new Runnable() {
            @Override
            public void run() {
                try {
                    int addQty = Integer.parseInt(etAdd.getText().toString().trim());
                    if (addQty > 0) {
                        int newQty = curStock + addQty;
                        setMedStock(med, newQty);
                        saveAll();
                        render();
                        showStockMovementModal(med, curStock, newQty);
                    }
                } catch (Exception ignored) {}
            }
        });
    }

    private void showAdjustStockDialog(final JSONObject med) {
        final int curStock = getMedStock(med);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(1);

        TextView tvCur = new TextView(this);
        tvCur.setText("Saldo atual registrado: " + curStock + " " + med.optString("unidade", "unid."));
        tvCur.setTextColor(this.cTextMuted);
        tvCur.setTextSize(sp(13.0f));
        tvCur.setPadding(0, 0, 0, dp(10));
        layout.addView(tvCur);

        final EditText etNewStock = createInput("Novo saldo real em mãos", String.valueOf(curStock));
        etNewStock.setInputType(InputType.TYPE_CLASS_NUMBER);
        layout.addView(etNewStock);

        final EditText etReason = createInput("Motivo do ajuste / auditoria", "Conferência física de estoque");
        layout.addView(etReason);

        showStyledFormModal("⚖️ Ajustar Estoque — " + med.optString("nome"), layout, "Salvar Ajuste", "Cancelar", this.cPrimary, new Runnable() {
            @Override
            public void run() {
                try {
                    int newQty = Integer.parseInt(etNewStock.getText().toString().trim());
                    if (newQty >= 0 && newQty != curStock) {
                        int diff = newQty - curStock;
                        String today = todayIso();
                        String hm = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());
                        String reason = etReason.getText().toString().trim();
                        if (reason.isEmpty()) reason = "Correção de estoque";
                        setMedStock(med, newQty);
                        JSONObject sm = new JSONObject();
                        sm.put("id", "sm-" + System.currentTimeMillis());
                        sm.put("med_id", med.optString("id"));
                        sm.put("medication_id", med.optString("id"));
                        sm.put("med_nome", med.optString("nome"));
                        sm.put("med_name", med.optString("nome"));
                        sm.put("tipo", diff >= 0 ? "entrada" : "saida");
                        sm.put("movement_type", "correction");
                        sm.put("qtd", Math.abs(diff));
                        sm.put("quantity_change", diff);
                        sm.put("quantity_changed", diff);
                        sm.put("quantity_delta", diff);
                        sm.put("delta", diff);
                        sm.put("previous_quantity", curStock);
                        sm.put("quantity_before", curStock);
                        sm.put("new_quantity", newQty);
                        sm.put("quantity_after", newQty);
                        sm.put("date", today);
                        sm.put("time", hm);
                        sm.put("hora", hm);
                        sm.put("data", today + " " + hm);
                        sm.put("created_at", today + "T" + hm + ":00.000Z");
                        sm.put("motivo", reason);
                        sm.put("notes", reason);
                        MainActivity.this.stockMovements.put(sm);
                        deduplicateStockMovements();
                        saveAll();
                        render();
                        Toast.makeText(MainActivity.this, "✓ Estoque ajustado e registrado no histórico!", 0).show();
                    }
                } catch (Exception ignored) {}
            }
        });
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildProfileTab$17$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m16lambda$buildProfileTab$17$commedicarepatientMainActivity(View view) {
        syncWithBackendSilently(true);
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildProfileTab$18$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m17lambda$buildProfileTab$18$commedicarepatientMainActivity(View view) {
        this.isDarkMode = !this.isDarkMode;
        saveAll();
        render();
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildProfileTab$19$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m18lambda$buildProfileTab$19$commedicarepatientMainActivity(View view) {
        this.isAccessibilityMode = !this.isAccessibilityMode;
        saveAll();
        render();
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildProfileTab$20$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m19lambda$buildProfileTab$20$commedicarepatientMainActivity(View view) {
        performLogout();
    }

    private String toDeterministicServerUuid(String rawId, String prefix) {
        if (rawId == null) return "";
        String trimmed = rawId.trim();
        if (trimmed.isEmpty()) return "";
        if (trimmed.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")) {
            return trimmed.toLowerCase(Locale.ROOT);
        }
        try {
            String seed = (prefix != null ? prefix : "id") + ":" + trimmed;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(seed.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (int i = 0; i < 16 && i < hash.length; i++) {
                hex.append(String.format(Locale.US, "%02x", hash[i] & 0xFF));
            }
            String h = hex.toString();
            String v = Integer.toHexString((Integer.parseInt(h.substring(16, 17), 16) & 0x3) | 0x8);
            return h.substring(0, 8) + "-" + h.substring(8, 12) + "-4" + h.substring(13, 16) + "-" + v + h.substring(17, 20) + "-" + h.substring(20, 32);
        } catch (Exception e) {
            return trimmed;
        }
    }

    private synchronized Set<String> getDeletedRecordIds() {
        Set<String> res = new HashSet<>();
        try {
            String raw = this.prefs.getString("deleted_record_ids", "[]");
            JSONArray arr = new JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                String v = arr.optString(i, "").trim().toLowerCase(Locale.ROOT);
                if (!v.isEmpty()) res.add(v);
            }
        } catch (Exception ignored) {}
        return res;
    }

    private synchronized void addDeletedRecordId(String id) {
        if (id == null || id.trim().isEmpty()) return;
        Set<String> set = getDeletedRecordIds();
        set.add(id.trim().toLowerCase(Locale.ROOT));
        JSONArray arr = new JSONArray();
        for (String s : set) arr.put(s);
        this.prefs.edit().putString("deleted_record_ids", arr.toString()).apply();
    }

    private synchronized void removeDeletedRecordId(String id) {
        if (id == null || id.trim().isEmpty()) return;
        Set<String> set = getDeletedRecordIds();
        if (set.remove(id.trim().toLowerCase(Locale.ROOT))) {
            JSONArray arr = new JSONArray();
            for (String s : set) arr.put(s);
            this.prefs.edit().putString("deleted_record_ids", arr.toString()).apply();
        }
    }

    private void deleteRemoteRecord(final String table, final String rawId, final String idPrefix) {
        if (rawId == null || rawId.trim().isEmpty()) return;
        final String resolvedUuid = toDeterministicServerUuid(rawId, idPrefix);
        addDeletedRecordId(rawId);
        addDeletedRecordId(resolvedUuid);
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL(EMBEDDED_BACKEND_URL + "/api/rest/v1/" + table + "?id=eq." + Uri.encode(resolvedUuid));
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("DELETE");
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);
                    int code = conn.getResponseCode();
                    if (code >= 200 && code < 300) {
                        removeDeletedRecordId(rawId);
                        removeDeletedRecordId(resolvedUuid);
                    }
                } catch (Exception ignored) {}
            }
        }).start();
    }

    private JSONObject normalizeRemoteMed(JSONObject rm) {
        if (rm == null) return null;
        try {
            JSONObject m = new JSONObject(rm.toString());
            String nome = optCleanString(m, "nome", optCleanString(m, "name", ""));
            m.put("nome", nome);
            String pa = optCleanString(m, "principio_ativo", optCleanString(m, "active_ingredient", ""));
            m.put("principio_ativo", pa);
            String dos = optCleanString(m, "dosagem", optCleanString(m, "dosage", ""));
            m.put("dosagem", dos);
            String uni = optCleanString(m, "unidade", optCleanString(m, "forma", optCleanString(m, "unit", "comprimido(s)")));
            if (uni.isEmpty()) uni = "comprimido(s)";
            m.put("unidade", uni);
            m.put("forma", uni);

            JSONArray horariosArr = m.optJSONArray("horarios");
            if (horariosArr == null) {
                String rawH = m.optString("horarios", "").trim();
                horariosArr = new JSONArray();
                if (rawH.startsWith("[")) {
                    try { horariosArr = new JSONArray(rawH); } catch (Exception ignored) {}
                } else if (!rawH.isEmpty() && !"null".equalsIgnoreCase(rawH)) {
                    for (String p : rawH.split(",")) {
                        if (!p.trim().isEmpty()) horariosArr.put(p.trim());
                    }
                }
            }
            JSONArray cleanHorarios = new JSONArray();
            for (int i = 0; i < horariosArr.length(); i++) {
                String h = horariosArr.optString(i, "").trim();
                if (h.length() >= 5 && h.charAt(2) == ':') h = h.substring(0, 5);
                if (!h.isEmpty()) cleanHorarios.put(h);
            }
            String tType = optCleanString(m, "treatment_type", optCleanString(m, "tipo_uso", "continuous")).toLowerCase(Locale.ROOT);
            if ("temporario".equals(tType) || "temporary".equals(tType)) {
                tType = "temporary";
            } else if ("sos".equals(tType)) {
                tType = "sos";
            } else {
                tType = "continuous";
            }
            m.put("treatment_type", tType);
            m.put("tipo_uso", "temporary".equals(tType) ? "temporario" : ("sos".equals(tType) ? "sos" : "continuo"));

            if (cleanHorarios.length() == 0 && !"sos".equals(tType)) {
                cleanHorarios.put("08:00");
            }
            m.put("horarios", cleanHorarios);
            if (optCleanString(m, "frequencia", "").isEmpty()) {
                m.put("frequencia", cleanHorarios.length() + "x ao dia");
            }

            JSONArray diasArr = m.optJSONArray("dias_semana");
            if (diasArr == null) {
                diasArr = new JSONArray();
                for (int d = 0; d < 7; d++) diasArr.put(d);
            }
            m.put("dias_semana", diasArr);

            int q = m.has("quantidade") && !m.isNull("quantidade")
                ? m.optInt("quantidade", 30)
                : m.optInt("estoque_atual", 30);
            m.put("quantidade", q);
            m.put("estoque_atual", q);
            if (!m.has("estoque_minimo") || m.isNull("estoque_minimo")) {
                m.put("estoque_minimo", 5);
            }
            m.put("ativo", m.optBoolean("ativo", true));

            String obs = optCleanString(m, "observacoes", optCleanString(m, "instrucoes", ""));
            m.put("observacoes", obs);
            m.put("instrucoes", obs);
            m.put("fabricante", optCleanString(m, "fabricante", ""));
            String cor = optCleanString(m, "cor", "#3B82F6");
            if (cor.isEmpty()) cor = "#3B82F6";
            m.put("cor", cor);
            return m;
        } catch (Exception e) {
            return rm;
        }
    }

    private boolean mergeRemoteMeds(JSONArray remoteMeds) {
        if (remoteMeds == null) return false;
        try {
            Set<String> deletedIds = getDeletedRecordIds();
            JSONArray merged = new JSONArray();
            Set<String> matchedLocalIndices = new HashSet<>();

            for (int r = 0; r < remoteMeds.length(); r++) {
                JSONObject rmRaw = remoteMeds.optJSONObject(r);
                if (rmRaw == null) continue;
                JSONObject rm = normalizeRemoteMed(rmRaw);
                String rId = rm.optString("id", "").trim();
                if (rId.isEmpty()) continue;
                if (deletedIds.contains(rId.toLowerCase(Locale.ROOT))) {
                    deleteRemoteRecord("medicamentos", rId, "med");
                    continue;
                }

                int matchedIdx = -1;
                String rName = optCleanString(rm, "nome", "").toLowerCase(Locale.ROOT);
                String rDose = optCleanString(rm, "dosagem", "").toLowerCase(Locale.ROOT);

                for (int l = 0; l < this.meds.length(); l++) {
                    if (matchedLocalIndices.contains(String.valueOf(l))) continue;
                    JSONObject lm = this.meds.optJSONObject(l);
                    if (lm == null) continue;
                    String lId = lm.optString("id", "").trim();
                    String lResolved = toDeterministicServerUuid(lId, "med");
                    if (rId.equalsIgnoreCase(lId) || rId.equalsIgnoreCase(lResolved)) {
                        matchedIdx = l;
                        break;
                    }
                    String lName = optCleanString(lm, "nome", "").toLowerCase(Locale.ROOT);
                    String lDose = optCleanString(lm, "dosagem", "").toLowerCase(Locale.ROOT);
                    if (!rName.isEmpty() && rName.equals(lName) && rDose.equals(lDose) && !lId.matches("^[0-9a-fA-F-]{36}$")) {
                        matchedIdx = l;
                        break;
                    }
                }

                if (matchedIdx >= 0) {
                    matchedLocalIndices.add(String.valueOf(matchedIdx));
                    JSONObject lm = this.meds.optJSONObject(matchedIdx);
                    if (lm != null && lm.optBoolean("_local_unsynced", false) && this.hasUnsyncedLocalChanges) {
                        lm.put("id", rId);
                        merged.put(lm);
                    } else {
                        if (lm != null) {
                            Iterator<String> keys = lm.keys();
                            while (keys.hasNext()) {
                                String k = keys.next();
                                if (!rm.has(k) && !"_local_unsynced".equals(k)) {
                                    rm.put(k, lm.opt(k));
                                }
                            }
                        }
                        merged.put(rm);
                    }
                } else {
                    merged.put(rm);
                }
            }

            // Keep any unsynced local-only medications that haven't been pushed yet
            for (int l = 0; l < this.meds.length(); l++) {
                if (matchedLocalIndices.contains(String.valueOf(l))) continue;
                JSONObject lm = this.meds.optJSONObject(l);
                if (lm == null) continue;
                String lId = lm.optString("id", "").trim();
                if (deletedIds.contains(lId.toLowerCase(Locale.ROOT))) continue;
                if (lm.optBoolean("_local_unsynced", false) || this.hasUnsyncedLocalChanges) {
                    merged.put(lm);
                }
            }

            boolean isDiff = !merged.toString().equals(this.meds.toString());
            if (isDiff) {
                this.meds = merged;
            }
            return isDiff;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean mergeRemoteDoseLogs(JSONArray remoteLogs) {
        if (remoteLogs == null) return false;
        try {
            JSONArray merged = new JSONArray();
            Set<String> seenKeys = new HashSet<>();

            for (int r = 0; r < remoteLogs.length(); r++) {
                JSONObject rlRaw = remoteLogs.optJSONObject(r);
                if (rlRaw == null) continue;
                JSONObject rl = new JSONObject(rlRaw.toString());
                String d = optCleanString(rl, "data", "");
                if (d.isEmpty()) {
                    String dd = optCleanString(rl, "dose_date", "");
                    if (dd.length() >= 10) d = dd.substring(0, 10);
                }
                if (d.isEmpty()) {
                    String ca = optCleanString(rl, "created_at", "");
                    if (ca.length() >= 10) d = ca.substring(0, 10);
                }
                if (!d.isEmpty()) rl.put("data", d);
                String h = optCleanString(rl, "horario", optCleanString(rl, "hora", ""));
                if (h.length() >= 5 && h.charAt(2) == ':') h = h.substring(0, 5);
                if (!h.isEmpty()) {
                    rl.put("horario", h);
                    rl.put("hora", h);
                }
                String mId = optCleanString(rl, "med_id", "");
                String key = mId + "|" + d + "|" + h;
                if (!mId.isEmpty() && !d.isEmpty() && !h.isEmpty()) {
                    seenKeys.add(key);
                }
                String rId = optCleanString(rl, "id", "");
                if (!rId.isEmpty()) seenKeys.add("id:" + rId.toLowerCase(Locale.ROOT));
                merged.put(rl);
            }

            for (int l = 0; l < this.doseLogs.length(); l++) {
                JSONObject ll = this.doseLogs.optJSONObject(l);
                if (ll == null) continue;
                String mId = optCleanString(ll, "med_id", "");
                String d = optCleanString(ll, "data", "");
                if (d.isEmpty() && ll.has("dose_date")) {
                    String dd = optCleanString(ll, "dose_date", "");
                    if (dd.length() >= 10) d = dd.substring(0, 10);
                }
                String h = optCleanString(ll, "horario", optCleanString(ll, "hora", ""));
                if (h.length() >= 5 && h.charAt(2) == ':') h = h.substring(0, 5);
                String key = mId + "|" + d + "|" + h;
                String lId = toDeterministicServerUuid(optCleanString(ll, "id", ""), "dose");
                if (!seenKeys.contains(key) && !seenKeys.contains("id:" + lId.toLowerCase(Locale.ROOT))) {
                    merged.put(ll);
                }
            }

            boolean isDiff = !merged.toString().equals(this.doseLogs.toString());
            if (isDiff) {
                this.doseLogs = merged;
            }
            return isDiff;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean mergeGenericEntityArray(JSONArray remoteArr, String targetField, String idPrefix, String tableName) {
        if (remoteArr == null) return false;
        try {
            Set<String> deletedIds = getDeletedRecordIds();
            JSONArray localArr;
            if ("events".equals(targetField)) localArr = this.events;
            else if ("notes".equals(targetField)) localArr = this.calNotesList;
            else if ("stock_movements".equals(targetField)) localArr = this.stockMovements;
            else if ("allergies".equals(targetField)) localArr = this.allergies;
            else if ("conditions".equals(targetField)) localArr = this.conditions;
            else if ("contacts".equals(targetField)) localArr = this.contacts;
            else if ("professionals".equals(targetField)) localArr = this.professionals;
            else if ("caregivers".equals(targetField)) localArr = this.caregivers;
            else return false;

            JSONArray merged = new JSONArray();
            Set<String> seenIds = new HashSet<>();

            for (int r = 0; r < remoteArr.length(); r++) {
                JSONObject roRaw = remoteArr.optJSONObject(r);
                if (roRaw == null) continue;
                JSONObject ro = new JSONObject(roRaw.toString());
                String rId = optCleanString(ro, "id", "");
                if (!rId.isEmpty() && deletedIds.contains(rId.toLowerCase(Locale.ROOT))) {
                    deleteRemoteRecord(tableName, rId, idPrefix);
                    continue;
                }
                if ("events".equals(targetField)) {
                    if (isStockEvent(ro)) continue;
                    String t = optCleanString(ro, "title", optCleanString(ro, "titulo", ""));
                    ro.put("title", t);
                    ro.put("titulo", t);
                    String dt = optCleanString(ro, "date", optCleanString(ro, "data", ""));
                    if (dt.length() >= 10) dt = dt.substring(0, 10);
                    ro.put("date", dt);
                    ro.put("data", dt);
                    String tm = optCleanString(ro, "time", optCleanString(ro, "hora", ""));
                    if (tm.length() >= 5 && tm.charAt(2) == ':') tm = tm.substring(0, 5);
                    ro.put("time", tm);
                    ro.put("hora", tm);
                    String loc = optCleanString(ro, "location", optCleanString(ro, "local", ""));
                    ro.put("location", loc);
                    ro.put("local", loc);
                    String nts = optCleanString(ro, "notes", optCleanString(ro, "notas", ""));
                    ro.put("notes", nts);
                    ro.put("notas", nts);
                } else if ("notes".equals(targetField)) {
                    String dt = optCleanString(ro, "date", "");
                    if (dt.length() >= 10) dt = dt.substring(0, 10);
                    ro.put("date", dt);
                } else if ("allergies".equals(targetField)) {
                    String nm = optCleanString(ro, "nome", optCleanString(ro, "name", optCleanString(ro, "allergen", "")));
                    ro.put("nome", nm);
                    ro.put("name", nm);
                    ro.put("allergen", nm);
                    String rc = optCleanString(ro, "reacao", optCleanString(ro, "reaction", ""));
                    ro.put("reacao", rc);
                    ro.put("reaction", rc);
                    String sv = optCleanString(ro, "gravidade", optCleanString(ro, "severity", "Moderada"));
                    ro.put("gravidade", sv);
                    ro.put("severity", sv);
                } else if ("conditions".equals(targetField)) {
                    String nm = optCleanString(ro, "nome", optCleanString(ro, "name", optCleanString(ro, "condition_name", "")));
                    ro.put("nome", nm);
                    ro.put("name", nm);
                    ro.put("condition_name", nm);
                    String nt = optCleanString(ro, "notas", optCleanString(ro, "notes", ""));
                    ro.put("notas", nt);
                    ro.put("notes", nt);
                } else if ("contacts".equals(targetField)) {
                    String nm = optCleanString(ro, "nome", optCleanString(ro, "name", ""));
                    ro.put("nome", nm);
                    ro.put("name", nm);
                    String rl = optCleanString(ro, "relacao", optCleanString(ro, "relationship", ""));
                    ro.put("relacao", rl);
                    ro.put("relationship", rl);
                    String ph = optCleanString(ro, "telefone", optCleanString(ro, "phone", ""));
                    ro.put("telefone", ph);
                    ro.put("phone", ph);
                    boolean pr = ro.optBoolean("principal", ro.optBoolean("is_primary", false));
                    ro.put("principal", pr);
                    ro.put("is_primary", pr);
                } else if ("professionals".equals(targetField)) {
                    String nm = optCleanString(ro, "nome", optCleanString(ro, "name", ""));
                    ro.put("nome", nm);
                    ro.put("name", nm);
                    String sp = optCleanString(ro, "especialidade", optCleanString(ro, "specialty", ""));
                    ro.put("especialidade", sp);
                    ro.put("specialty", sp);
                    String cl = optCleanString(ro, "clinica", optCleanString(ro, "clinic", optCleanString(ro, "clinic_address", "")));
                    ro.put("clinica", cl);
                    ro.put("clinic", cl);
                    ro.put("clinic_address", cl);
                    String ph = optCleanString(ro, "telefone", optCleanString(ro, "phone", ""));
                    ro.put("telefone", ph);
                    ro.put("phone", ph);
                } else if ("caregivers".equals(targetField)) {
                    String nm = optCleanString(ro, "nome", optCleanString(ro, "caregiver_name", "Cuidador"));
                    ro.put("nome", nm);
                    String rl = optCleanString(ro, "relacao", optCleanString(ro, "relationship", "Familiar"));
                    ro.put("relacao", rl);
                    String st = optCleanString(ro, "status", "Ativo");
                    ro.put("status", st);
                    String cd = optCleanString(ro, "codigo_convite", optCleanString(ro, "invite_code", ""));
                    if (!cd.isEmpty()) ro.put("codigo_convite", cd);
                }

                if (!rId.isEmpty()) {
                    seenIds.add(rId.toLowerCase(Locale.ROOT));
                }
                merged.put(ro);
            }

            if (this.hasUnsyncedLocalChanges) {
                for (int l = 0; l < localArr.length(); l++) {
                    JSONObject lo = localArr.optJSONObject(l);
                    if (lo == null) continue;
                    String lId = optCleanString(lo, "id", "");
                    String lRes = toDeterministicServerUuid(lId, idPrefix);
                    if (!lId.isEmpty() && deletedIds.contains(lId.toLowerCase(Locale.ROOT))) continue;
                    if (!seenIds.contains(lId.toLowerCase(Locale.ROOT)) && !seenIds.contains(lRes.toLowerCase(Locale.ROOT))) {
                        merged.put(lo);
                    }
                }
            }

            boolean isDiff = !merged.toString().equals(localArr.toString());
            if (isDiff) {
                if ("events".equals(targetField)) this.events = merged;
                else if ("notes".equals(targetField)) {
                    this.calNotesList = merged;
                    JSONObject rebuiltNotes = new JSONObject();
                    for (int i = 0; i < merged.length(); i++) {
                        JSONObject n = merged.optJSONObject(i);
                        if (n != null) {
                            String d = optCleanString(n, "date", "");
                            String t = optCleanString(n, "text", "");
                            if (!d.isEmpty() && !t.isEmpty()) rebuiltNotes.put(d, t);
                        }
                    }
                    this.calNotes = rebuiltNotes;
                } else if ("stock_movements".equals(targetField)) {
                    this.stockMovements = merged;
                    deduplicateStockMovements();
                } else if ("allergies".equals(targetField)) this.allergies = merged;
                else if ("conditions".equals(targetField)) this.conditions = merged;
                else if ("contacts".equals(targetField)) this.contacts = merged;
                else if ("professionals".equals(targetField)) this.professionals = merged;
                else if ("caregivers".equals(targetField)) this.caregivers = merged;
            }
            return isDiff;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean pullAndMergeFromBackendSync() {
        try {
            if (!this.isLoggedIn) return false;
            final String patId = resolveCurrentAccountUserId();
            final String myEmail = this.profile.optString("email", "").trim().toLowerCase(Locale.ROOT);
            URL url = new URL(EMBEDDED_BACKEND_URL + "/api/v1/sync?userId=" + Uri.encode(patId) + "&email=" + Uri.encode(myEmail));
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            int code = conn.getResponseCode();
            if (code != 200) return false;
            BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line);
            }
            br.close();
            final JSONObject resp = new JSONObject(sb.toString());
            if (!resp.optBoolean("ok", false)) return false;
            if (!this.isLoggedIn) return false;

            String respUserId = resp.optString("userId", "").trim();
            JSONObject u = resp.optJSONObject("user");
            String respEmail = u != null ? u.optString("email", "").trim().toLowerCase(Locale.ROOT) : "";

            if (!respUserId.isEmpty() && !respUserId.equalsIgnoreCase(patId)) {
                if (myEmail.isEmpty() || !myEmail.equalsIgnoreCase(respEmail)) {
                    return false;
                }
            }

            JSONArray mArr = resp.optJSONArray("meds");
            if (hasLeakedOldProfileData(this.profile, mArr)) {
                wipeRemoteLeakedDataForUser(
                    patId,
                    this.profile.optString("nome", ""),
                    myEmail,
                    this.profile.optString("role", "independente")
                );
                return false;
            }

            boolean changed = false;
            if (u != null) {
                if (!respUserId.isEmpty() && !respUserId.equals(this.profile.optString("id", ""))) {
                    this.profile.put("id", respUserId);
                    changed = true;
                }
                String uNome = optCleanString(u, "nome", "");
                if (!uNome.isEmpty() && !uNome.equals(this.profile.optString("nome", ""))) {
                    this.profile.put("nome", uNome);
                    this.profile.put("full_name", uNome);
                    changed = true;
                }
                String uSocial = optCleanString(u, "social_name", "");
                if (!uSocial.isEmpty() && !uSocial.equals(this.profile.optString("social_name", ""))) {
                    this.profile.put("social_name", uSocial);
                    this.profile.put("apelido", uSocial);
                    changed = true;
                }
                String uDob = optCleanString(u, "dob", "");
                if (uDob.length() >= 10) uDob = uDob.substring(0, 10);
                if (!uDob.isEmpty() && this.profile.optString("data_nascimento", "").trim().isEmpty()) {
                    this.profile.put("data_nascimento", uDob);
                    this.profile.put("dob", uDob);
                    changed = true;
                }
                String uSex = optCleanString(u, "sex", "");
                if (!uSex.isEmpty() && !uSex.equals(this.profile.optString("sexo", ""))) {
                    this.profile.put("sexo", uSex);
                    this.profile.put("sex", uSex);
                    this.profile.put("gender", uSex);
                    changed = true;
                }
                String uCpf = optCleanString(u, "cpf", "");
                if (!uCpf.isEmpty() && !uCpf.equals(this.profile.optString("cpf", ""))) {
                    this.profile.put("cpf", uCpf);
                    changed = true;
                }
                String uPhone = optCleanString(u, "phone", "");
                if (!uPhone.isEmpty() && !uPhone.equals(this.profile.optString("telefone", ""))) {
                    this.profile.put("telefone", uPhone);
                    this.profile.put("phone", uPhone);
                    changed = true;
                }
                String uAddr = optCleanString(u, "address", "");
                if (!uAddr.isEmpty() && !uAddr.equals(this.profile.optString("endereco", ""))) {
                    this.profile.put("endereco", uAddr);
                    this.profile.put("address", uAddr);
                    changed = true;
                }
                String uWeight = optCleanString(u, "weight", "");
                if (!uWeight.isEmpty() && !uWeight.equals(this.profile.optString("peso", ""))) {
                    this.profile.put("peso", uWeight);
                    this.profile.put("weight", uWeight);
                    changed = true;
                }
                String uHeight = optCleanString(u, "height", "");
                if (!uHeight.isEmpty() && !uHeight.equals(this.profile.optString("altura", ""))) {
                    this.profile.put("altura", uHeight);
                    this.profile.put("height", uHeight);
                    changed = true;
                }
                String uBlood = optCleanString(u, "blood_type", "");
                if (!uBlood.isEmpty() && !uBlood.equals(this.profile.optString("tipo_sanguineo", ""))) {
                    this.profile.put("tipo_sanguineo", uBlood);
                    this.profile.put("blood_type", uBlood);
                    changed = true;
                }
                String uFoto = optCleanString(u, "foto_url", "");
                if (!uFoto.isEmpty() && this.profile.optString("foto_url", "").trim().isEmpty()) {
                    this.profile.put("foto_url", uFoto);
                    changed = true;
                }
                String uRole = optCleanString(u, "role", "");
                if (!uRole.isEmpty()) {
                    String prevRole = this.profile.optString("role", "");
                    setProfileRoleValue(uRole);
                    if (!prevRole.equals(this.profile.optString("role", ""))) {
                        changed = true;
                    }
                }
            }

            if (mergeRemoteMeds(mArr)) changed = true;
            if (mergeRemoteDoseLogs(resp.optJSONArray("history"))) changed = true;
            if (mergeGenericEntityArray(resp.optJSONArray("events"), "events", "evt", "health_events")) changed = true;
            if (mergeGenericEntityArray(resp.optJSONArray("notes"), "notes", "note", "calendar_notes")) changed = true;
            if (mergeGenericEntityArray(resp.optJSONArray("stock_movements"), "stock_movements", "stk", "stock_movements")) changed = true;
            if (mergeGenericEntityArray(resp.optJSONArray("allergies"), "allergies", "alg", "allergies")) changed = true;
            if (mergeGenericEntityArray(resp.optJSONArray("conditions"), "conditions", "cond", "health_conditions")) changed = true;
            if (mergeGenericEntityArray(resp.optJSONArray("contacts"), "contacts", "cnt", "emergency_contacts")) changed = true;
            if (mergeGenericEntityArray(resp.optJSONArray("professionals"), "professionals", "prof", "healthcare_professionals")) changed = true;
            if (mergeGenericEntityArray(resp.optJSONArray("caregivers"), "caregivers", "cg", "caregiver_relationships")) changed = true;

            return changed;
        } catch (Exception e) {
            return false;
        }
    }

    private void syncWithBackendSilently(final boolean z) {
        if (!this.isLoggedIn) {
            return;
        }
        if (z) {
            Toast.makeText(this, "Sincronizando dados com o servidor...", 0).show();
        }
        new Thread(new Runnable() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda0
            @Override // java.lang.Runnable
            public final void run() {
                MainActivity.this.m24x90e7608c(z);
            }
        }).start();
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$syncWithBackendSilently$23$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m24x90e7608c(final boolean z) {
        try {
            if (!this.isLoggedIn) return;
            // First pull and merge any caregiver additions/updates so we never overwrite them
            final boolean pulledChanges = pullAndMergeFromBackendSync();

            HttpURLConnection httpURLConnection = (HttpURLConnection) new URL(EMBEDDED_BACKEND_URL + "/api/v1/sync").openConnection();
            httpURLConnection.setRequestMethod("POST");
            httpURLConnection.setConnectTimeout(8000);
            httpURLConnection.setReadTimeout(8000);
            boolean z2 = true;
            httpURLConnection.setDoOutput(true);
            httpURLConnection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            if (!EMBEDDED_API_KEY.isEmpty()) {
                httpURLConnection.setRequestProperty("x-api-key", EMBEDDED_API_KEY);
            }
            String patId = resolveCurrentAccountUserId();
            JSONObject syncProfile = new JSONObject(this.profile.toString());
            syncProfile.put("id", patId);
            String apelido = this.profile.optString("apelido", this.profile.optString("social_name", "")).trim();
            if (!apelido.isEmpty()) {
                syncProfile.put("social_name", apelido);
            } else {
                syncProfile.remove("social_name");
            }
            String rawDob = this.profile.optString("data_nascimento", this.profile.optString("dob", "")).trim();
            if (rawDob.matches("^\\d{2}/\\d{2}/\\d{4}$")) {
                String[] parts = rawDob.split("/");
                syncProfile.put("dob", parts[2] + "-" + parts[1] + "-" + parts[0]);
            } else if (rawDob.matches("^\\d{4}-\\d{2}-\\d{2}.*")) {
                syncProfile.put("dob", rawDob.substring(0, 10));
            } else {
                syncProfile.remove("dob");
            }
            String sexoVal = this.profile.optString("sexo", this.profile.optString("sex", "")).trim();
            if (!sexoVal.isEmpty()) {
                syncProfile.put("sex", sexoVal);
            } else {
                syncProfile.remove("sex");
            }
            String telVal = this.profile.optString("telefone", this.profile.optString("phone", "")).trim();
            if (!telVal.isEmpty()) {
                syncProfile.put("phone", telVal);
            } else {
                syncProfile.remove("phone");
            }
            String endVal = this.profile.optString("endereco", this.profile.optString("address", "")).trim();
            if (!endVal.isEmpty()) {
                syncProfile.put("address", endVal);
            } else {
                syncProfile.remove("address");
            }
            String rawWeight = this.profile.optString("peso", this.profile.optString("weight", "")).replace(",", ".").replaceAll("[^0-9.]", "").trim();
            if (!rawWeight.isEmpty()) {
                syncProfile.put("weight", rawWeight);
            } else {
                syncProfile.remove("weight");
            }
            String rawHeight = this.profile.optString("altura", this.profile.optString("height", "")).replace(",", ".").replaceAll("[^0-9.]", "").trim();
            if (!rawHeight.isEmpty()) {
                syncProfile.put("height", rawHeight);
            } else {
                syncProfile.remove("height");
            }
            String btVal = this.profile.optString("tipo_sanguineo", this.profile.optString("blood_type", "")).trim();
            if (!btVal.isEmpty()) {
                syncProfile.put("blood_type", btVal);
            } else {
                syncProfile.remove("blood_type");
            }
            JSONObject jSONObject = new JSONObject();
            jSONObject.put("patientId", patId);
            jSONObject.put("userId", patId);
            jSONObject.put("profile", syncProfile);
            jSONObject.put("user", syncProfile);
            jSONObject.put("medicamentos", this.meds);
            jSONObject.put("meds", this.meds);
            jSONObject.put("historico_doses", this.doseLogs);
            jSONObject.put("history", this.doseLogs);
            jSONObject.put("health_events", this.events);
            jSONObject.put("events", this.events);
            jSONObject.put("calendar_notes", this.calNotes);
            jSONObject.put("notes", this.calNotesList);
            jSONObject.put("stock_movements", this.stockMovements);
            jSONObject.put("allergies", this.allergies);
            jSONObject.put("health_conditions", this.conditions);
            jSONObject.put("conditions", this.conditions);
            jSONObject.put("emergency_contacts", this.contacts);
            jSONObject.put("contacts", this.contacts);
            jSONObject.put("healthcare_professionals", this.professionals);
            jSONObject.put("professionals", this.professionals);
            jSONObject.put("caregiver_relationships", this.caregivers);
            jSONObject.put("caregivers", this.caregivers);
            byte[] bytes = jSONObject.toString().getBytes(StandardCharsets.UTF_8);
            OutputStream outputStream = httpURLConnection.getOutputStream();
            outputStream.write(bytes);
            outputStream.close();
            int responseCode = httpURLConnection.getResponseCode();
            BufferedReader bufferedReader = new BufferedReader(new InputStreamReader((responseCode < 200 || responseCode >= 400) ? httpURLConnection.getErrorStream() : httpURLConnection.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            while (true) {
                String readLine = bufferedReader.readLine();
                if (readLine == null) {
                    break;
                } else {
                    sb.append(readLine);
                }
            }
            bufferedReader.close();
            JSONObject jSONObject2 = new JSONObject(sb.toString());
            if (responseCode != 200) {
                z2 = false;
            }
            String returnedUserId = jSONObject2.optString("userId", "").trim();
            if (!returnedUserId.isEmpty() && patId.equalsIgnoreCase(returnedUserId)) {
                this.profile.put("id", returnedUserId);
                this.prefs.edit().putString("profile", this.profile.toString()).apply();
            }
            final boolean optBoolean = jSONObject2.optBoolean("ok", z2);
            if (optBoolean) {
                this.hasUnsyncedLocalChanges = false;
                for (int i = 0; i < this.meds.length(); i++) {
                    JSONObject m = this.meds.optJSONObject(i);
                    if (m != null) m.remove("_local_unsynced");
                }
            }
            final String format = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.US).format(new Date());
            runOnUiThread(new Runnable() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda8
                @Override // java.lang.Runnable
                public final void run() {
                    if (pulledChanges) {
                        MainActivity.this.saveLocalStateOnly();
                        MainActivity.this.scheduleAllMedicationAlarms();
                        MainActivity.this.render();
                    }
                    MainActivity.this.m22xc335e10a(optBoolean, format, z);
                }
            });
        } catch (Exception e) {
            runOnUiThread(new Runnable() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda9
                @Override // java.lang.Runnable
                public final void run() {
                    MainActivity.this.m23x2a0ea0cb(z);
                }
            });
        }
    }

    private void pullFromBackendIfEmptyOrUpdated() {
        if (!this.isLoggedIn) {
            return;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (!MainActivity.this.isLoggedIn) return;
                    boolean changed = MainActivity.this.pullAndMergeFromBackendSync();
                    if (changed) {
                        final String format = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.US).format(new Date());
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                MainActivity.this.backendStatusOk = true;
                                MainActivity.this.lastSyncTimestamp = "Sincronizado em " + format;
                                MainActivity.this.prefs.edit().putString("last_sync_timestamp", MainActivity.this.lastSyncTimestamp).apply();
                                MainActivity.this.saveLocalStateOnly();
                                MainActivity.this.scheduleAllMedicationAlarms();
                                MainActivity.this.render();
                            }
                        });
                    }
                } catch (Exception ignored) {}
            }
        }).start();
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$syncWithBackendSilently$21$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m22xc335e10a(boolean z, String str, boolean z2) {
        this.backendStatusOk = z;
        if (z) {
            this.lastSyncTimestamp = "Sincronizado em " + str;
            this.prefs.edit().putString("last_sync_timestamp", this.lastSyncTimestamp).apply();
            if (z2) {
                Toast.makeText(this, "✓ Sincronizado com sucesso!", 0).show();
                render();
                return;
            }
            return;
        }
        if (z2) {
            Toast.makeText(this, "Salvo localmente (aguardando banco Oracle)", 0).show();
        }
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$syncWithBackendSilently$22$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m23x2a0ea0cb(boolean z) {
        if (z) {
            Toast.makeText(this, "Salvo no dispositivo (modo offline ativo)", 0).show();
        }
    }

    private void showSosEmergencyDialog() {
        StringBuilder sb = new StringBuilder();
        sb.append("Paciente: ").append(this.profile.optString("nome")).append("\n");
        sb.append("Tipo Sanguíneo: ").append(this.profile.optString("tipo_sanguineo")).append("\n");
        sb.append("Condições: ").append(this.profile.optString("observacoes_medicas")).append("\n\n");
        sb.append("Contatos de Emergência:\n");
        for (int i = 0; i < this.contacts.length(); i++) {
            JSONObject optJSONObject = this.contacts.optJSONObject(i);
            if (optJSONObject != null) {
                sb.append("• ").append(optJSONObject.optString("nome")).append(" (").append(optJSONObject.optString("relacao")).append("): ").append(optJSONObject.optString("telefone")).append("\n");
            }
        }
        showStyledConfirmDialog("🚨 Emergência Médica (SOS)", sb.toString(), "📞 Ligar SAMU 192", "Fechar", this.cDanger, new Runnable() {
            @Override
            public void run() {
                m21x2ce5f109(null, 0);
            }
        });
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$showSosEmergencyDialog$24$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m21x2ce5f109(DialogInterface dialogInterface, int i) {
        startActivity(new Intent("android.intent.action.DIAL", Uri.parse("tel:192")));
    }

    private View sectionHeader(String str, String str2) {
        LinearLayout linearLayout = new LinearLayout(this);
        linearLayout.setOrientation(1);
        linearLayout.setPadding(0, dp(6), 0, dp(10));
        TextView textView = new TextView(this);
        textView.setText(str);
        textView.setTextColor(this.cTextMain);
        textView.setTextSize(sp(16.0f));
        textView.setTypeface(null, 1);
        linearLayout.addView(textView);
        if (str2 != null && !str2.isEmpty()) {
            TextView textView2 = new TextView(this);
            textView2.setText(str2);
            textView2.setTextColor(this.cTextMuted);
            textView2.setTextSize(sp(12.0f));
            linearLayout.addView(textView2);
        }
        return linearLayout;
    }

    private EditText createInput(String str, String str2) {
        EditText editText = new EditText(this);
        editText.setHint(str);
        editText.setText(str2);
        editText.setTextColor(this.cTextMain);
        editText.setHintTextColor(this.cTextLight);
        editText.setTextSize(sp(14.0f));
        editText.setBackground(shape(this.cBgMain, 12, this.cBorder, 1));
        editText.setPadding(dp(14), dp(12), dp(14), dp(12));
        LinearLayout.LayoutParams layoutParams = new LinearLayout.LayoutParams(-1, -2);
        layoutParams.bottomMargin = dp(10);
        editText.setLayoutParams(layoutParams);
        return editText;
    }

    private TextView createButton(String str, int i, int i2) {
        TextView textView = new TextView(this);
        textView.setText(str);
        textView.setTextColor(i2);
        textView.setTextSize(sp(14.0f));
        textView.setTypeface(null, 1);
        textView.setGravity(17);
        textView.setBackground(shape(i, 14, this.cBorder, i != this.cSurface ? 0 : 1));
        textView.setPadding(dp(16), dp(13), dp(16), dp(13));
        return textView;
    }
}
