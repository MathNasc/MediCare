package com.medicare.patient;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
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
import android.widget.Toast;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/* loaded from: classes.dex */
public class MainActivity extends Activity {
    private static final String EMBEDDED_API_KEY = "";
    private static final String EMBEDDED_BACKEND_URL = "http://144.22.160.191:3009";
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
        FrameLayout frameLayout = new FrameLayout(this);
        this.rootContainer = frameLayout;
        setContentView(frameLayout);
        render();
        syncWithBackendSilently(false);
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
    }

    private String todayIso() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private int dp(int i) {
        return (int) TypedValue.applyDimension(1, i * (this.isAccessibilityMode ? 1.15f : 1.0f), getResources().getDisplayMetrics());
    }

    private float sp(float f) {
        return this.isAccessibilityMode ? f * 1.18f : f;
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

    private void loadOrInitData() {
        try {
            this.isLoggedIn = this.prefs.getBoolean("is_logged_in", false);
            this.isDarkMode = this.prefs.getBoolean("dark_mode", true);
            this.isHighContrast = this.prefs.getBoolean("high_contrast", false);
            this.isAccessibilityMode = this.prefs.getBoolean("accessibility_mode", false);
            this.lastSyncTimestamp = this.prefs.getString("last_sync_timestamp", "Sincronização automática ativa");
            String string = this.prefs.getString("profile", null);
            if (string != null) {
                this.profile = new JSONObject(string);
                this.meds = new JSONArray(this.prefs.getString("meds", "[]"));
                this.doseLogs = new JSONArray(this.prefs.getString("dose_logs", "[]"));
                this.events = new JSONArray(this.prefs.getString("events", "[]"));
                this.calNotes = new JSONObject(this.prefs.getString("cal_notes", "{}"));
                this.calNotesList = new JSONArray(this.prefs.getString("cal_notes_list", "[]"));
                this.stockMovements = new JSONArray(this.prefs.getString("stock_movements", "[]"));
                this.allergies = new JSONArray(this.prefs.getString("allergies", "[]"));
                this.conditions = new JSONArray(this.prefs.getString("conditions", "[]"));
                this.contacts = new JSONArray(this.prefs.getString("contacts", "[]"));
                this.professionals = new JSONArray(this.prefs.getString("professionals", "[]"));
                this.caregivers = new JSONArray(this.prefs.getString("caregivers", "[]"));
                this.aiMessages = new JSONArray(this.prefs.getString("ai_messages", "[]"));

                if ("maria.silva@email.com".equalsIgnoreCase(this.profile.optString("email", ""))) {
                    this.isLoggedIn = false;
                    this.profile = new JSONObject();
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
                    this.prefs.edit().putBoolean("is_logged_in", false).putBoolean("onboarding_completed", false).apply();
                    saveAll();
                }
            } else {
                this.profile = new JSONObject();
                this.profile.put("id", "");
                this.profile.put("nome", "");
                this.profile.put("social_name", "");
                this.profile.put("email", "");
                this.profile.put("data_nascimento", "");
                this.profile.put("dob", "");
                this.profile.put("sex", "");
                this.profile.put("telefone", "");
                this.profile.put("cpf", "");
                this.profile.put("tipo_sanguineo", "");
                this.profile.put("peso", "");
                this.profile.put("altura", "");
                this.profile.put("endereco", "");
                this.profile.put("role", "independente");
                this.profile.put("observacoes_medicas", "");
                this.profile.put("alerta_sonoro", true);
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
                saveAll();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void saveAll() {
        this.prefs.edit()
            .putBoolean("is_logged_in", this.isLoggedIn)
            .putBoolean("dark_mode", this.isDarkMode)
            .putBoolean("high_contrast", this.isHighContrast)
            .putBoolean("accessibility_mode", this.isAccessibilityMode)
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
        syncWithBackendSilently(false);
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
            subtitleView.setText("Escolha o seu perfil para personalizarmos a sua experiência.");

            container.addView(buildRoleCard("⚙️ Independente", "Vou gerenciar meus próprios medicamentos e horários.", "independente"));
            container.addView(buildRoleCard("🧑 Paciente", "Alguém cuida de mim, mas quero acompanhar no meu celular.", "paciente"));
            container.addView(buildRoleCard("🤝 Cuidador", "Vou gerenciar a medicação de outra pessoa.", "cuidador"));
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

    private View buildRoleCard(final String title, final String desc, final String role) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 18, this.cBorder, 1));
        card.setPadding(dp(18), dp(18), dp(18), dp(18));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.bottomMargin = dp(14);
        card.setLayoutParams(lp);
        card.setClickable(true);
        card.setFocusable(true);

        TextView tView = new TextView(this);
        tView.setText(title);
        tView.setTextColor(this.cTextMain);
        tView.setTextSize(sp(16.0f));
        tView.setTypeface(null, 1);
        card.addView(tView);

        TextView dView = new TextView(this);
        dView.setText(desc);
        dView.setTextColor(this.cTextMuted);
        dView.setTextSize(sp(13.0f));
        dView.setPadding(0, dp(4), 0, 0);
        card.addView(dView);

        card.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    MainActivity.this.profile.put("role", role);
                    MainActivity.this.saveAll();
                } catch (Exception ignored) {}
                if ("cuidador".equals(role)) {
                    MainActivity.this.prefs.edit().putBoolean("onboarding_completed", true).apply();
                    MainActivity.this.saveAll();
                    MainActivity.this.render();
                } else {
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
        versionBadge.setText("Versão 2.5.0 • Produção");
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
                    reqBody.put("email", email);
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
                        MainActivity.this.profile.put("email", email);
                        JSONObject userObj = respObj.optJSONObject("user");
                        if (userObj != null) {
                            String userId = userObj.optString("id");
                            if (!userId.isEmpty()) {
                                MainActivity.this.profile.put("id", userId);
                            }
                            JSONObject meta = userObj.optJSONObject("user_metadata");
                            if (meta != null && meta.has("nome")) {
                                MainActivity.this.profile.put("nome", meta.optString("nome"));
                            }
                        }
                        MainActivity.this.isLoggedIn = true;
                        MainActivity.this.isRegisterMode = false;
                        MainActivity.this.saveAll();

                        MainActivity.this.runOnUiThread(new Runnable() {
                            @Override
                            public final void run() {
                                Toast.makeText(MainActivity.this, "✓ Bem-vindo de volta!", 0).show();
                                MainActivity.this.render();
                                MainActivity.this.syncWithBackendSilently(true);
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
                            if (email.equalsIgnoreCase(MainActivity.this.profile.optString("email", ""))) {
                                MainActivity.this.isLoggedIn = true;
                                MainActivity.this.isRegisterMode = false;
                                MainActivity.this.saveAll();
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
                    reqBody.put("email", email);
                    reqBody.put("password", password);

                    JSONObject metaData = new JSONObject();
                    metaData.put("nome", nome);
                    metaData.put("role", "paciente");
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
                        MainActivity.this.profile.put("email", email);
                        MainActivity.this.profile.put("nome", nome);
                        JSONObject userObj = respObj.optJSONObject("user");
                        if (userObj != null) {
                            String userId = userObj.optString("id");
                            if (!userId.isEmpty()) {
                                MainActivity.this.profile.put("id", userId);
                            }
                        }
                        MainActivity.this.isLoggedIn = true;
                        MainActivity.this.isRegisterMode = false;
                        MainActivity.this.saveAll();

                        MainActivity.this.runOnUiThread(new Runnable() {
                            @Override
                            public final void run() {
                                Toast.makeText(MainActivity.this, "✓ Conta criada com sucesso! Bem-vindo(a), " + nome, 1).show();
                                MainActivity.this.render();
                                MainActivity.this.syncWithBackendSilently(true);
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
                                MainActivity.this.profile.put("email", email);
                                MainActivity.this.profile.put("nome", nome);
                                MainActivity.this.profile.put("id", "pac-" + System.currentTimeMillis());
                            } catch (Exception ignored) {}
                            MainActivity.this.isLoggedIn = true;
                            MainActivity.this.isRegisterMode = false;
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
                setMedStock(med, currentStock - 1);
                this.stockMovements.put(new JSONObject()
                    .put("id", "sm-" + System.currentTimeMillis())
                    .put("med_id", medId)
                    .put("med_nome", med.optString("nome"))
                    .put("tipo", "saida")
                    .put("movement_type", "consumption")
                    .put("qtd", 1)
                    .put("quantity_change", -1)
                    .put("previous_quantity", currentStock)
                    .put("new_quantity", Math.max(0, currentStock - 1))
                    .put("data", dateStr + " " + nowTime)
                    .put("created_at", dateStr + "T" + nowTime + ":00.000Z")
                    .put("motivo", "Dose tomada (" + horaStr + ")"));
            } else if (!"tomado".equals(newStatus) && "tomado".equals(prevStatus)) {
                setMedStock(med, currentStock + 1);
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
                AlertDialog.Builder b = new AlertDialog.Builder(this);
                LinearLayout box = new LinearLayout(this);
                box.setOrientation(1);
                box.setPadding(dp(22), dp(22), dp(22), dp(18));
                box.setBackgroundColor(this.cSurface);
                TextView title = new TextView(this);
                title.setText(diffMin > 0 ? "⏰ Confirmar adiantado?" : "⚠️ Confirmar com atraso?");
                title.setTextColor(this.cTextMain);
                title.setTextSize(sp(18.0f));
                title.setTypeface(null, 1);
                box.addView(title);
                TextView desc = new TextView(this);
                int hrs = Math.abs(diffMin) / 60;
                int mins = Math.abs(diffMin) % 60;
                String timeStr = (hrs > 0 ? hrs + "h " : "") + mins + "min";
                desc.setText("Esta dose de " + med.optString("nome") + " (" + horaStr + ") está " + timeStr + (diffMin > 0 ? " adiantada" : " atrasada") + " em relação ao horário programado. Deseja confirmar mesmo assim?");
                desc.setTextColor(this.cTextMuted);
                desc.setTextSize(sp(14.0f));
                desc.setPadding(0, dp(10), 0, dp(6));
                box.addView(desc);
                b.setView(box);
                b.setPositiveButton("Sim, confirmar", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int w) {
                        registerDose(med, dateStr, horaStr, "tomado");
                    }
                });
                b.setNegativeButton("Cancelar", null);
                b.show();
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
        AlertDialog.Builder b = new AlertDialog.Builder(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(1);
        box.setPadding(dp(22), dp(22), dp(22), dp(16));
        box.setBackgroundColor(this.cSurface);
        TextView t = new TextView(this);
        t.setText("↩ Desfazer confirmação?");
        t.setTextColor(this.cTextMain);
        t.setTextSize(sp(18.0f));
        t.setTypeface(null, 1);
        box.addView(t);
        TextView sub = new TextView(this);
        sub.setText("A dose de " + med.optString("nome") + " às " + horaStr + " voltará a ficar pendente e 1 unidade será devolvida ao estoque.");
        sub.setTextColor(this.cTextMuted);
        sub.setTextSize(sp(14.0f));
        sub.setPadding(0, dp(10), 0, dp(6));
        box.addView(sub);
        b.setView(box);
        b.setPositiveButton("Desfazer", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                registerDose(med, dateStr, horaStr, "pendente");
            }
        });
        b.setNegativeButton("Cancelar", null);
        b.show();
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
            titleCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

            LinearLayout nameBadgeRow = new LinearLayout(this);
            nameBadgeRow.setOrientation(0);
            nameBadgeRow.setGravity(16);
            TextView mName = new TextView(this);
            mName.setText(med.optString("nome"));
            mName.setTextColor(this.cTextMain);
            mName.setTextSize(sp(16.0f));
            mName.setTypeface(null, 1);
            mName.setPadding(0, 0, dp(6), 0);
            nameBadgeRow.addView(mName);

            TextView tBadge = new TextView(this);
            tBadge.setText(isSOS ? "🆘 SOS" : (isTemp ? "📅 Temporário" : "🔄 Contínuo"));
            int tbColor = isSOS ? this.cInfo : (isTemp ? this.cWarning : this.cSuccess);
            tBadge.setTextColor(tbColor);
            tBadge.setTextSize(sp(10.0f));
            tBadge.setTypeface(null, 1);
            tBadge.setBackground(shape(Color.argb(35, Color.red(tbColor), Color.green(tbColor), Color.blue(tbColor)), 10, 0, 0));
            tBadge.setPadding(dp(8), dp(2), dp(8), dp(2));
            nameBadgeRow.addView(tBadge);
            titleCol.addView(nameBadgeRow);

            String unitStr = med.optString("unidade", med.optString("forma", "comprimido"));
            TextView doseSub = new TextView(this);
            doseSub.setText(med.optString("dosagem") + " · " + unitStr);
            doseSub.setTextColor(this.cTextMuted);
            doseSub.setTextSize(sp(13.0f));
            doseSub.setPadding(0, dp(2), 0, 0);
            titleCol.addView(doseSub);
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

            String obs = med.optString("observacoes", med.optString("instrucoes", ""));
            if (isSOS || !obs.isEmpty()) {
                TextView obsTv = new TextView(this);
                obsTv.setText(isSOS && obs.isEmpty() ? "Uso conforme necessidade" : obs);
                obsTv.setTextColor(this.cTextLight);
                obsTv.setTextSize(sp(12.0f));
                obsTv.setPadding(0, dp(6), 0, 0);
                col.addView(obsTv);
            }

            if (isTemp) {
                int durDays = med.optInt("duration_days", 7);
                TextView tempInfo = new TextView(this);
                tempInfo.setText("📅 Tratamento por " + durDays + " dias · Início: " + med.optString("start_date", today));
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
            stockPill.setText("📦 " + qty + " " + unitStr + "s");
            stockPill.setTextColor(stColor);
            stockPill.setTextSize(sp(12.0f));
            stockPill.setTypeface(null, 1);
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
        AlertDialog.Builder b = new AlertDialog.Builder(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(1);
        box.setPadding(dp(22), dp(22), dp(22), dp(16));
        box.setBackgroundColor(this.cSurface);
        TextView t = new TextView(this);
        t.setText("🗑 Excluir medicamento?");
        t.setTextColor(this.cTextMain);
        t.setTextSize(sp(18.0f));
        t.setTypeface(null, 1);
        box.addView(t);
        TextView sub = new TextView(this);
        sub.setText("Tem certeza que deseja excluir " + med.optString("nome") + "? O histórico de doses anteriores será mantido.");
        sub.setTextColor(this.cTextMuted);
        sub.setTextSize(sp(14.0f));
        sub.setPadding(0, dp(10), 0, dp(6));
        box.addView(sub);
        b.setView(box);
        b.setPositiveButton("Excluir", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                MainActivity.this.meds.remove(index);
                saveAll();
                render();
                Toast.makeText(MainActivity.this, "🗑 " + med.optString("nome") + " excluído", 0).show();
            }
        });
        b.setNegativeButton("Cancelar", null);
        b.show();
    }

    private void showSosQuickLogModal(final JSONObject med) {
        AlertDialog.Builder b = new AlertDialog.Builder(this);
        ScrollView sv = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(1);
        box.setPadding(dp(20), dp(20), dp(20), dp(16));
        box.setBackgroundColor(this.cSurface);

        TextView title = new TextView(this);
        title.setText("🆘 Registrar Uso SOS — " + med.optString("nome"));
        title.setTextColor(this.cTextMain);
        title.setTextSize(sp(17.0f));
        title.setTypeface(null, 1);
        title.setPadding(0, 0, 0, dp(10));
        box.addView(title);

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
        b.setView(sv);
        b.setPositiveButton("Confirmar Uso SOS", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
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
                    setMedStock(med, curSt - qUsed);
                    MainActivity.this.stockMovements.put(new JSONObject()
                        .put("id", "sm-" + System.currentTimeMillis())
                        .put("med_id", med.optString("id"))
                        .put("med_nome", med.optString("nome"))
                        .put("tipo", "saida")
                        .put("movement_type", "consumption")
                        .put("qtd", qUsed)
                        .put("quantity_change", -qUsed)
                        .put("previous_quantity", curSt)
                        .put("new_quantity", Math.max(0, curSt - qUsed))
                        .put("data", today + " " + h)
                        .put("created_at", today + "T" + h + ":00.000Z")
                        .put("motivo", mot.isEmpty() ? "Uso SOS" : "Uso SOS: " + mot));
                    saveAll();
                    render();
                    Toast.makeText(MainActivity.this, "✓ Uso SOS de " + med.optString("nome") + " registrado!", 0).show();
                } catch (Exception ignored) {}
            }
        });
        b.setNegativeButton("Cancelar", null);
        b.show();
    }

    private void showMedDetailModal(final JSONObject med) {
        AlertDialog.Builder b = new AlertDialog.Builder(this);
        ScrollView sv = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(1);
        box.setPadding(dp(20), dp(20), dp(20), dp(16));
        box.setBackgroundColor(this.cSurface);

        TextView title = new TextView(this);
        title.setText("💊 " + med.optString("nome") + " · " + med.optString("dosagem"));
        title.setTextColor(this.cTextMain);
        title.setTextSize(sp(19.0f));
        title.setTypeface(null, 1);
        box.addView(title);

        String pa = med.optString("principio_ativo", "");
        if (!pa.isEmpty()) {
            TextView paTv = new TextView(this);
            paTv.setText("Princípio ativo: " + pa);
            paTv.setTextColor(this.cTextMuted);
            paTv.setTextSize(sp(13.0f));
            paTv.setPadding(0, dp(4), 0, 0);
            box.addView(paTv);
        }

        int stock = getMedStock(med);
        String unit = med.optString("unidade", med.optString("forma", "comprimido"));
        TextView stTv = new TextView(this);
        stTv.setText("📦 Estoque disponível: " + stock + " " + unit + "s");
        stTv.setTextColor(stock <= 5 ? this.cDanger : (stock <= 10 ? this.cWarning : this.cSuccess));
        stTv.setTextSize(sp(14.0f));
        stTv.setTypeface(null, 1);
        stTv.setPadding(0, dp(12), 0, dp(8));
        box.addView(stTv);

        JSONArray hrs = med.optJSONArray("horarios");
        if (hrs != null && hrs.length() > 0 && !"sos".equals(getMedType(med))) {
            TextView hTv = new TextView(this);
            hTv.setText("⏰ Horários: " + joinArray(hrs));
            hTv.setTextColor(this.cTextMain);
            hTv.setTextSize(sp(13.0f));
            hTv.setPadding(0, 0, 0, dp(8));
            box.addView(hTv);
        }

        String obs = med.optString("observacoes", med.optString("instrucoes", ""));
        if (!obs.isEmpty()) {
            TextView oTv = new TextView(this);
            oTv.setText("📝 Observações: " + obs);
            oTv.setTextColor(this.cTextMuted);
            oTv.setTextSize(sp(13.0f));
            oTv.setPadding(0, 0, 0, dp(10));
            box.addView(oTv);
        }

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
        b.setView(sv);
        b.setPositiveButton("Fechar", null);
        b.show();
    }

    private void showStockMovementModal(final JSONObject med, final int prevQty, final int newQty) {
        final int diff = newQty - prevQty;
        AlertDialog.Builder b = new AlertDialog.Builder(this);
        ScrollView sv = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(1);
        box.setPadding(dp(20), dp(20), dp(20), dp(16));
        box.setBackgroundColor(this.cSurface);

        TextView title = new TextView(this);
        title.setText("📦 Movimentação de Estoque");
        title.setTextColor(this.cTextMain);
        title.setTextSize(sp(18.0f));
        title.setTypeface(null, 1);
        box.addView(title);

        TextView sub = new TextView(this);
        sub.setText(med.optString("nome") + ": " + prevQty + " → " + newQty + " (" + (diff > 0 ? "+" + diff : String.valueOf(diff)) + " unidades)");
        sub.setTextColor(diff > 0 ? this.cSuccess : this.cWarning);
        sub.setTextSize(sp(14.0f));
        sub.setTypeface(null, 1);
        sub.setPadding(0, dp(6), 0, dp(12));
        box.addView(sub);

        final EditText typeInput = createInput("Tipo (compra, ajuste, correcao)", diff > 0 ? "compra" : "ajuste");
        box.addView(typeInput);
        final EditText pharmInput = createInput("Farmácia / Local (opcional)", "");
        box.addView(pharmInput);
        final EditText priceInput = createInput("Valor pago R$ (opcional)", "");
        box.addView(priceInput);
        final EditText reasonInput = createInput("Observação / Motivo (ex: Compra mensal, Perda)", diff > 0 ? "Reposição de estoque" : "Ajuste manual");
        box.addView(reasonInput);

        sv.addView(box);
        b.setView(sv);
        b.setPositiveButton("Registrar", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                try {
                    String today = todayIso();
                    String hm = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());
                    String mType = typeInput.getText().toString().trim().toLowerCase(Locale.ROOT);
                    String movType = mType.contains("compra") ? "purchase" : (mType.contains("corr") ? "correction" : "adjustment");
                    String motivo = reasonInput.getText().toString().trim();
                    JSONObject sm = new JSONObject();
                    sm.put("id", "sm-" + System.currentTimeMillis());
                    sm.put("med_id", med.optString("id"));
                    sm.put("med_nome", med.optString("nome"));
                    sm.put("tipo", diff >= 0 ? "entrada" : "saida");
                    sm.put("movement_type", movType);
                    sm.put("qtd", Math.abs(diff));
                    sm.put("quantity_change", diff);
                    sm.put("previous_quantity", prevQty);
                    sm.put("new_quantity", newQty);
                    sm.put("pharmacy", pharmInput.getText().toString().trim());
                    sm.put("price_paid", priceInput.getText().toString().trim());
                    sm.put("data", today + " " + hm);
                    sm.put("created_at", today + "T" + hm + ":00.000Z");
                    sm.put("motivo", motivo.isEmpty() ? "Atualização de estoque" : motivo);
                    MainActivity.this.stockMovements.put(sm);

                    if (diff > 0) {
                        JSONObject stEv = new JSONObject();
                        stEv.put("id", "ev-st-" + System.currentTimeMillis());
                        stEv.put("type", "estoque");
                        stEv.put("tipo", "estoque");
                        stEv.put("date", today);
                        stEv.put("data", today);
                        stEv.put("time", hm);
                        stEv.put("hora", hm);
                        stEv.put("title", "Reposição: " + med.optString("nome") + " (+" + diff + ")");
                        stEv.put("titulo", "Reposição: " + med.optString("nome") + " (+" + diff + ")");
                        stEv.put("description", motivo);
                        stEv.put("notas", motivo);
                        MainActivity.this.events.put(stEv);
                    }
                    saveAll();
                    render();
                } catch (Exception ignored) {}
            }
        });
        b.setNegativeButton("Pular detalhe", null);
        b.show();
    }

    private void showMedModal(final JSONObject jSONObject, final int i) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        ScrollView scrollView = new ScrollView(this);
        LinearLayout linearLayout = new LinearLayout(this);
        linearLayout.setOrientation(1);
        linearLayout.setPadding(dp(20), dp(20), dp(20), dp(20));
        linearLayout.setBackgroundColor(this.cSurface);

        TextView textView = new TextView(this);
        textView.setText(jSONObject == null ? "Novo Medicamento" : "Editar Medicamento");
        textView.setTextColor(this.cTextMain);
        textView.setTextSize(sp(18.0f));
        textView.setTypeface(null, 1);
        textView.setPadding(0, 0, 0, dp(12));
        linearLayout.addView(textView);

        final int prevStock = jSONObject != null ? getMedStock(jSONObject) : -1;
        String initType = jSONObject != null ? getMedType(jSONObject) : ("temporary".equals(this.medFilter) ? "temporary" : ("sos".equals(this.medFilter) ? "sos" : "continuous"));

        final EditText nameIn = createInput("Nome do Medicamento *", jSONObject != null ? jSONObject.optString("nome") : "");
        final EditText activeIn = createInput("Princípio Ativo (opcional)", jSONObject != null ? jSONObject.optString("principio_ativo") : "");
        final EditText doseIn = createInput("Dosagem * (ex: 50mg, 500mg)", jSONObject != null ? jSONObject.optString("dosagem") : "");
        final EditText unitIn = createInput("Unidade (comprimido, cápsula, ml, gota)", jSONObject != null ? jSONObject.optString("unidade", jSONObject.optString("forma", "comprimido")) : "comprimido");
        final EditText typeIn = createInput("Tipo de tratamento (continuous, temporary, sos)", initType);
        final EditText durIn = createInput("Duração em dias (para Temporário, ex: 7)", jSONObject != null ? String.valueOf(jSONObject.optInt("duration_days", 7)) : "7");
        durIn.setInputType(2);
        final EditText schedIn = createInput("Horários separados por vírgula (ex: 08:00,20:00)", (jSONObject == null || jSONObject.optJSONArray("horarios") == null) ? "08:00" : joinArray(jSONObject.optJSONArray("horarios")));
        final EditText stockIn = createInput("Quantidade em Estoque *", String.valueOf(jSONObject != null ? getMedStock(jSONObject) : 30));
        stockIn.setInputType(2);
        final EditText manufIn = createInput("Fabricante / Laboratório (opcional)", jSONObject != null ? jSONObject.optString("fabricante") : "");
        final EditText obsIn = createInput("Observações (ex: Tomar após o café)", jSONObject != null ? jSONObject.optString("observacoes", jSONObject.optString("instrucoes", "")) : "");
        final EditText colorIn = createInput("Cor (#3B82F6, #22C55E, #F59E0B, #EF4444, #A855F7)", jSONObject != null ? jSONObject.optString("cor", "#3B82F6") : "#3B82F6");

        final CheckBox emergCheck = new CheckBox(this);
        emergCheck.setText(" Destacar no Cartão de Emergência");
        emergCheck.setTextColor(this.cTextMain);
        emergCheck.setChecked(jSONObject == null || jSONObject.optBoolean("important_for_emergency", true));

        linearLayout.addView(nameIn);
        linearLayout.addView(activeIn);
        linearLayout.addView(doseIn);
        linearLayout.addView(unitIn);
        linearLayout.addView(typeIn);
        linearLayout.addView(durIn);
        linearLayout.addView(schedIn);
        linearLayout.addView(stockIn);
        linearLayout.addView(manufIn);
        linearLayout.addView(obsIn);
        linearLayout.addView(colorIn);
        linearLayout.addView(emergCheck);

        scrollView.addView(linearLayout);
        builder.setView(scrollView);
        builder.setPositiveButton("Salvar", new DialogInterface.OnClickListener() {
            @Override
            public final void onClick(DialogInterface dialogInterface, int i2) {
                try {
                    String nomeVal = nameIn.getText().toString().trim();
                    if (nomeVal.isEmpty()) {
                        Toast.makeText(MainActivity.this, "Informe o nome do medicamento", 0).show();
                        return;
                    }
                    JSONObject mObj = jSONObject != null ? jSONObject : new JSONObject();
                    if (jSONObject == null) {
                        mObj.put("id", "med-" + System.currentTimeMillis());
                    }
                    mObj.put("ativo", true);
                    mObj.put("nome", nomeVal);
                    mObj.put("principio_ativo", activeIn.getText().toString().trim());
                    mObj.put("dosagem", doseIn.getText().toString().trim());
                    String uVal = unitIn.getText().toString().trim();
                    if (uVal.isEmpty()) uVal = "comprimido";
                    mObj.put("unidade", uVal);
                    mObj.put("forma", uVal);

                    String rawT = typeIn.getText().toString().trim().toLowerCase(Locale.ROOT);
                    String normT = rawT.contains("temp") ? "temporary" : (rawT.contains("sos") ? "sos" : "continuous");
                    mObj.put("treatment_type", normT);
                    mObj.put("tipo_uso", "temporary".equals(normT) ? "temporario" : ("sos".equals(normT) ? "sos" : "continuo"));
                    if ("temporary".equals(normT)) {
                        int dDays = Integer.parseInt(durIn.getText().toString().trim().isEmpty() ? "7" : durIn.getText().toString().trim());
                        mObj.put("duration_days", dDays);
                        if (!mObj.has("start_date")) mObj.put("start_date", todayIso());
                    }

                    JSONArray hrsArr = new JSONArray();
                    if (!"sos".equals(normT)) {
                        for (String hPart : schedIn.getText().toString().split(",")) {
                            if (!hPart.trim().isEmpty()) hrsArr.put(hPart.trim());
                        }
                        if (hrsArr.length() == 0) hrsArr.put("08:00");
                    }
                    mObj.put("horarios", hrsArr);
                    mObj.put("frequencia", hrsArr.length() + "x ao dia");

                    int newStock = Integer.parseInt(stockIn.getText().toString().trim().isEmpty() ? "0" : stockIn.getText().toString().trim());
                    setMedStock(mObj, newStock);
                    mObj.put("estoque_minimo", 5);
                    mObj.put("fabricante", manufIn.getText().toString().trim());
                    String obsVal = obsIn.getText().toString().trim();
                    mObj.put("observacoes", obsVal);
                    mObj.put("instrucoes", obsVal);
                    mObj.put("cor", colorIn.getText().toString().trim().isEmpty() ? "#3B82F6" : colorIn.getText().toString().trim());
                    mObj.put("important_for_emergency", emergCheck.isChecked());

                    if (i >= 0) {
                        MainActivity.this.meds.put(i, mObj);
                    } else {
                        MainActivity.this.meds.put(mObj);
                    }
                    MainActivity.this.medFilter = normT;
                    saveAll();
                    render();
                    if (jSONObject != null && prevStock >= 0 && prevStock != newStock) {
                        showStockMovementModal(mObj, prevStock, newStock);
                    }
                } catch (Exception ignored) {}
            }
        });
        builder.setNegativeButton("Cancelar", null);
        builder.show();
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
                    if (ev != null) {
                        String title = ev.optString("title", ev.optString("titulo", ""));
                        String notes = ev.optString("notes", ev.optString("notas", ""));
                        if (title.toLowerCase(Locale.ROOT).contains(q) || notes.toLowerCase(Locale.ROOT).contains(q)) {
                            matchCount++;
                            final String dStr = ev.optString("date", ev.optString("data", todayIso()));
                            resCard.addView(buildSearchResultItem("📅", title, dStr + " · Evento", dStr));
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
            if (ev != null && ev.optString("date", ev.optString("data", "")).startsWith(monthPrefix)) mEventsCount++;
        }
        int mRestockCount = 0;
        for (int i = 0; i < this.stockMovements.length(); i++) {
            JSONObject sm = this.stockMovements.optJSONObject(i);
            if (sm != null && sm.optString("date", sm.optString("data_hora", "")).startsWith(monthPrefix) && sm.optInt("delta", 0) > 0) {
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

    private boolean hasEventOnDate(String dateStr) {
        for (int i = 0; i < this.events.length(); i++) {
            JSONObject ev = this.events.optJSONObject(i);
            if (ev != null && dateStr.equals(ev.optString("date", ev.optString("data")))) return true;
        }
        return false;
    }

    private boolean hasStockMoveOnDate(String dateStr) {
        for (int i = 0; i < this.stockMovements.length(); i++) {
            JSONObject sm = this.stockMovements.optJSONObject(i);
            if (sm != null && sm.optString("date", sm.optString("data_hora", "")).startsWith(dateStr)) return true;
        }
        return false;
    }

    private void showDayPanelDialog(final String dateStr) {
        AlertDialog.Builder b = new AlertDialog.Builder(this);
        ScrollView sv = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(1);
        root.setPadding(dp(20), dp(20), dp(20), dp(20));
        root.setBackgroundColor(this.cSurface);

        boolean isToday = dateStr.equals(todayIso());
        boolean isPast = dateStr.compareTo(todayIso()) < 0;

        TextView tvSub = new TextView(this);
        tvSub.setText(isToday ? "✨ Hoje" : (isPast ? "📅 Dia anterior" : "🔮 Dia futuro"));
        tvSub.setTextColor(this.cPrimary);
        tvSub.setTextSize(sp(11.0f));
        tvSub.setTypeface(null, 1);
        root.addView(tvSub);

        TextView tvDate = new TextView(this);
        tvDate.setText(dateStr);
        tvDate.setTextColor(this.cTextMain);
        tvDate.setTextSize(sp(18.0f));
        tvDate.setTypeface(null, 1);
        tvDate.setPadding(0, dp(2), 0, dp(12));
        root.addView(tvDate);

        // Quick Add buttons inside DayPanel
        LinearLayout addRow = new LinearLayout(this);
        addRow.setOrientation(0);
        LinearLayout.LayoutParams arLp = new LinearLayout.LayoutParams(-1, -2);
        arLp.bottomMargin = dp(14);
        addRow.setLayoutParams(arLp);

        TextView btnAddN = createButton("📝 + Anotação", this.cBgMain, this.cTextMain);
        btnAddN.setPadding(dp(10), dp(8), dp(10), dp(8));
        LinearLayout.LayoutParams anLp = new LinearLayout.LayoutParams(0, -2, 1.0f);
        anLp.rightMargin = dp(6);
        btnAddN.setLayoutParams(anLp);
        addRow.addView(btnAddN);

        TextView btnAddE = createButton("📅 + Evento", this.cBgMain, this.cTextMain);
        btnAddE.setPadding(dp(10), dp(8), dp(10), dp(8));
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
                            Toast.makeText(MainActivity.this, "Dose confirmada!", 0).show();
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
                        MainActivity.this.calNotesList.remove(nIdx);
                        saveAll();
                        render();
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

        // Events section
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
            if (ev != null && dateStr.equals(ev.optString("date", ev.optString("data")))) {
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
                        MainActivity.this.events.remove(eIdx);
                        saveAll();
                        render();
                    }
                });
                eCard.addView(btnDelE);
                root.addView(eCard);
            }
        }
        if (evItems == 0) {
            TextView tvEmptyE = new TextView(this);
            tvEmptyE.setText("Nenhum evento neste dia.");
            tvEmptyE.setTextColor(this.cTextMuted);
            tvEmptyE.setTextSize(sp(12.0f));
            root.addView(tvEmptyE);
        }

        sv.addView(root);
        b.setView(sv);
        b.setNegativeButton("Fechar", null);
        final AlertDialog dlg = b.create();

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

        dlg.show();
    }

    private void showNoteModal(final String defaultDate, final JSONObject existing, final int editIdx) {
        AlertDialog.Builder b = new AlertDialog.Builder(this);
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(1);
        l.setPadding(dp(20), dp(20), dp(20), dp(12));
        l.setBackgroundColor(this.cSurface);

        TextView tvT = new TextView(this);
        tvT.setText(existing == null ? "📝 Nova anotação" : "📝 Editar anotação");
        tvT.setTextColor(this.cTextMain);
        tvT.setTextSize(sp(18.0f));
        tvT.setTypeface(null, 1);
        tvT.setPadding(0, 0, 0, dp(12));
        l.addView(tvT);

        final EditText inDate = createInput("Data (AAAA-MM-DD)", existing != null ? existing.optString("date", defaultDate) : defaultDate);
        final EditText inCat = createInput("Categoria (Sintoma, Dúvida médica, Efeito colateral, Geral)", existing != null ? existing.optString("category", "Geral") : "Sintoma");
        final EditText inText = createInput("Anotação * (Ex: Tontura leve pela manhã)", existing != null ? existing.optString("text", "") : "");

        l.addView(inDate);
        l.addView(inCat);
        l.addView(inText);
        b.setView(l);
        b.setPositiveButton("Salvar anotação", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
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
        });
        b.setNegativeButton("Cancelar", null);
        b.show();
    }

    private void showEventModal(final String defaultDate, final JSONObject existing, final int editIdx) {
        AlertDialog.Builder b = new AlertDialog.Builder(this);
        ScrollView sv = new ScrollView(this);
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(1);
        l.setPadding(dp(20), dp(20), dp(20), dp(12));
        l.setBackgroundColor(this.cSurface);

        TextView tvT = new TextView(this);
        tvT.setText(existing == null ? "📅 Novo evento de saúde" : "📅 Editar evento");
        tvT.setTextColor(this.cTextMain);
        tvT.setTextSize(sp(18.0f));
        tvT.setTypeface(null, 1);
        tvT.setPadding(0, 0, 0, dp(12));
        l.addView(tvT);

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
        b.setView(sv);
        b.setPositiveButton("Salvar evento", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
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
        });
        b.setNegativeButton("Cancelar", null);
        b.show();
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
            if (!"show_card".equals(this.profileSubView)) {
                LinearLayout subHdr = new LinearLayout(this);
                subHdr.setOrientation(0);
                subHdr.setGravity(16);
                LinearLayout.LayoutParams shLp = new LinearLayout.LayoutParams(-1, -2);
                shLp.bottomMargin = dp(18);
                subHdr.setLayoutParams(shLp);

                TextView btnBack = new TextView(this);
                btnBack.setText("‹");
                btnBack.setTextColor(this.cTextMain);
                btnBack.setTextSize(sp(24.0f));
                btnBack.setGravity(17);
                btnBack.setBackground(shape(this.cSurface, 12, this.cBorder, 1));
                LinearLayout.LayoutParams bkLp = new LinearLayout.LayoutParams(dp(42), dp(42));
                bkLp.rightMargin = dp(14);
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
                tvSubTitle.setTextSize(sp(20.0f));
                tvSubTitle.setTypeface(null, 1);
                subHdr.addView(tvSubTitle);
                linearLayout.addView(subHdr);
            }

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
        hcLp.bottomMargin = dp(24);
        heroCenter.setLayoutParams(hcLp);

        FrameLayout avatarFrame = new FrameLayout(this);
        LinearLayout.LayoutParams afLp = new LinearLayout.LayoutParams(dp(104), dp(104));
        afLp.bottomMargin = dp(14);
        avatarFrame.setLayoutParams(afLp);

        String nomeStr = this.profile.optString("nome", "Seu Nome");
        String initial = nomeStr.trim().isEmpty() ? "👤" : nomeStr.trim().substring(0, 1).toUpperCase(Locale.ROOT);
        TextView tvAvatarCircle = new TextView(this);
        tvAvatarCircle.setText(initial);
        tvAvatarCircle.setTextColor(this.cTextMain);
        tvAvatarCircle.setTextSize(sp(36.0f));
        tvAvatarCircle.setTypeface(null, 1);
        tvAvatarCircle.setGravity(17);
        tvAvatarCircle.setBackground(shape(this.cSurface, 50, this.cPrimary, 2));
        FrameLayout.LayoutParams acLp = new FrameLayout.LayoutParams(dp(100), dp(100), 17);
        tvAvatarCircle.setLayoutParams(acLp);
        avatarFrame.addView(tvAvatarCircle);

        TextView tvCamBadge = new TextView(this);
        tvCamBadge.setText("📷");
        tvCamBadge.setTextSize(sp(14.0f));
        tvCamBadge.setGravity(17);
        tvCamBadge.setBackground(shape(this.cPrimary, 16, this.cBgMain, 2));
        FrameLayout.LayoutParams cbLp = new FrameLayout.LayoutParams(dp(32), dp(32), 85); // Gravity.BOTTOM | Gravity.RIGHT
        tvCamBadge.setLayoutParams(cbLp);
        avatarFrame.addView(tvCamBadge);

        avatarFrame.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.profileSubView = "personal";
                render();
            }
        });
        heroCenter.addView(avatarFrame);

        TextView tvName = new TextView(this);
        tvName.setText(nomeStr);
        tvName.setTextColor(this.cTextMain);
        tvName.setTextSize(sp(22.0f));
        tvName.setTypeface(null, 1);
        tvName.setGravity(17);
        heroCenter.addView(tvName);

        int age = calculateProfileAge(this.profile.optString("data_nascimento", ""));
        if (age > 0) {
            TextView tvAge = new TextView(this);
            tvAge.setText(age + " anos");
            tvAge.setTextColor(this.cTextMuted);
            tvAge.setTextSize(sp(15.0f));
            tvAge.setGravity(17);
            tvAge.setPadding(0, dp(4), 0, 0);
            heroCenter.addView(tvAge);
        }

        String roleVal = this.profile.optString("user_role", "independent");
        String roleLabel = "caregiver".equals(roleVal) ? "🤝 Cuidador" : ("patient".equals(roleVal) ? "🧑 Paciente" : "⚙️ Independente");
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
        emergCard.setBackground(shape(Color.parseColor("#EF4444"), 24, 0, 0));
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
        tvEmSub.setTextColor(Color.parseColor("#E6FFFFFF"));
        tvEmSub.setTextSize(sp(14.0f));
        tvEmSub.setPadding(0, dp(8), 0, dp(18));
        emergCard.addView(tvEmSub);

        LinearLayout emBtnRow = new LinearLayout(this);
        emBtnRow.setOrientation(0);

        TextView btnOpenCard = new TextView(this);
        btnOpenCard.setText("Abrir Cartão");
        btnOpenCard.setTextColor(Color.parseColor("#EF4444"));
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
        btnConfigCard.setBackground(shape(Color.parseColor("#33FFFFFF"), 14, 0, 0));
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
            {"👤", "Dados pessoais", "Nome, nascimento, peso, altura...", "personal"},
            {"❤️", "Saúde", "Alergias e condições importantes...", "health"},
            {"💊", "Tratamento", "Medicamentos para emergência...", "important_meds"},
            {"👨‍⚕️", "Profissionais", "Médicos e especialistas...", "professionals"},
            {"👨‍👩‍👧", "Contatos", "Emergência e familiares...", "contacts"},
            {"🤝", "Cuidadores", "Quem acompanha seu tratamento...", "caregivers"},
            {"📦", "Estoque", "Histórico e previsões...", "stock"},
            {"🔄", "Mudar Perfil", "Alterar tipo de conta...", "role_swap"},
            {"🔐", "Privacidade", "Controle dos seus dados...", "privacy"},
            {"⚙️", "Preferências", "Acessibilidade e notificações...", "prefs"}
        };

        for (int i = 0; i < navItems.length; i++) {
            menuCard.addView(createProfileNavRow(navItems[i][0], navItems[i][1], navItems[i][2], navItems[i][3]));
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
                MainActivity.this.isLoggedIn = false;
                saveAll();
                render();
            }
        });
        linearLayout.addView(btnLogout);
    }

    private View createProfileNavRow(String icon, String title, String subtitle, final String subViewTarget) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(0);
        row.setGravity(16);
        row.setPadding(dp(14), dp(16), dp(14), dp(16));

        TextView tvI = new TextView(this);
        tvI.setText(icon);
        tvI.setTextSize(sp(22.0f));
        tvI.setGravity(17);
        LinearLayout.LayoutParams iLp = new LinearLayout.LayoutParams(dp(36), -2);
        iLp.rightMargin = dp(14);
        tvI.setLayoutParams(iLp);
        row.addView(tvI);

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(1);
        col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

        TextView tvT = new TextView(this);
        tvT.setText(title);
        tvT.setTextColor(this.cTextMain);
        tvT.setTextSize(sp(16.0f));
        tvT.setTypeface(null, 1);
        col.addView(tvT);

        TextView tvS = new TextView(this);
        tvS.setText(subtitle);
        tvS.setTextColor(this.cTextMuted);
        tvS.setTextSize(sp(13.0f));
        tvS.setPadding(0, dp(2), 0, 0);
        col.addView(tvS);

        row.addView(col);

        TextView tvChev = new TextView(this);
        tvChev.setText("›");
        tvChev.setTextColor(this.cTextMuted);
        tvChev.setTextSize(sp(20.0f));
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
        if ("personal".equals(sub)) return "Dados Pessoais";
        if ("health".equals(sub)) return "Saúde";
        if ("important_meds".equals(sub)) return "Tratamento";
        if ("professionals".equals(sub)) return "Profissionais";
        if ("contacts".equals(sub)) return "Contatos";
        if ("caregivers".equals(sub)) return "Cuidadores";
        if ("stock".equals(sub) || "stock_history".equals(sub)) return "Estoque";
        if ("role_swap".equals(sub)) return "Mudar Perfil";
        if ("privacy".equals(sub)) return "Privacidade";
        if ("prefs".equals(sub)) return "Preferências";
        if ("config_card".equals(sub)) return "Configurar Cartão";
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
        card.setPadding(dp(20), dp(20), dp(20), dp(20));

        TextView tvSub = new TextView(this);
        tvSub.setText("Escolha quais informações aparecerão no seu Cartão de Emergência:");
        tvSub.setTextColor(this.cTextMuted);
        tvSub.setTextSize(sp(14.0f));
        tvSub.setPadding(0, 0, 0, dp(14));
        card.addView(tvSub);

        String[][] toggles = {
            {"ec_show_allergies", "Exibir alergias"},
            {"ec_show_conditions", "Exibir condições médicas"},
            {"ec_show_meds", "Exibir medicamentos importantes"},
            {"ec_show_contacts", "Exibir contatos de emergência"},
            {"ec_show_doctors", "Exibir médico responsável"},
            {"ec_show_notes", "Exibir observações importantes"}
        };
        for (final String[] tg : toggles) {
            final CheckBox cb = new CheckBox(this);
            cb.setText("  " + tg[1]);
            cb.setTextColor(this.cTextMain);
            cb.setTextSize(sp(15.0f));
            cb.setChecked(this.profile.optBoolean(tg[0], true));
            cb.setPadding(0, dp(10), 0, dp(10));
            cb.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    try {
                        MainActivity.this.profile.put(tg[0], cb.isChecked());
                        saveAll();
                    } catch (Exception ignored) {}
                }
            });
            card.addView(cb);
        }
        linearLayout.addView(card);
    }

    private void buildImportantMedsSubScreen(LinearLayout linearLayout) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        card.setPadding(dp(20), dp(20), dp(20), dp(20));

        TextView tvSub = new TextView(this);
        tvSub.setText("Selecione quais medicamentos devem aparecer em destaque no seu Cartão de Emergência:");
        tvSub.setTextColor(this.cTextMuted);
        tvSub.setTextSize(sp(14.0f));
        tvSub.setPadding(0, 0, 0, dp(14));
        card.addView(tvSub);

        if (this.meds.length() == 0) {
            TextView tvEmpty = new TextView(this);
            tvEmpty.setText("Nenhum medicamento cadastrado.");
            tvEmpty.setTextColor(this.cTextMuted);
            tvEmpty.setTextSize(sp(14.0f));
            card.addView(tvEmpty);
        } else {
            for (int i = 0; i < this.meds.length(); i++) {
                final JSONObject m = this.meds.optJSONObject(i);
                if (m == null) continue;
                final CheckBox cb = new CheckBox(this);
                cb.setText("  💊 " + m.optString("nome") + " (" + m.optString("dosagem") + ")");
                cb.setTextColor(this.cTextMain);
                cb.setTextSize(sp(15.0f));
                cb.setChecked(m.optBoolean("important_for_emergency", true));
                cb.setPadding(0, dp(10), 0, dp(10));
                cb.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        try {
                            m.put("important_for_emergency", cb.isChecked());
                            saveAll();
                        } catch (Exception ignored) {}
                    }
                });
                card.addView(cb);
            }
        }
        linearLayout.addView(card);
    }

    private void buildRoleSwapSubScreen(LinearLayout linearLayout) {
        String curRole = this.profile.optString("user_role", "independent");
        String[][] roles = {
            {"patient", "🧑", "Sou Paciente", "Tenho alguém que me ajuda a controlar meus remédios."},
            {"caregiver", "🤝", "Sou Cuidador", "Ajudo outra pessoa (familiar ou paciente) com o tratamento."},
            {"independent", "⚙️", "Uso Independente", "Cuido do meu próprio tratamento sozinho."}
        };
        for (final String[] r : roles) {
            boolean active = r[0].equals(curRole);
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(0);
            card.setGravity(16);
            card.setBackground(shape(active ? Color.parseColor("#1A3B82F6") : this.cSurface, 18, active ? this.cPrimary : this.cBorder, active ? 2 : 1));
            card.setPadding(dp(18), dp(18), dp(18), dp(18));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
            lp.bottomMargin = dp(12);
            card.setLayoutParams(lp);

            TextView tvI = new TextView(this);
            tvI.setText(r[1]);
            tvI.setTextSize(sp(28.0f));
            tvI.setPadding(0, 0, dp(14), 0);
            card.addView(tvI);

            LinearLayout col = new LinearLayout(this);
            col.setOrientation(1);
            col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

            TextView tvT = new TextView(this);
            tvT.setText(r[2] + (active ? "  [Atual]" : ""));
            tvT.setTextColor(active ? this.cPrimary : this.cTextMain);
            tvT.setTextSize(sp(16.0f));
            tvT.setTypeface(null, 1);
            col.addView(tvT);

            TextView tvD = new TextView(this);
            tvD.setText(r[3]);
            tvD.setTextColor(this.cTextMuted);
            tvD.setTextSize(sp(13.0f));
            tvD.setPadding(0, dp(4), 0, 0);
            col.addView(tvD);

            card.addView(col);
            card.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    try {
                        MainActivity.this.profile.put("user_role", r[0]);
                        saveAll();
                        render();
                        Toast.makeText(MainActivity.this, "Perfil alterado para " + r[2], 0).show();
                    } catch (Exception ignored) {}
                }
            });
            linearLayout.addView(card);
        }
    }

    private void buildPrivacySubScreen(LinearLayout linearLayout) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        card.setPadding(dp(20), dp(20), dp(20), dp(20));

        TextView tvInfo = new TextView(this);
        tvInfo.setText("Seus dados de saúde são armazenados com segurança no dispositivo e sincronizados com o servidor MediCare.");
        tvInfo.setTextColor(this.cTextMuted);
        tvInfo.setTextSize(sp(14.0f));
        tvInfo.setPadding(0, 0, 0, dp(16));
        card.addView(tvInfo);

        TextView btnSync = createButton("☁️ Sincronizar dados agora", this.cPrimary, Color.WHITE);
        LinearLayout.LayoutParams sLp = new LinearLayout.LayoutParams(-1, -2);
        sLp.bottomMargin = dp(12);
        btnSync.setLayoutParams(sLp);
        btnSync.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                syncWithBackendSilently(true);
            }
        });
        card.addView(btnSync);

        TextView btnExport = createButton("📤 Exportar meus dados (JSON)", this.cBgMain, this.cTextMain);
        btnExport.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    Intent sendIntent = new Intent(Intent.ACTION_SEND);
                    sendIntent.putExtra(Intent.EXTRA_TEXT, MainActivity.this.profile.toString(2));
                    sendIntent.setType("text/plain");
                    startActivity(Intent.createChooser(sendIntent, "Exportar Dados"));
                } catch (Exception ignored) {}
            }
        });
        card.addView(btnExport);
        linearLayout.addView(card);
    }

    private void buildPrefsSubScreen(LinearLayout linearLayout) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(1);
        card.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        card.setPadding(dp(20), dp(20), dp(20), dp(20));

        LinearLayout.LayoutParams btnLp = new LinearLayout.LayoutParams(-1, -2);
        btnLp.bottomMargin = dp(12);

        TextView btnTheme = createButton(this.isDarkMode ? "☀️ Mudar para Tema Claro" : "🌙 Mudar para Tema Escuro", this.cBgMain, this.cTextMain);
        btnTheme.setLayoutParams(btnLp);
        btnTheme.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.isDarkMode = !MainActivity.this.isDarkMode;
                saveAll();
                render();
            }
        });
        card.addView(btnTheme);

        TextView btnAccess = createButton(this.isAccessibilityMode ? "🔤 Fonte Ampliada (Idosos): ATIVA" : "🔤 Ativar Fonte Ampliada (Idosos)", this.cBgMain, this.cTextMain);
        btnAccess.setLayoutParams(btnLp);
        btnAccess.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.isAccessibilityMode = !MainActivity.this.isAccessibilityMode;
                saveAll();
                render();
            }
        });
        card.addView(btnAccess);

        TextView btnContrast = createButton(this.isHighContrast ? "👁 Alto Contraste: ATIVO" : "👁 Ativar Alto Contraste", this.cBgMain, this.cTextMain);
        btnContrast.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.isHighContrast = !MainActivity.this.isHighContrast;
                saveAll();
                render();
            }
        });
        card.addView(btnContrast);

        linearLayout.addView(card);
    }

    private void buildPersonalDataSubScreen(LinearLayout linearLayout) {
        linearLayout.addView(sectionHeader("✏️ Dados Pessoais", "Atualize suas informações gerais de cadastro"));

        final EditText inNome = createInput("Nome Completo", this.profile.optString("nome", ""));
        final EditText inDataNasc = createInput("Data de Nascimento (Ex: 15/04/1980)", this.profile.optString("data_nascimento", ""));
        final EditText inCpf = createInput("CPF", this.profile.optString("cpf", ""));
        final EditText inTel = createInput("Telefone", this.profile.optString("telefone", ""));
        final EditText inEndereco = createInput("Endereço Completo", this.profile.optString("endereco", ""));
        final EditText inSang = createInput("Tipo Sanguíneo (Ex: O+)", this.profile.optString("tipo_sanguineo", ""));
        final EditText inPeso = createInput("Peso (kg)", this.profile.optString("peso", ""));
        final EditText inAltura = createInput("Altura (cm)", this.profile.optString("altura", ""));
        final EditText inObs = createInput("Observações Médicas Gerais", this.profile.optString("observacoes_medicas", ""));

        linearLayout.addView(inNome);
        linearLayout.addView(inDataNasc);
        linearLayout.addView(inCpf);
        linearLayout.addView(inTel);
        linearLayout.addView(inEndereco);
        linearLayout.addView(inSang);
        linearLayout.addView(inPeso);
        linearLayout.addView(inAltura);
        linearLayout.addView(inObs);

        TextView btnSave = createButton("💾 Salvar Alterações", this.cPrimary, Color.WHITE);
        btnSave.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    MainActivity.this.profile.put("nome", inNome.getText().toString().trim());
                    MainActivity.this.profile.put("data_nascimento", inDataNasc.getText().toString().trim());
                    MainActivity.this.profile.put("cpf", inCpf.getText().toString().trim());
                    MainActivity.this.profile.put("telefone", inTel.getText().toString().trim());
                    MainActivity.this.profile.put("endereco", inEndereco.getText().toString().trim());
                    MainActivity.this.profile.put("tipo_sanguineo", inSang.getText().toString().trim());
                    MainActivity.this.profile.put("peso", inPeso.getText().toString().trim());
                    MainActivity.this.profile.put("altura", inAltura.getText().toString().trim());
                    MainActivity.this.profile.put("observacoes_medicas", inObs.getText().toString().trim());

                    saveAll();
                    Toast.makeText(MainActivity.this, "Dados pessoais atualizados!", 0).show();
                    MainActivity.this.profileSubView = "main";
                    render();
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Erro ao salvar dados", 0).show();
                }
            }
        });
        linearLayout.addView(btnSave);
    }

    private void buildEmergencyCardSubScreen(LinearLayout linearLayout) {
        TextView btnCloseCard = createButton("✕ Fechar Cartão", this.cSurface, this.cTextMain);
        LinearLayout.LayoutParams ccLp = new LinearLayout.LayoutParams(-1, -2);
        ccLp.bottomMargin = dp(14);
        btnCloseCard.setLayoutParams(ccLp);
        btnCloseCard.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                MainActivity.this.profileSubView = "main";
                render();
            }
        });
        linearLayout.addView(btnCloseCard);

        LinearLayout banner = new LinearLayout(this);
        banner.setOrientation(1);
        banner.setBackground(shape(this.cDanger, 18, 0, 0));
        banner.setPadding(dp(18), dp(18), dp(18), dp(18));
        LinearLayout.LayoutParams bLp = new LinearLayout.LayoutParams(-1, -2);
        bLp.bottomMargin = dp(16);
        banner.setLayoutParams(bLp);

        TextView tvTitle = new TextView(this);
        tvTitle.setText("🚨 CARTÃO DE EMERGÊNCIA MÉDICA (ICE)");
        tvTitle.setTextColor(Color.WHITE);
        tvTitle.setTextSize(sp(16.0f));
        tvTitle.setTypeface(null, 1);
        banner.addView(tvTitle);

        TextView tvSub = new TextView(this);
        tvSub.setText("Apresente esta tela a socorristas ou médicos de emergência");
        tvSub.setTextColor(Color.parseColor("#FEE2E2"));
        tvSub.setTextSize(sp(12.0f));
        tvSub.setPadding(0, dp(4), 0, 0);
        banner.addView(tvSub);

        linearLayout.addView(banner);

        LinearLayout statsCard = new LinearLayout(this);
        statsCard.setOrientation(1);
        statsCard.setBackground(shape(this.cSurface, 18, this.cBorder, 1));
        statsCard.setPadding(dp(16), dp(16), dp(16), dp(16));
        LinearLayout.LayoutParams sLp = new LinearLayout.LayoutParams(-1, -2);
        sLp.bottomMargin = dp(14);
        statsCard.setLayoutParams(sLp);

        TextView tvPName = new TextView(this);
        tvPName.setText("👤 " + this.profile.optString("nome", "Paciente"));
        tvPName.setTextColor(this.cTextMain);
        tvPName.setTextSize(sp(18.0f));
        tvPName.setTypeface(null, 1);
        statsCard.addView(tvPName);

        TextView tvPInfo = new TextView(this);
        tvPInfo.setText("Tipo Sanguíneo: " + this.profile.optString("tipo_sanguineo", "N/I") + "\nPeso: " + this.profile.optString("peso", "-") + " kg • Altura: " + this.profile.optString("altura", "-") + " cm\nNascimento: " + this.profile.optString("data_nascimento", "-") + "\nCPF: " + this.profile.optString("cpf", "-"));
        tvPInfo.setTextColor(this.cTextMuted);
        tvPInfo.setTextSize(sp(13.0f));
        tvPInfo.setPadding(0, dp(6), 0, 0);
        statsCard.addView(tvPInfo);

        linearLayout.addView(statsCard);

        LinearLayout algCard = new LinearLayout(this);
        algCard.setOrientation(1);
        algCard.setBackground(shape(this.allergies.length() > 0 ? this.cDangerBg : this.cSurface, 16, this.cBorder, 1));
        algCard.setPadding(dp(14), dp(14), dp(14), dp(14));
        LinearLayout.LayoutParams aLp = new LinearLayout.LayoutParams(-1, -2);
        aLp.bottomMargin = dp(14);
        algCard.setLayoutParams(aLp);

        TextView tvAlgT = new TextView(this);
        tvAlgT.setText("⚠️ Alergias Medicamentosas / Alimentares (" + this.allergies.length() + ")");
        tvAlgT.setTextColor(this.allergies.length() > 0 ? this.cDanger : this.cTextMain);
        tvAlgT.setTextSize(sp(14.0f));
        tvAlgT.setTypeface(null, 1);
        algCard.addView(tvAlgT);

        if (this.allergies.length() == 0) {
            TextView tvNoAlg = new TextView(this);
            tvNoAlg.setText("Nenhuma alergia cadastrada.");
            tvNoAlg.setTextColor(this.cTextMuted);
            tvNoAlg.setTextSize(sp(12.0f));
            tvNoAlg.setPadding(0, dp(4), 0, 0);
            algCard.addView(tvNoAlg);
        } else {
            for (int i = 0; i < this.allergies.length(); i++) {
                JSONObject alg = this.allergies.optJSONObject(i);
                if (alg != null) {
                    TextView tvAlgItem = new TextView(this);
                    tvAlgItem.setText("• " + alg.optString("nome") + " (" + alg.optString("gravidade", "Grave") + ") - " + alg.optString("reacao", "Sem reação descrita"));
                    tvAlgItem.setTextColor(this.cDanger);
                    tvAlgItem.setTextSize(sp(13.0f));
                    tvAlgItem.setTypeface(null, 1);
                    tvAlgItem.setPadding(0, dp(4), 0, 0);
                    algCard.addView(tvAlgItem);
                }
            }
        }
        linearLayout.addView(algCard);

        LinearLayout medCard = new LinearLayout(this);
        medCard.setOrientation(1);
        medCard.setBackground(shape(this.cSurface, 16, this.cBorder, 1));
        medCard.setPadding(dp(14), dp(14), dp(14), dp(14));
        LinearLayout.LayoutParams mLp = new LinearLayout.LayoutParams(-1, -2);
        mLp.bottomMargin = dp(14);
        medCard.setLayoutParams(mLp);

        TextView tvMedT = new TextView(this);
        tvMedT.setText("💊 Medicamentos em Uso Contínuo (" + this.meds.length() + ")");
        tvMedT.setTextColor(this.cTextMain);
        tvMedT.setTextSize(sp(14.0f));
        tvMedT.setTypeface(null, 1);
        medCard.addView(tvMedT);

        for (int i = 0; i < this.meds.length(); i++) {
            JSONObject m = this.meds.optJSONObject(i);
            if (m != null) {
                TextView tvM = new TextView(this);
                tvM.setText("• " + m.optString("nome") + " " + m.optString("dosagem") + " (" + m.optString("frequencia") + ")");
                tvM.setTextColor(this.cTextMuted);
                tvM.setTextSize(sp(12.0f));
                tvM.setPadding(0, dp(4), 0, 0);
                medCard.addView(tvM);
            }
        }
        linearLayout.addView(medCard);

        TextView tvCallTitle = new TextView(this);
        tvCallTitle.setText("📞 Discar para Contatos de Emergência:");
        tvCallTitle.setTextColor(this.cTextMain);
        tvCallTitle.setTextSize(sp(14.0f));
        tvCallTitle.setTypeface(null, 1);
        tvCallTitle.setPadding(0, 0, 0, dp(8));
        linearLayout.addView(tvCallTitle);

        TextView btnSamu = createButton("📞 LIGAR PARA O SAMU 192", this.cDanger, Color.WHITE);
        LinearLayout.LayoutParams samuLp = new LinearLayout.LayoutParams(-1, -2);
        samuLp.bottomMargin = dp(10);
        btnSamu.setLayoutParams(samuLp);
        btnSamu.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:192")));
            }
        });
        linearLayout.addView(btnSamu);

        for (int i = 0; i < this.contacts.length(); i++) {
            final JSONObject c = this.contacts.optJSONObject(i);
            if (c != null) {
                final String telNum = c.optString("telefone", "");
                TextView btnCall = createButton("📞 Ligar para " + c.optString("nome") + " (" + c.optString("relacao") + "): " + telNum, this.cSurface, this.cPrimary);
                LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(-1, -2);
                cLp.bottomMargin = dp(8);
                btnCall.setLayoutParams(cLp);
                btnCall.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + telNum.replaceAll("[^0-9+]", ""))));
                    }
                });
                linearLayout.addView(btnCall);
            }
        }
    }

    private void buildHealthSubScreen(LinearLayout linearLayout) {
        linearLayout.addView(sectionHeader("🩺 Alergias & Condições de Saúde", "Mantenha seu histórico médico atualizado"));

        LinearLayout algHeader = new LinearLayout(this);
        algHeader.setOrientation(0);
        algHeader.setGravity(16);
        algHeader.setPadding(0, 0, 0, dp(8));

        TextView tvA = new TextView(this);
        tvA.setText("⚠️ Alergias (" + this.allergies.length() + ")");
        tvA.setTextColor(this.cTextMain);
        tvA.setTextSize(sp(15.0f));
        tvA.setTypeface(null, 1);
        tvA.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        algHeader.addView(tvA);

        TextView btnAddAlg = createButton("➕ Adicionar", this.cPrimaryLight, this.cPrimary);
        btnAddAlg.setPadding(dp(10), dp(6), dp(10), dp(6));
        btnAddAlg.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showAddAllergyDialog();
            }
        });
        algHeader.addView(btnAddAlg);
        linearLayout.addView(algHeader);

        if (this.allergies.length() == 0) {
            TextView emptyA = new TextView(this);
            emptyA.setText("Nenhuma alergia cadastrada.");
            emptyA.setTextColor(this.cTextMuted);
            emptyA.setTextSize(sp(12.0f));
            emptyA.setPadding(0, 0, 0, dp(16));
            linearLayout.addView(emptyA);
        } else {
            for (int i = 0; i < this.allergies.length(); i++) {
                final int idx = i;
                final JSONObject a = this.allergies.optJSONObject(i);
                if (a == null) continue;

                LinearLayout item = new LinearLayout(this);
                item.setOrientation(0);
                item.setGravity(16);
                item.setBackground(shape(this.cSurface, 14, this.cBorder, 1));
                item.setPadding(dp(12), dp(10), dp(12), dp(10));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
                lp.bottomMargin = dp(8);
                item.setLayoutParams(lp);

                LinearLayout textCol = new LinearLayout(this);
                textCol.setOrientation(1);
                textCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

                TextView tvN = new TextView(this);
                tvN.setText(a.optString("nome"));
                tvN.setTextColor(this.cTextMain);
                tvN.setTextSize(sp(14.0f));
                tvN.setTypeface(null, 1);
                textCol.addView(tvN);

                TextView tvR = new TextView(this);
                tvR.setText("Gravidade: " + a.optString("gravidade", "Moderada") + " • Reação: " + a.optString("reacao", "-"));
                tvR.setTextColor(this.cTextMuted);
                tvR.setTextSize(sp(12.0f));
                textCol.addView(tvR);

                item.addView(textCol);

                TextView btnDel = new TextView(this);
                btnDel.setText("🗑️");
                btnDel.setTextSize(sp(16.0f));
                btnDel.setPadding(dp(8), dp(4), dp(8), dp(4));
                btnDel.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        MainActivity.this.allergies.remove(idx);
                        saveAll();
                        render();
                    }
                });
                item.addView(btnDel);

                linearLayout.addView(item);
            }
        }

        LinearLayout condHeader = new LinearLayout(this);
        condHeader.setOrientation(0);
        condHeader.setGravity(16);
        condHeader.setPadding(0, dp(12), 0, dp(8));

        TextView tvC = new TextView(this);
        tvC.setText("🩺 Condições / Doenças Crônicas (" + this.conditions.length() + ")");
        tvC.setTextColor(this.cTextMain);
        tvC.setTextSize(sp(15.0f));
        tvC.setTypeface(null, 1);
        tvC.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        condHeader.addView(tvC);

        TextView btnAddCond = createButton("➕ Adicionar", this.cPrimaryLight, this.cPrimary);
        btnAddCond.setPadding(dp(10), dp(6), dp(10), dp(6));
        btnAddCond.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showAddConditionDialog();
            }
        });
        condHeader.addView(btnAddCond);
        linearLayout.addView(condHeader);

        if (this.conditions.length() == 0) {
            TextView emptyC = new TextView(this);
            emptyC.setText("Nenhuma condição crônica cadastrada.");
            emptyC.setTextColor(this.cTextMuted);
            emptyC.setTextSize(sp(12.0f));
            linearLayout.addView(emptyC);
        } else {
            for (int i = 0; i < this.conditions.length(); i++) {
                final int idx = i;
                final JSONObject c = this.conditions.optJSONObject(i);
                if (c == null) continue;

                LinearLayout item = new LinearLayout(this);
                item.setOrientation(0);
                item.setGravity(16);
                item.setBackground(shape(this.cSurface, 14, this.cBorder, 1));
                item.setPadding(dp(12), dp(10), dp(12), dp(10));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
                lp.bottomMargin = dp(8);
                item.setLayoutParams(lp);

                LinearLayout textCol = new LinearLayout(this);
                textCol.setOrientation(1);
                textCol.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

                TextView tvN = new TextView(this);
                tvN.setText(c.optString("nome"));
                tvN.setTextColor(this.cTextMain);
                tvN.setTextSize(sp(14.0f));
                tvN.setTypeface(null, 1);
                textCol.addView(tvN);

                TextView tvD = new TextView(this);
                tvD.setText("Diagnóstico: " + c.optString("data_diagnostico", "Não informada") + " • Notas: " + c.optString("notas", "-"));
                tvD.setTextColor(this.cTextMuted);
                tvD.setTextSize(sp(12.0f));
                textCol.addView(tvD);

                item.addView(textCol);

                TextView btnDel = new TextView(this);
                btnDel.setText("🗑️");
                btnDel.setTextSize(sp(16.0f));
                btnDel.setPadding(dp(8), dp(4), dp(8), dp(4));
                btnDel.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        MainActivity.this.conditions.remove(idx);
                        saveAll();
                        render();
                    }
                });
                item.addView(btnDel);

                linearLayout.addView(item);
            }
        }
    }

    private void showAddAllergyDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Adicionar Alergia");
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(1);
        layout.setPadding(dp(20), dp(10), dp(20), dp(10));

        final EditText etNome = createInput("Nome da Alergia (Ex: Penicilina)", "");
        final EditText etGrav = createInput("Gravidade (Leve, Moderada, Grave)", "Grave");
        final EditText etReacao = createInput("Reação (Ex: Manchas vermelhas)", "");

        layout.addView(etNome);
        layout.addView(etGrav);
        layout.addView(etReacao);
        builder.setView(layout);

        builder.setPositiveButton("Salvar", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                try {
                    String nome = etNome.getText().toString().trim();
                    if (!nome.isEmpty()) {
                        JSONObject newA = new JSONObject();
                        newA.put("id", "alg-" + System.currentTimeMillis());
                        newA.put("nome", nome);
                        newA.put("gravidade", etGrav.getText().toString().trim());
                        newA.put("reacao", etReacao.getText().toString().trim());
                        MainActivity.this.allergies.put(newA);
                        saveAll();
                        render();
                    }
                } catch (Exception e) {}
            }
        });
        builder.setNegativeButton("Cancelar", null);
        builder.show();
    }

    private void showAddConditionDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Adicionar Condição Médica");
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(1);
        layout.setPadding(dp(20), dp(10), dp(20), dp(10));

        final EditText etNome = createInput("Nome da Condição (Ex: Hipertensão)", "");
        final EditText etDiag = createInput("Ano/Data do Diagnóstico", "");
        final EditText etNotas = createInput("Observações Médicas", "");

        layout.addView(etNome);
        layout.addView(etDiag);
        layout.addView(etNotas);
        builder.setView(layout);

        builder.setPositiveButton("Salvar", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                try {
                    String nome = etNome.getText().toString().trim();
                    if (!nome.isEmpty()) {
                        JSONObject newC = new JSONObject();
                        newC.put("id", "cond-" + System.currentTimeMillis());
                        newC.put("nome", nome);
                        newC.put("data_diagnostico", etDiag.getText().toString().trim());
                        newC.put("notas", etNotas.getText().toString().trim());
                        MainActivity.this.conditions.put(newC);
                        saveAll();
                        render();
                    }
                } catch (Exception e) {}
            }
        });
        builder.setNegativeButton("Cancelar", null);
        builder.show();
    }

    private void buildContactsSubScreen(LinearLayout linearLayout) {
        linearLayout.addView(sectionHeader("📞 Contatos de Emergência", "Pessoas de confiança para chamadas rápidas"));

        TextView btnAdd = createButton("➕ Adicionar Novo Contato", this.cPrimary, Color.WHITE);
        LinearLayout.LayoutParams btnLp = new LinearLayout.LayoutParams(-1, -2);
        btnLp.bottomMargin = dp(14);
        btnAdd.setLayoutParams(btnLp);
        btnAdd.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showAddContactDialog();
            }
        });
        linearLayout.addView(btnAdd);

        if (this.contacts.length() == 0) {
            TextView empty = new TextView(this);
            empty.setText("Nenhum contato de emergência cadastrado.");
            empty.setTextColor(this.cTextMuted);
            empty.setTextSize(sp(12.0f));
            linearLayout.addView(empty);
        } else {
            for (int i = 0; i < this.contacts.length(); i++) {
                final int idx = i;
                final JSONObject c = this.contacts.optJSONObject(i);
                if (c == null) continue;
                final String telNum = c.optString("telefone", "");

                LinearLayout card = new LinearLayout(this);
                card.setOrientation(0);
                card.setGravity(16);
                card.setBackground(shape(this.cSurface, 16, this.cBorder, 1));
                card.setPadding(dp(14), dp(12), dp(14), dp(12));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
                lp.bottomMargin = dp(10);
                card.setLayoutParams(lp);

                LinearLayout col = new LinearLayout(this);
                col.setOrientation(1);
                col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

                TextView tvN = new TextView(this);
                tvN.setText("👤 " + c.optString("nome") + " (" + c.optString("relacao") + ")");
                tvN.setTextColor(this.cTextMain);
                tvN.setTextSize(sp(14.0f));
                tvN.setTypeface(null, 1);
                col.addView(tvN);

                TextView tvT = new TextView(this);
                tvT.setText("📞 " + telNum);
                tvT.setTextColor(this.cTextMuted);
                tvT.setTextSize(sp(12.0f));
                col.addView(tvT);

                card.addView(col);

                TextView btnDial = createButton("📞 Ligar", this.cPrimaryLight, this.cPrimary);
                btnDial.setPadding(dp(10), dp(6), dp(10), dp(6));
                btnDial.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + telNum.replaceAll("[^0-9+]", ""))));
                    }
                });
                card.addView(btnDial);

                TextView btnDel = new TextView(this);
                btnDel.setText("🗑️");
                btnDel.setTextSize(sp(16.0f));
                btnDel.setPadding(dp(8), dp(4), dp(8), dp(4));
                btnDel.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        MainActivity.this.contacts.remove(idx);
                        saveAll();
                        render();
                    }
                });
                card.addView(btnDel);

                linearLayout.addView(card);
            }
        }
    }

    private void showAddContactDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Adicionar Contato de Emergência");
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(1);
        layout.setPadding(dp(20), dp(10), dp(20), dp(10));

        final EditText etNome = createInput("Nome Completo", "");
        final EditText etRel = createInput("Relação (Ex: Filho, Cônjuge)", "");
        final EditText etTel = createInput("Telefone com DDD", "");

        layout.addView(etNome);
        layout.addView(etRel);
        layout.addView(etTel);
        builder.setView(layout);

        builder.setPositiveButton("Salvar", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                try {
                    String nome = etNome.getText().toString().trim();
                    if (!nome.isEmpty()) {
                        JSONObject newC = new JSONObject();
                        newC.put("id", "cnt-" + System.currentTimeMillis());
                        newC.put("nome", nome);
                        newC.put("relacao", etRel.getText().toString().trim());
                        newC.put("telefone", etTel.getText().toString().trim());
                        MainActivity.this.contacts.put(newC);
                        saveAll();
                        render();
                    }
                } catch (Exception e) {}
            }
        });
        builder.setNegativeButton("Cancelar", null);
        builder.show();
    }

    private void buildProfessionalsSubScreen(LinearLayout linearLayout) {
        linearLayout.addView(sectionHeader("👨‍⚕️ Profissionais de Saúde", "Seus médicos, especialistas e farmacêuticos"));

        TextView btnAdd = createButton("➕ Adicionar Profissional", this.cPrimary, Color.WHITE);
        LinearLayout.LayoutParams btnLp = new LinearLayout.LayoutParams(-1, -2);
        btnLp.bottomMargin = dp(14);
        btnAdd.setLayoutParams(btnLp);
        btnAdd.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showAddProfessionalDialog();
            }
        });
        linearLayout.addView(btnAdd);

        if (this.professionals.length() == 0) {
            TextView empty = new TextView(this);
            empty.setText("Nenhum profissional de saúde cadastrado.");
            empty.setTextColor(this.cTextMuted);
            empty.setTextSize(sp(12.0f));
            linearLayout.addView(empty);
        } else {
            for (int i = 0; i < this.professionals.length(); i++) {
                final int idx = i;
                final JSONObject p = this.professionals.optJSONObject(i);
                if (p == null) continue;
                final String telNum = p.optString("telefone", "");

                LinearLayout card = new LinearLayout(this);
                card.setOrientation(0);
                card.setGravity(16);
                card.setBackground(shape(this.cSurface, 16, this.cBorder, 1));
                card.setPadding(dp(14), dp(12), dp(14), dp(12));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
                lp.bottomMargin = dp(10);
                card.setLayoutParams(lp);

                LinearLayout col = new LinearLayout(this);
                col.setOrientation(1);
                col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

                TextView tvN = new TextView(this);
                tvN.setText("👨‍⚕️ " + p.optString("nome") + " (" + p.optString("especialidade") + ")");
                tvN.setTextColor(this.cTextMain);
                tvN.setTextSize(sp(14.0f));
                tvN.setTypeface(null, 1);
                col.addView(tvN);

                TextView tvI = new TextView(this);
                tvI.setText("CRM/Reg: " + p.optString("crm", "-") + " • Clínica: " + p.optString("clinica", "-") + "\nTel: " + telNum);
                tvI.setTextColor(this.cTextMuted);
                tvI.setTextSize(sp(12.0f));
                col.addView(tvI);

                card.addView(col);

                if (!telNum.isEmpty()) {
                    TextView btnDial = createButton("📞 Ligar", this.cPrimaryLight, this.cPrimary);
                    btnDial.setPadding(dp(10), dp(6), dp(10), dp(6));
                    btnDial.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + telNum.replaceAll("[^0-9+]", ""))));
                        }
                    });
                    card.addView(btnDial);
                }

                TextView btnDel = new TextView(this);
                btnDel.setText("🗑️");
                btnDel.setTextSize(sp(16.0f));
                btnDel.setPadding(dp(8), dp(4), dp(8), dp(4));
                btnDel.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        MainActivity.this.professionals.remove(idx);
                        saveAll();
                        render();
                    }
                });
                card.addView(btnDel);

                linearLayout.addView(card);
            }
        }
    }

    private void showAddProfessionalDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Adicionar Profissional de Saúde");
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(1);
        layout.setPadding(dp(20), dp(10), dp(20), dp(10));

        final EditText etNome = createInput("Nome do Médico/Farmacêutico", "");
        final EditText etEsp = createInput("Especialidade (Ex: Cardiologia)", "");
        final EditText etCrm = createInput("CRM / Registro Profissional", "");
        final EditText etClinica = createInput("Consultório / Hospital", "");
        final EditText etTel = createInput("Telefone de Contato", "");

        layout.addView(etNome);
        layout.addView(etEsp);
        layout.addView(etCrm);
        layout.addView(etClinica);
        layout.addView(etTel);
        builder.setView(layout);

        builder.setPositiveButton("Salvar", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                try {
                    String nome = etNome.getText().toString().trim();
                    if (!nome.isEmpty()) {
                        JSONObject newP = new JSONObject();
                        newP.put("id", "prof-" + System.currentTimeMillis());
                        newP.put("nome", nome);
                        newP.put("especialidade", etEsp.getText().toString().trim());
                        newP.put("crm", etCrm.getText().toString().trim());
                        newP.put("clinica", etClinica.getText().toString().trim());
                        newP.put("telefone", etTel.getText().toString().trim());
                        MainActivity.this.professionals.put(newP);
                        saveAll();
                        render();
                    }
                } catch (Exception e) {}
            }
        });
        builder.setNegativeButton("Cancelar", null);
        builder.show();
    }

    private void buildCaregiversSubScreen(LinearLayout linearLayout) {
        linearLayout.addView(sectionHeader("🤝 Cuidadores Vinculados", "Pessoas autorizadas a acompanhar sua adesão"));

        TextView btnInvite = createButton("🔑 Gerar Código de Convite para Cuidador", this.cPrimary, Color.WHITE);
        LinearLayout.LayoutParams btnLp = new LinearLayout.LayoutParams(-1, -2);
        btnLp.bottomMargin = dp(14);
        btnInvite.setLayoutParams(btnLp);
        btnInvite.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                generateCaregiverInviteCode();
            }
        });
        linearLayout.addView(btnInvite);

        if (this.caregivers.length() == 0) {
            TextView empty = new TextView(this);
            empty.setText("Nenhum cuidador vinculado a este perfil.");
            empty.setTextColor(this.cTextMuted);
            empty.setTextSize(sp(12.0f));
            linearLayout.addView(empty);
        } else {
            for (int i = 0; i < this.caregivers.length(); i++) {
                final int idx = i;
                final JSONObject cg = this.caregivers.optJSONObject(i);
                if (cg == null) continue;

                LinearLayout card = new LinearLayout(this);
                card.setOrientation(0);
                card.setGravity(16);
                card.setBackground(shape(this.cSurface, 16, this.cBorder, 1));
                card.setPadding(dp(14), dp(12), dp(14), dp(12));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
                lp.bottomMargin = dp(10);
                card.setLayoutParams(lp);

                LinearLayout col = new LinearLayout(this);
                col.setOrientation(1);
                col.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));

                TextView tvN = new TextView(this);
                tvN.setText("🤝 " + cg.optString("nome", "Cuidador") + " (" + cg.optString("relacao", "Familiar") + ")");
                tvN.setTextColor(this.cTextMain);
                tvN.setTextSize(sp(14.0f));
                tvN.setTypeface(null, 1);
                col.addView(tvN);

                TextView tvS = new TextView(this);
                tvS.setText("Status: " + cg.optString("status", "Ativo") + " • Código: " + cg.optString("codigo_convite", "MED-883921"));
                tvS.setTextColor(this.cTextMuted);
                tvS.setTextSize(sp(12.0f));
                col.addView(tvS);

                card.addView(col);

                TextView btnRevoke = createButton("Revogar", this.cDangerBg, this.cDanger);
                btnRevoke.setPadding(dp(10), dp(6), dp(10), dp(6));
                btnRevoke.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        MainActivity.this.caregivers.remove(idx);
                        saveAll();
                        render();
                    }
                });
                card.addView(btnRevoke);

                linearLayout.addView(card);
            }
        }
    }

    private void generateCaregiverInviteCode() {
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

            AlertDialog.Builder builder = new AlertDialog.Builder(this);
            builder.setTitle("🔑 Código de Convite Criado!");
            builder.setMessage("Compartilhe este código com seu cuidador para que ele acompanhe seus medicamentos:\n\nCÓDIGO: " + token + "\n\nO cuidador deverá digitar este código na plataforma Web do MediCare Cuidador.");
            builder.setPositiveButton("OK", null);
            builder.show();
        } catch (Exception e) {}
    }

    private void buildStockHistorySubScreen(LinearLayout linearLayout) {
        linearLayout.addView(sectionHeader("📦 Histórico de Movimentações de Estoque", "Registro de entradas, saídas e consumos de medicamentos"));

        if (this.stockMovements.length() == 0) {
            TextView empty = new TextView(this);
            empty.setText("Nenhuma movimentação de estoque registrada até o momento.");
            empty.setTextColor(this.cTextMuted);
            empty.setTextSize(sp(12.0f));
            linearLayout.addView(empty);
        } else {
            for (int i = this.stockMovements.length() - 1; i >= 0; i--) {
                JSONObject sm = this.stockMovements.optJSONObject(i);
                if (sm == null) continue;

                LinearLayout card = new LinearLayout(this);
                card.setOrientation(1);
                card.setBackground(shape(this.cSurface, 14, this.cBorder, 1));
                card.setPadding(dp(12), dp(10), dp(12), dp(10));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
                lp.bottomMargin = dp(8);
                card.setLayoutParams(lp);

                TextView tvM = new TextView(this);
                tvM.setText("📦 " + sm.optString("medicamento_nome") + " (" + sm.optString("tipo_movimento", "Ajuste") + ")");
                tvM.setTextColor(this.cTextMain);
                tvM.setTextSize(sp(13.0f));
                tvM.setTypeface(null, 1);
                card.addView(tvM);

                TextView tvD = new TextView(this);
                tvD.setText("Qtd: " + sm.optString("quantidade") + " • Data: " + sm.optString("data_hora") + " • Obs: " + sm.optString("observacao", "Sem observações"));
                tvD.setTextColor(this.cTextMuted);
                tvD.setTextSize(sp(11.0f));
                card.addView(tvD);

                linearLayout.addView(card);
            }
        }
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
        this.isLoggedIn = false;
        saveAll();
        render();
    }

    private void syncWithBackendSilently(final boolean z) {
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
            JSONObject jSONObject = new JSONObject();
            jSONObject.put("patientId", this.profile.optString("id", "pac-001"));
            jSONObject.put("profile", this.profile);
            jSONObject.put("medicamentos", this.meds);
            jSONObject.put("historico_doses", this.doseLogs);
            jSONObject.put("health_events", this.events);
            jSONObject.put("calendar_notes", this.calNotes);
            jSONObject.put("stock_movements", this.stockMovements);
            jSONObject.put("allergies", this.allergies);
            jSONObject.put("health_conditions", this.conditions);
            jSONObject.put("emergency_contacts", this.contacts);
            jSONObject.put("healthcare_professionals", this.professionals);
            jSONObject.put("caregiver_relationships", this.caregivers);
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
            final boolean optBoolean = jSONObject2.optBoolean("ok", z2);
            final String format = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.US).format(new Date());
            runOnUiThread(new Runnable() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda8
                @Override // java.lang.Runnable
                public final void run() {
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
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("🚨 Emergência Médica (SOS)");
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
        builder.setMessage(sb.toString());
        builder.setPositiveButton("📞 Ligar SAMU 192", new DialogInterface.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda10
            @Override // android.content.DialogInterface.OnClickListener
            public final void onClick(DialogInterface dialogInterface, int i2) {
                MainActivity.this.m21x2ce5f109(dialogInterface, i2);
            }
        });
        builder.setNegativeButton("Fechar", (DialogInterface.OnClickListener) null);
        builder.show();
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
