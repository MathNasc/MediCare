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
    private JSONArray caregivers;
    private JSONArray conditions;
    private JSONArray contacts;
    private JSONArray doseLogs;
    private JSONArray events;
    private JSONArray meds;
    private SharedPreferences prefs;
    private JSONArray professionals;
    private JSONObject profile;
    private FrameLayout rootContainer;
    private JSONArray stockMovements;
    private int cPrimary = Color.parseColor("#0D9488");
    private int cPrimaryHover = Color.parseColor("#0F766E");
    private int cPrimaryLight = Color.parseColor("#CCFBF1");
    private int cBgMain = Color.parseColor("#F8FAFC");
    private int cSurface = Color.parseColor("#FFFFFF");
    private int cSurfaceHover = Color.parseColor("#F1F5F9");
    private int cBorder = Color.parseColor("#E2E8F0");
    private int cTextMain = Color.parseColor("#0F172A");
    private int cTextMuted = Color.parseColor("#475569");
    private int cTextLight = Color.parseColor("#94A3B8");
    private int cSuccess = Color.parseColor("#10B981");
    private int cSuccessBg = Color.parseColor("#D1FAE5");
    private int cWarning = Color.parseColor("#F59E0B");
    private int cWarningBg = Color.parseColor("#FEF3C7");
    private int cDanger = Color.parseColor("#EF4444");
    private int cDangerBg = Color.parseColor("#FEE2E2");
    private int cInfo = Color.parseColor("#3B82F6");
    private int cInfoBg = Color.parseColor("#DBEAFE");
    private int cPurple = Color.parseColor("#9333EA");
    private int cPurpleBg = Color.parseColor("#F3E8FF");
    private boolean isLoggedIn = false;
    private int onboardingStep = 0;
    private boolean isRegisterMode = false;
    private boolean isDarkMode = false;
    private boolean isAccessibilityMode = false;
    private String activeTab = "home";
    private List<String> tabHistory = new ArrayList();
    private long lastBackPressTime = 0;
    private String medFilter = "todos";
    private String selectedCalDate = EMBEDDED_API_KEY;
    private boolean showCalSearch = false;
    private String aiSubView = "main";
    private String profileSubView = "main";
    private String lastSyncTimestamp = "Sincronização automática ativa";
    private boolean backendStatusOk = true;

    @Override // android.app.Activity
    protected void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        requestWindowFeature(1);
        this.prefs = getSharedPreferences("medicare_patient_store_v2", 0);
        this.selectedCalDate = todayIso();
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
        if (this.isDarkMode) {
            this.cPrimary = Color.parseColor("#14B8A6");
            this.cPrimaryHover = Color.parseColor("#2DD4BF");
            this.cPrimaryLight = Color.parseColor("#115E59");
            this.cBgMain = Color.parseColor("#0F172A");
            this.cSurface = Color.parseColor("#1E293B");
            this.cSurfaceHover = Color.parseColor("#334155");
            this.cBorder = Color.parseColor("#334155");
            this.cTextMain = Color.parseColor("#F8FAFC");
            this.cTextMuted = Color.parseColor("#CBD5E1");
            this.cTextLight = Color.parseColor("#64748B");
            this.cSuccessBg = Color.parseColor("#064E3B");
            this.cWarningBg = Color.parseColor("#78350F");
            this.cDangerBg = Color.parseColor("#7F1D1D");
            this.cInfoBg = Color.parseColor("#1E3A8A");
            this.cPurpleBg = Color.parseColor("#4C1D95");
        } else {
            this.cPrimary = Color.parseColor("#0D9488");
            this.cPrimaryHover = Color.parseColor("#0F766E");
            this.cPrimaryLight = Color.parseColor("#CCFBF1");
            this.cBgMain = Color.parseColor("#F8FAFC");
            this.cSurface = Color.parseColor("#FFFFFF");
            this.cSurfaceHover = Color.parseColor("#F1F5F9");
            this.cBorder = Color.parseColor("#E2E8F0");
            this.cTextMain = Color.parseColor("#0F172A");
            this.cTextMuted = Color.parseColor("#475569");
            this.cTextLight = Color.parseColor("#94A3B8");
            this.cSuccessBg = Color.parseColor("#D1FAE5");
            this.cWarningBg = Color.parseColor("#FEF3C7");
            this.cDangerBg = Color.parseColor("#FEE2E2");
            this.cInfoBg = Color.parseColor("#DBEAFE");
            this.cPurpleBg = Color.parseColor("#F3E8FF");
        }
        if (Build.VERSION.SDK_INT >= 21) {
            getWindow().setStatusBarColor(this.cPrimaryHover);
        }
    }

    private void loadOrInitData() {
        try {
            this.isLoggedIn = this.prefs.getBoolean("is_logged_in", false);
            this.isDarkMode = this.prefs.getBoolean("dark_mode", false);
            this.isAccessibilityMode = this.prefs.getBoolean("accessibility_mode", false);
            this.lastSyncTimestamp = this.prefs.getString("last_sync_timestamp", "Sincronização automática ativa");
            String string = this.prefs.getString("profile", null);
            if (string != null) {
                this.profile = new JSONObject(string);
                this.meds = new JSONArray(this.prefs.getString("meds", "[]"));
                this.doseLogs = new JSONArray(this.prefs.getString("dose_logs", "[]"));
                this.events = new JSONArray(this.prefs.getString("events", "[]"));
                this.calNotes = new JSONObject(this.prefs.getString("cal_notes", "{}"));
                this.stockMovements = new JSONArray(this.prefs.getString("stock_movements", "[]"));
                this.allergies = new JSONArray(this.prefs.getString("allergies", "[]"));
                this.conditions = new JSONArray(this.prefs.getString("conditions", "[]"));
                this.contacts = new JSONArray(this.prefs.getString("contacts", "[]"));
                this.professionals = new JSONArray(this.prefs.getString("professionals", "[]"));
                this.caregivers = new JSONArray(this.prefs.getString("caregivers", "[]"));

                // Se houver resquício do perfil mockado antigo "maria.silva@email.com", limpar completamente
                if ("maria.silva@email.com".equalsIgnoreCase(this.profile.optString("email", ""))) {
                    this.isLoggedIn = false;
                    this.profile = new JSONObject();
                    this.meds = new JSONArray();
                    this.doseLogs = new JSONArray();
                    this.events = new JSONArray();
                    this.calNotes = new JSONObject();
                    this.stockMovements = new JSONArray();
                    this.allergies = new JSONArray();
                    this.conditions = new JSONArray();
                    this.contacts = new JSONArray();
                    this.professionals = new JSONArray();
                    this.caregivers = new JSONArray();
                    this.prefs.edit().putBoolean("is_logged_in", false).putBoolean("onboarding_completed", false).apply();
                    saveAll();
                }
            } else {
                this.profile = new JSONObject();
                this.profile.put("id", "");
                this.profile.put("nome", "");
                this.profile.put("email", "");
                this.profile.put("data_nascimento", "");
                this.profile.put("telefone", "");
                this.profile.put("cpf", "");
                this.profile.put("tipo_sanguineo", "");
                this.profile.put("peso", "");
                this.profile.put("altura", "");
                this.profile.put("endereco", "");
                this.profile.put("observacoes_medicas", "");
                this.profile.put("alerta_sonoro", true);
                this.meds = new JSONArray();
                this.doseLogs = new JSONArray();
                this.events = new JSONArray();
                this.calNotes = new JSONObject();
                this.stockMovements = new JSONArray();
                this.allergies = new JSONArray();
                this.conditions = new JSONArray();
                this.contacts = new JSONArray();
                this.professionals = new JSONArray();
                this.caregivers = new JSONArray();
                saveAll();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void saveAll() {
        this.prefs.edit().putBoolean("is_logged_in", this.isLoggedIn).putBoolean("dark_mode", this.isDarkMode).putBoolean("accessibility_mode", this.isAccessibilityMode).putString("last_sync_timestamp", this.lastSyncTimestamp).putString("profile", this.profile.toString()).putString("meds", this.meds.toString()).putString("dose_logs", this.doseLogs.toString()).putString("events", this.events.toString()).putString("cal_notes", this.calNotes.toString()).putString("stock_movements", this.stockMovements.toString()).putString("allergies", this.allergies.toString()).putString("conditions", this.conditions.toString()).putString("contacts", this.contacts.toString()).putString("professionals", this.professionals.toString()).putString("caregivers", this.caregivers.toString()).apply();
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
        linearLayout.addView(buildHeader());
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setLayoutParams(new LinearLayout.LayoutParams(-1, 0, 1.0f));
        LinearLayout linearLayout2 = new LinearLayout(this);
        linearLayout2.setOrientation(1);
        linearLayout2.setPadding(dp(16), dp(16), dp(16), dp(28));
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
        linearLayout.addView(buildBottomNav());
        this.rootContainer.addView(linearLayout);
    }

    private View buildHeader() {
        LinearLayout linearLayout = new LinearLayout(this);
        linearLayout.setOrientation(0);
        linearLayout.setGravity(16);
        linearLayout.setBackgroundColor(this.cSurface);
        linearLayout.setPadding(dp(16), dp(12), dp(16), dp(12));
        if (("profile".equals(this.activeTab) && !"main".equals(this.profileSubView)) || ("ai".equals(this.activeTab) && !"main".equals(this.aiSubView)) || !"home".equals(this.activeTab)) {
            TextView textView = new TextView(this);
            textView.setText("←");
            textView.setTextSize(sp(18.0f));
            textView.setTextColor(this.cPrimary);
            textView.setTypeface(null, 1);
            textView.setGravity(17);
            textView.setBackground(shape(this.cPrimaryLight, 10, 0, 0));
            LinearLayout.LayoutParams layoutParams = new LinearLayout.LayoutParams(dp(36), dp(36));
            layoutParams.rightMargin = dp(10);
            textView.setLayoutParams(layoutParams);
            textView.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda1
                @Override // android.view.View.OnClickListener
                public final void onClick(View view) {
                    MainActivity.this.m4lambda$buildHeader$0$commedicarepatientMainActivity(view);
                }
            });
            linearLayout.addView(textView);
        } else {
            ImageView imageView = new ImageView(this);
            imageView.setImageResource(R.mipmap.ic_launcher);
            LinearLayout.LayoutParams layoutParams2 = new LinearLayout.LayoutParams(dp(38), dp(38));
            layoutParams2.rightMargin = dp(10);
            imageView.setLayoutParams(layoutParams2);
            linearLayout.addView(imageView);
        }
        LinearLayout linearLayout2 = new LinearLayout(this);
        linearLayout2.setOrientation(1);
        linearLayout2.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        TextView textView2 = new TextView(this);
        textView2.setText("MediCare");
        textView2.setTextColor(this.cTextMain);
        textView2.setTextSize(sp(18.0f));
        textView2.setTypeface(null, 1);
        linearLayout2.addView(textView2);
        TextView textView3 = new TextView(this);
        textView3.setText("Portal do Paciente • " + this.profile.optString("nome", "Paciente"));
        textView3.setTextColor(this.cTextMuted);
        textView3.setTextSize(sp(11.0f));
        linearLayout2.addView(textView3);
        linearLayout.addView(linearLayout2);
        TextView textView4 = new TextView(this);
        textView4.setText("🚨 SOS");
        textView4.setTextColor(-1);
        textView4.setTextSize(sp(12.0f));
        textView4.setTypeface(null, 1);
        textView4.setPadding(dp(12), dp(7), dp(12), dp(7));
        textView4.setBackground(shape(this.cDanger, 18, 0, 0));
        textView4.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda2
            @Override // android.view.View.OnClickListener
            public final void onClick(View view) {
                MainActivity.this.m5lambda$buildHeader$1$commedicarepatientMainActivity(view);
            }
        });
        linearLayout.addView(textView4);
        return linearLayout;
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildHeader$0$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m4lambda$buildHeader$0$commedicarepatientMainActivity(View view) {
        onBackPressed();
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildHeader$1$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m5lambda$buildHeader$1$commedicarepatientMainActivity(View view) {
        showSosEmergencyDialog();
    }

    private View buildBottomNav() {
        LinearLayout linearLayout = new LinearLayout(this);
        linearLayout.setOrientation(0);
        linearLayout.setBackgroundColor(this.cSurface);
        linearLayout.setPadding(dp(6), dp(8), dp(6), dp(10));
        int i = 5;
        int i2 = 4;
        String[][] strArr = {new String[]{"home", "🏠", "Início"}, new String[]{"meds", "💊", "Remédios"}, new String[]{"calendar", "📅", "Agenda"}, new String[]{"ai", "✨", "Assistente"}, new String[]{"profile", "👤", "Perfil"}};
        int i3 = 0;
        while (i3 < i) {
            final String[] strArr2 = strArr[i3];
            boolean equals = strArr2[0].equals(this.activeTab);
            LinearLayout linearLayout2 = new LinearLayout(this);
            linearLayout2.setOrientation(1);
            linearLayout2.setGravity(17);
            linearLayout2.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
            linearLayout2.setPadding(dp(i2), dp(6), dp(i2), dp(6));
            if (equals) {
                linearLayout2.setBackground(shape(this.cPrimaryLight, 14, 0, 0));
            }
            TextView textView = new TextView(this);
            textView.setText(strArr2[1]);
            textView.setTextSize(sp(18.0f));
            textView.setGravity(17);
            linearLayout2.addView(textView);
            TextView textView2 = new TextView(this);
            textView2.setText(strArr2[2]);
            textView2.setTextSize(sp(11.0f));
            textView2.setTypeface(null, equals ? 1 : 0);
            textView2.setTextColor(equals ? this.cPrimary : this.cTextMuted);
            textView2.setGravity(17);
            linearLayout2.addView(textView2);
            linearLayout2.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda12
                @Override // android.view.View.OnClickListener
                public final void onClick(View view) {
                    MainActivity.this.m0lambda$buildBottomNav$2$commedicarepatientMainActivity(strArr2, view);
                }
            });
            linearLayout.addView(linearLayout2);
            i3++;
            i = 5;
            i2 = 4;
        }
        return linearLayout;
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildBottomNav$2$com-medicare-patient-MainActivity, reason: not valid java name */
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

    private String getDoseStatus(String str, String str2, String str3) {
        for (int i = 0; i < this.doseLogs.length(); i++) {
            JSONObject optJSONObject = this.doseLogs.optJSONObject(i);
            if (optJSONObject != null && str.equals(optJSONObject.optString("med_id")) && str2.equals(optJSONObject.optString("data")) && str3.equals(optJSONObject.optString("horario"))) {
                return optJSONObject.optString("status", "pendente");
            }
        }
        return "pendente";
    }

    /* JADX WARN: Removed duplicated region for block: B:32:0x01af  */
    /* JADX WARN: Removed duplicated region for block: B:37:0x01b2  */
    /*
        Code decompiled incorrectly, please refer to instructions dump.
    */
    private void registerDose(JSONObject jSONObject, String str, String str2, String str3) {
        String str4;
        String str5;
        String str6;
        MainActivity mainActivity;
        String str7;
        MainActivity mainActivity2 = this;
        String str8 = "estoque_atual";
        String str9 = "tomado";
        try {
            String optString = jSONObject.optString("id");
            int i = 0;
            while (true) {
                str4 = str9;
                str5 = str8;
                if (i >= mainActivity2.doseLogs.length()) {
                    i = -1;
                    str6 = "pendente";
                    break;
                }
                try {
                    JSONObject optJSONObject = mainActivity2.doseLogs.optJSONObject(i);
                    if (optJSONObject == null || !optString.equals(optJSONObject.optString("med_id")) || !str.equals(optJSONObject.optString("data")) || !str2.equals(optJSONObject.optString("horario"))) {
                        i++;
                        mainActivity2 = this;
                        str9 = str4;
                        str8 = str5;
                    } else {
                        str6 = optJSONObject.optString("status", "pendente");
                        break;
                    }
                } catch (Exception e) {
                    e = e;
                    e.printStackTrace();
                    return;
                }
            }
            String str10 = str3;
            if (str6.equals(str10)) {
                str10 = "pendente";
            }
            String str11 = str6;
            int i2 = i;
            String format = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());
            JSONObject jSONObject2 = new JSONObject();
            String str12 = str10;
            jSONObject2.put("id", "log-" + System.currentTimeMillis());
            jSONObject2.put("med_id", optString);
            jSONObject2.put("med_nome", jSONObject.optString("nome") + " " + jSONObject.optString("dosagem"));
            jSONObject2.put("data", str);
            jSONObject2.put("horario", str2);
            jSONObject2.put("status", str12);
            jSONObject2.put("hora_real", format);
            if (i2 >= 0) {
                mainActivity = this;
                mainActivity.doseLogs.put(i2, jSONObject2);
            } else {
                mainActivity = this;
                mainActivity.doseLogs.put(jSONObject2);
            }
            int optInt = jSONObject.optInt(str5, 0);
            if (str4.equals(str12)) {
                str7 = str11;
                if (!str4.equals(str7)) {
                    jSONObject.put(str5, Math.max(0, optInt - 1));
                    mainActivity.stockMovements.put(new JSONObject().put("id", "sm-" + System.currentTimeMillis()).put("med_nome", jSONObject.optString("nome")).put("tipo", "saida").put("qtd", 1).put("data", str + " " + format).put("motivo", "Dose tomada (" + str2 + ")"));
                    saveAll();
                    render();
                    Toast.makeText(mainActivity, !str4.equals(str12) ? "Dose confirmada!" : "Status da dose atualizado", 0).show();
                }
            } else {
                str7 = str11;
            }
            if (!str4.equals(str12) && str4.equals(str7)) {
                jSONObject.put(str5, optInt + 1);
            }
            saveAll();
            render();
            Toast.makeText(mainActivity, !str4.equals(str12) ? "Dose confirmada!" : "Status da dose atualizado", 0).show();
        } catch (Exception e2) {
        }
    }

    private void buildHomeTab(LinearLayout linearLayout) {
        String str;
        String str2;
        String str3;
        String str4;
        String str5;
        JSONArray optJSONArray;
        String str6;
        int i;
        JSONArray optJSONArray2;
        final String str7 = todayIso();
        int i2 = 0;
        int i3 = 0;
        int i4 = 0;
        int i5 = 0;
        while (true) {
            str = "horarios";
            str2 = "tipo_uso";
            str3 = "sos";
            if (i2 >= this.meds.length()) {
                break;
            }
            JSONObject optJSONObject = this.meds.optJSONObject(i2);
            if (optJSONObject != null) {
                if (optJSONObject.optInt("estoque_atual", 0) <= optJSONObject.optInt("estoque_minimo", 5)) {
                    i5++;
                }
                if (!"sos".equals(optJSONObject.optString("tipo_uso")) && (optJSONArray2 = optJSONObject.optJSONArray("horarios")) != null) {
                    for (int i6 = 0; i6 < optJSONArray2.length(); i6++) {
                        i3++;
                        if ("tomado".equals(getDoseStatus(optJSONObject.optString("id"), str7, optJSONArray2.optString(i6)))) {
                            i4++;
                        }
                    }
                }
            }
            i2++;
        }
        int round = i3 > 0 ? Math.round((i4 * 100.0f) / i3) : 100;
        LinearLayout linearLayout2 = new LinearLayout(this);
        linearLayout2.setOrientation(1);
        linearLayout2.setBackground(gradientShape(this.cPrimary, this.cPrimaryHover, 22));
        linearLayout2.setPadding(dp(20), dp(20), dp(20), dp(20));
        LinearLayout.LayoutParams layoutParams = new LinearLayout.LayoutParams(-1, -2);
        layoutParams.bottomMargin = dp(16);
        linearLayout2.setLayoutParams(layoutParams);
        TextView textView = new TextView(this);
        String str8 = "tomado";
        textView.setText("Olá, " + this.profile.optString("nome", "Maria Silva") + " 👋");
        textView.setTextColor(-1);
        textView.setTextSize(sp(21.0f));
        textView.setTypeface(null, 1);
        linearLayout2.addView(textView);
        TextView textView2 = new TextView(this);
        textView2.setText("Resumo de Hoje • " + i4 + " de " + i3 + " doses concluídas");
        textView2.setTextColor(Color.parseColor("#E6FFFA"));
        textView2.setTextSize(sp(13.0f));
        textView2.setPadding(0, dp(4), 0, dp(14));
        linearLayout2.addView(textView2);
        LinearLayout linearLayout3 = new LinearLayout(this);
        linearLayout3.setOrientation(0);
        linearLayout3.addView(buildHeroKpi("Adesão Hoje", round + "%"));
        linearLayout3.addView(buildHeroKpi("Pendentes", String.valueOf(Math.max(0, i3 - i4))));
        linearLayout3.addView(buildHeroKpi("Estoque Baixo", String.valueOf(i5)));
        linearLayout2.addView(linearLayout3);
        linearLayout.addView(linearLayout2);
        if (i5 > 0) {
            LinearLayout linearLayout4 = new LinearLayout(this);
            linearLayout4.setOrientation(0);
            linearLayout4.setGravity(16);
            linearLayout4.setBackground(shape(this.cWarningBg, 16, this.cWarning, 1));
            linearLayout4.setPadding(dp(14), dp(12), dp(14), dp(12));
            LinearLayout.LayoutParams layoutParams2 = new LinearLayout.LayoutParams(-1, -2);
            layoutParams2.bottomMargin = dp(16);
            linearLayout4.setLayoutParams(layoutParams2);
            TextView textView3 = new TextView(this);
            textView3.setText("⚠️ Atenção: " + i5 + " medicamento(s) com estoque baixo. Toque para repor.");
            textView3.setTextColor(this.cTextMain);
            textView3.setTextSize(sp(12.0f));
            textView3.setTypeface(null, 1);
            textView3.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
            linearLayout4.addView(textView3);
            linearLayout4.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda21
                @Override // android.view.View.OnClickListener
                public final void onClick(View view) {
                    MainActivity.this.m6lambda$buildHomeTab$4$commedicarepatientMainActivity(view);
                }
            });
            linearLayout.addView(linearLayout4);
        }
        linearLayout.addView(sectionHeader("Cronograma de Doses de Hoje", "Toque em Confirmar Dose ou Não Tomei"));
        String format = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());
        int i7 = 0;
        while (i7 < this.meds.length()) {
            final JSONObject optJSONObject2 = this.meds.optJSONObject(i7);
            if (optJSONObject2 != null && !str3.equals(optJSONObject2.optString(str2)) && (optJSONArray = optJSONObject2.optJSONArray(str)) != null) {
                int i8 = 0;
                while (i8 < optJSONArray.length()) {
                    final String optString = optJSONArray.optString(i8);
                    String doseStatus = getDoseStatus(optJSONObject2.optString("id"), str7, optString);
                    boolean z = "pendente".equals(doseStatus) && optString.compareTo(format) < 0;
                    LinearLayout linearLayout5 = new LinearLayout(this);
                    String str9 = format;
                    linearLayout5.setOrientation(1);
                    int i9 = this.cSurface;
                    if (z) {
                        str6 = str;
                        i = this.cDanger;
                    } else {
                        str6 = str;
                        i = this.cBorder;
                    }
                    String str10 = str3;
                    JSONArray jSONArray = optJSONArray;
                    linearLayout5.setBackground(shape(i9, 16, i, 1));
                    String str11 = str2;
                    linearLayout5.setPadding(dp(14), dp(14), dp(14), dp(14));
                    LinearLayout.LayoutParams layoutParams3 = new LinearLayout.LayoutParams(-1, -2);
                    layoutParams3.bottomMargin = dp(10);
                    linearLayout5.setLayoutParams(layoutParams3);
                    LinearLayout linearLayout6 = new LinearLayout(this);
                    linearLayout6.setOrientation(0);
                    linearLayout6.setGravity(16);
                    TextView textView4 = new TextView(this);
                    textView4.setText("⏰ " + optString);
                    textView4.setTextSize(sp(13.0f));
                    textView4.setTypeface(null, 1);
                    textView4.setTextColor(z ? this.cDanger : this.cPrimary);
                    textView4.setBackground(shape(z ? this.cDangerBg : this.cPrimaryLight, 10, 0, 0));
                    int i10 = i7;
                    int i11 = i8;
                    textView4.setPadding(dp(10), dp(5), dp(10), dp(5));
                    linearLayout6.addView(textView4);
                    LinearLayout linearLayout7 = new LinearLayout(this);
                    linearLayout7.setOrientation(1);
                    linearLayout7.setPadding(dp(10), 0, dp(8), 0);
                    linearLayout7.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
                    TextView textView5 = new TextView(this);
                    textView5.setText(optJSONObject2.optString("nome") + " • " + optJSONObject2.optString("dosagem"));
                    textView5.setTextColor(this.cTextMain);
                    textView5.setTextSize(sp(15.0f));
                    textView5.setTypeface(null, 1);
                    linearLayout7.addView(textView5);
                    TextView textView6 = new TextView(this);
                    textView6.setText(optJSONObject2.optString("forma") + " • " + optJSONObject2.optString("instrucoes"));
                    textView6.setTextColor(this.cTextMuted);
                    textView6.setTextSize(sp(12.0f));
                    linearLayout7.addView(textView6);
                    linearLayout6.addView(linearLayout7);
                    TextView textView7 = new TextView(this);
                    String str12 = str8;
                    if (str12.equals(doseStatus)) {
                        textView7.setText("✓ Tomado");
                        textView7.setTextColor(this.cSuccess);
                        textView7.setBackground(shape(this.cSuccessBg, 10, 0, 0));
                    } else if ("pulado".equals(doseStatus)) {
                        textView7.setText("✕ Pulado");
                        textView7.setTextColor(this.cWarning);
                        textView7.setBackground(shape(this.cWarningBg, 10, 0, 0));
                    } else if (z) {
                        textView7.setText("Atrasado");
                        textView7.setTextColor(this.cDanger);
                        textView7.setBackground(shape(this.cDangerBg, 10, 0, 0));
                    } else {
                        textView7.setText("Pendente");
                        textView7.setTextColor(this.cInfo);
                        textView7.setBackground(shape(this.cInfoBg, 10, 0, 0));
                    }
                    textView7.setTextSize(sp(11.0f));
                    textView7.setTypeface(null, 1);
                    textView7.setPadding(dp(8), dp(4), dp(8), dp(4));
                    linearLayout6.addView(textView7);
                    linearLayout5.addView(linearLayout6);
                    LinearLayout linearLayout8 = new LinearLayout(this);
                    linearLayout8.setOrientation(0);
                    linearLayout8.setPadding(0, dp(10), 0, 0);
                    TextView textView8 = new TextView(this);
                    textView8.setText(str12.equals(doseStatus) ? "✓ Dose Confirmada (Desfazer)" : "✓ Confirmar Dose");
                    textView8.setGravity(17);
                    textView8.setTextSize(sp(12.0f));
                    textView8.setTypeface(null, 1);
                    textView8.setTextColor(str12.equals(doseStatus) ? this.cSuccess : -1);
                    textView8.setBackground(shape(str12.equals(doseStatus) ? this.cSuccessBg : this.cPrimary, 10, 0, 0));
                    textView8.setPadding(dp(12), dp(9), dp(12), dp(9));
                    LinearLayout.LayoutParams layoutParams4 = new LinearLayout.LayoutParams(0, -2, 1.0f);
                    layoutParams4.rightMargin = dp(8);
                    textView8.setLayoutParams(layoutParams4);
                    textView8.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda22
                        @Override // android.view.View.OnClickListener
                        public final void onClick(View view) {
                            MainActivity.this.m7lambda$buildHomeTab$5$commedicarepatientMainActivity(optJSONObject2, str7, optString, view);
                        }
                    });
                    linearLayout8.addView(textView8);
                    TextView textView9 = new TextView(this);
                    textView9.setText("pulado".equals(doseStatus) ? "Não Tomada" : "Não Tomei");
                    textView9.setGravity(17);
                    textView9.setTextSize(sp(12.0f));
                    textView9.setTextColor(this.cTextMuted);
                    textView9.setBackground(shape(this.cSurfaceHover, 10, this.cBorder, 1));
                    textView9.setPadding(dp(12), dp(9), dp(12), dp(9));
                    textView9.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda23
                        @Override // android.view.View.OnClickListener
                        public final void onClick(View view) {
                            MainActivity.this.m8lambda$buildHomeTab$6$commedicarepatientMainActivity(optJSONObject2, str7, optString, view);
                        }
                    });
                    linearLayout8.addView(textView9);
                    linearLayout5.addView(linearLayout8);
                    linearLayout.addView(linearLayout5);
                    i8 = i11 + 1;
                    str8 = str12;
                    i7 = i10;
                    format = str9;
                    str = str6;
                    optJSONArray = jSONArray;
                    str3 = str10;
                    str2 = str11;
                }
            }
            str8 = str8;
            format = format;
            str = str;
            str3 = str3;
            str2 = str2;
            i7++;
        }
        String str13 = str2;
        String str14 = str3;
        linearLayout.addView(sectionHeader("Medicamentos SOS (Se Necessário)", "Registro imediato de sintomas ou dor"));
        int i12 = 0;
        while (i12 < this.meds.length()) {
            final JSONObject optJSONObject3 = this.meds.optJSONObject(i12);
            if (optJSONObject3 != null) {
                str5 = str13;
                str4 = str14;
                if (str4.equals(optJSONObject3.optString(str5))) {
                    LinearLayout linearLayout9 = new LinearLayout(this);
                    linearLayout9.setOrientation(0);
                    linearLayout9.setGravity(16);
                    linearLayout9.setBackground(shape(this.cSurface, 16, this.cBorder, 1));
                    linearLayout9.setPadding(dp(14), dp(12), dp(14), dp(12));
                    LinearLayout.LayoutParams layoutParams5 = new LinearLayout.LayoutParams(-1, -2);
                    layoutParams5.bottomMargin = dp(10);
                    linearLayout9.setLayoutParams(layoutParams5);
                    LinearLayout linearLayout10 = new LinearLayout(this);
                    linearLayout10.setOrientation(1);
                    linearLayout10.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
                    TextView textView10 = new TextView(this);
                    textView10.setText("⚡ " + optJSONObject3.optString("nome") + " " + optJSONObject3.optString("dosagem"));
                    textView10.setTextColor(this.cTextMain);
                    textView10.setTextSize(sp(14.0f));
                    textView10.setTypeface(null, 1);
                    linearLayout10.addView(textView10);
                    TextView textView11 = new TextView(this);
                    textView11.setText(optJSONObject3.optString("instrucoes"));
                    textView11.setTextColor(this.cTextMuted);
                    textView11.setTextSize(sp(12.0f));
                    linearLayout10.addView(textView11);
                    linearLayout9.addView(linearLayout10);
                    TextView textView12 = new TextView(this);
                    textView12.setText("Registrar Uso");
                    textView12.setTextColor(this.cPurple);
                    textView12.setBackground(shape(this.cPurpleBg, 10, 0, 0));
                    textView12.setTypeface(null, 1);
                    textView12.setTextSize(sp(12.0f));
                    textView12.setPadding(dp(12), dp(8), dp(12), dp(8));
                    textView12.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda24
                        @Override // android.view.View.OnClickListener
                        public final void onClick(View view) {
                            MainActivity.this.m9lambda$buildHomeTab$7$commedicarepatientMainActivity(optJSONObject3, view);
                        }
                    });
                    linearLayout9.addView(textView12);
                    linearLayout.addView(linearLayout9);
                }
            } else {
                str4 = str14;
                str5 = str13;
            }
            i12++;
            str13 = str5;
            str14 = str4;
        }
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildHomeTab$4$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m6lambda$buildHomeTab$4$commedicarepatientMainActivity(View view) {
        switchTab("meds");
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildHomeTab$5$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m7lambda$buildHomeTab$5$commedicarepatientMainActivity(JSONObject jSONObject, String str, String str2, View view) {
        registerDose(jSONObject, str, str2, "tomado");
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildHomeTab$6$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m8lambda$buildHomeTab$6$commedicarepatientMainActivity(JSONObject jSONObject, String str, String str2, View view) {
        registerDose(jSONObject, str, str2, "pulado");
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildHomeTab$7$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m9lambda$buildHomeTab$7$commedicarepatientMainActivity(JSONObject jSONObject, View view) {
        registerDose(jSONObject, todayIso(), new SimpleDateFormat("HH:mm", Locale.US).format(new Date()), "tomado");
    }

    private View buildHeroKpi(String str, String str2) {
        LinearLayout linearLayout = new LinearLayout(this);
        linearLayout.setOrientation(1);
        linearLayout.setBackground(shape(Color.parseColor("#26FFFFFF"), 14, 0, 0));
        linearLayout.setPadding(dp(10), dp(10), dp(10), dp(10));
        LinearLayout.LayoutParams layoutParams = new LinearLayout.LayoutParams(0, -2, 1.0f);
        layoutParams.rightMargin = dp(6);
        linearLayout.setLayoutParams(layoutParams);
        TextView textView = new TextView(this);
        textView.setText(str2);
        textView.setTextColor(-1);
        textView.setTextSize(sp(18.0f));
        textView.setTypeface(null, 1);
        linearLayout.addView(textView);
        TextView textView2 = new TextView(this);
        textView2.setText(str);
        textView2.setTextColor(Color.parseColor("#E6FFFA"));
        textView2.setTextSize(sp(11.0f));
        linearLayout.addView(textView2);
        return linearLayout;
    }

    private void buildMedsTab(LinearLayout linearLayout) {
        String str;
        String str2;
        LinearLayout linearLayout2 = new LinearLayout(this);
        char c = 0;
        linearLayout2.setOrientation(0);
        linearLayout2.setGravity(16);
        LinearLayout.LayoutParams layoutParams = new LinearLayout.LayoutParams(-1, -2);
        layoutParams.bottomMargin = dp(12);
        linearLayout2.setLayoutParams(layoutParams);
        TextView textView = new TextView(this);
        textView.setText("Meus Medicamentos");
        textView.setTextColor(this.cTextMain);
        textView.setTextSize(sp(20.0f));
        char c2 = 1;
        textView.setTypeface(null, 1);
        textView.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        linearLayout2.addView(textView);
        TextView textView2 = new TextView(this);
        textView2.setText("+ Novo Remédio");
        textView2.setTextColor(-1);
        textView2.setBackground(shape(this.cPrimary, 12, 0, 0));
        textView2.setTypeface(null, 1);
        float f = 12.0f;
        textView2.setTextSize(sp(12.0f));
        textView2.setPadding(dp(14), dp(9), dp(14), dp(9));
        textView2.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda3
            @Override // android.view.View.OnClickListener
            public final void onClick(View view) {
                MainActivity.this.m14lambda$buildMedsTab$8$commedicarepatientMainActivity(view);
            }
        });
        linearLayout2.addView(textView2);
        linearLayout.addView(linearLayout2);
        HorizontalScrollView horizontalScrollView = new HorizontalScrollView(this);
        horizontalScrollView.setHorizontalScrollBarEnabled(false);
        LinearLayout linearLayout3 = new LinearLayout(this);
        linearLayout3.setOrientation(0);
        linearLayout3.setPadding(0, 0, 0, dp(12));
        int i = 5;
        String str3 = "continuo";
        String str4 = "temporario";
        String[][] strArr = {new String[]{"todos", "Todos"}, new String[]{"continuo", "Uso Contínuo"}, new String[]{"temporario", "Temporários"}, new String[]{"sos", "SOS (Se Necessário)"}, new String[]{"baixo", "Estoque Baixo"}};
        int i2 = 0;
        while (i2 < i) {
            final String[] strArr2 = strArr[i2];
            boolean equals = strArr2[c].equals(this.medFilter);
            TextView textView3 = new TextView(this);
            textView3.setText(strArr2[c2]);
            textView3.setTextSize(sp(f));
            textView3.setTypeface(null, equals ? 1 : 0);
            textView3.setTextColor(equals ? -1 : this.cTextMuted);
            textView3.setBackground(shape(equals ? this.cPrimary : this.cSurface, 18, this.cBorder, !equals ? 1 : 0));
            textView3.setPadding(dp(14), dp(8), dp(14), dp(8));
            LinearLayout.LayoutParams layoutParams2 = new LinearLayout.LayoutParams(-2, -2);
            layoutParams2.rightMargin = dp(8);
            textView3.setLayoutParams(layoutParams2);
            textView3.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda4
                @Override // android.view.View.OnClickListener
                public final void onClick(View view) {
                    MainActivity.this.m15lambda$buildMedsTab$9$commedicarepatientMainActivity(strArr2, view);
                }
            });
            linearLayout3.addView(textView3);
            i2++;
            strArr = strArr;
            c = 0;
            i = 5;
            c2 = 1;
            f = 12.0f;
        }
        horizontalScrollView.addView(linearLayout3);
        linearLayout.addView(horizontalScrollView);
        int i3 = 0;
        while (i3 < this.meds.length()) {
            final int medIndex = i3;
            final JSONObject optJSONObject = this.meds.optJSONObject(i3);
            if (optJSONObject == null) {
                str = str4;
                str2 = str3;
            } else {
                String optString = optJSONObject.optString("tipo_uso", str3);
                final int optInt = optJSONObject.optInt("estoque_atual", 0);
                int optInt2 = optJSONObject.optInt("estoque_minimo", 5);
                if (str3.equals(this.medFilter) && !str3.equals(optString)) {
                    str = str4;
                    str2 = str3;
                } else if (str4.equals(this.medFilter) && !str4.equals(optString)) {
                    str = str4;
                    str2 = str3;
                } else if ("sos".equals(this.medFilter) && !"sos".equals(optString)) {
                    str = str4;
                    str2 = str3;
                } else if (!"baixo".equals(this.medFilter) || optInt <= optInt2) {
                    LinearLayout linearLayout4 = new LinearLayout(this);
                    linearLayout4.setOrientation(1);
                    linearLayout4.setBackground(shape(this.cSurface, 18, this.cBorder, 1));
                    str = str4;
                    linearLayout4.setPadding(dp(16), dp(16), dp(16), dp(16));
                    LinearLayout.LayoutParams layoutParams3 = new LinearLayout.LayoutParams(-1, -2);
                    layoutParams3.bottomMargin = dp(12);
                    linearLayout4.setLayoutParams(layoutParams3);
                    LinearLayout linearLayout5 = new LinearLayout(this);
                    linearLayout5.setOrientation(0);
                    linearLayout5.setGravity(16);
                    TextView textView4 = new TextView(this);
                    textView4.setText("💊 " + optJSONObject.optString("nome") + " " + optJSONObject.optString("dosagem"));
                    textView4.setTextColor(this.cTextMain);
                    textView4.setTextSize(sp(16.0f));
                    textView4.setTypeface(null, 1);
                    str2 = str3;
                    textView4.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
                    linearLayout5.addView(textView4);
                    TextView textView5 = new TextView(this);
                    textView5.setText(optString.toUpperCase(Locale.ROOT));
                    textView5.setTextSize(sp(10.0f));
                    textView5.setTypeface(null, 1);
                    textView5.setTextColor("sos".equals(optString) ? this.cPurple : this.cPrimary);
                    textView5.setBackground(shape("sos".equals(optString) ? this.cPurpleBg : this.cPrimaryLight, 10, 0, 0));
                    textView5.setPadding(dp(8), dp(4), dp(8), dp(4));
                    linearLayout5.addView(textView5);
                    linearLayout4.addView(linearLayout5);
                    TextView textView6 = new TextView(this);
                    textView6.setText(optJSONObject.optString("forma") + " • " + optJSONObject.optString("frequencia") + "\nInstruções: " + optJSONObject.optString("instrucoes"));
                    textView6.setTextColor(this.cTextMuted);
                    textView6.setTextSize(sp(12.0f));
                    textView6.setPadding(0, dp(6), 0, dp(10));
                    linearLayout4.addView(textView6);
                    LinearLayout linearLayout6 = new LinearLayout(this);
                    linearLayout6.setOrientation(0);
                    linearLayout6.setGravity(16);
                    linearLayout6.setBackground(shape(optInt <= optInt2 ? this.cWarningBg : this.cSurfaceHover, 12, 0, 0));
                    linearLayout6.setPadding(dp(12), dp(8), dp(12), dp(8));
                    TextView textView7 = new TextView(this);
                    textView7.setText("📦 Estoque: " + optInt + " unid. (Mín: " + optInt2 + ")");
                    textView7.setTextColor(optInt <= optInt2 ? this.cDanger : this.cTextMain);
                    textView7.setTextSize(sp(12.0f));
                    textView7.setTypeface(null, 1);
                    textView7.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
                    linearLayout6.addView(textView7);
                    TextView textView8 = new TextView(this);
                    textView8.setText("+ Repor");
                    textView8.setTextColor(this.cPrimary);
                    textView8.setTypeface(null, 1);
                    textView8.setTextSize(sp(12.0f));
                    textView8.setPadding(dp(10), dp(4), dp(10), dp(4));
                    textView8.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda5
                        @Override // android.view.View.OnClickListener
                        public final void onClick(View view) {
                            MainActivity.this.m11lambda$buildMedsTab$10$commedicarepatientMainActivity(optJSONObject, optInt, view);
                        }
                    });
                    linearLayout6.addView(textView8);
                    linearLayout4.addView(linearLayout6);
                    LinearLayout linearLayout7 = new LinearLayout(this);
                    linearLayout7.setOrientation(0);
                    linearLayout7.setPadding(0, dp(10), 0, 0);
                    TextView textView9 = new TextView(this);
                    textView9.setText("✏️ Editar");
                    textView9.setTextColor(this.cPrimary);
                    textView9.setTextSize(sp(12.0f));
                    textView9.setTypeface(null, 1);
                    textView9.setPadding(dp(8), dp(6), dp(16), dp(6));
                    textView9.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda6
                        @Override // android.view.View.OnClickListener
                        public final void onClick(View view) {
                            MainActivity.this.m12lambda$buildMedsTab$11$commedicarepatientMainActivity(optJSONObject, medIndex, view);
                        }
                    });
                    linearLayout7.addView(textView9);
                    TextView textView10 = new TextView(this);
                    textView10.setText("🗑️ Excluir");
                    textView10.setTextColor(this.cDanger);
                    textView10.setTextSize(sp(12.0f));
                    textView10.setTypeface(null, 1);
                    textView10.setPadding(dp(8), dp(6), dp(8), dp(6));
                    textView10.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda7
                        @Override // android.view.View.OnClickListener
                        public final void onClick(View view) {
                            MainActivity.this.m13lambda$buildMedsTab$12$commedicarepatientMainActivity(medIndex, view);
                        }
                    });
                    linearLayout7.addView(textView10);
                    linearLayout4.addView(linearLayout7);
                    linearLayout.addView(linearLayout4);
                } else {
                    str = str4;
                    str2 = str3;
                }
            }
            i3++;
            str4 = str;
            str3 = str2;
        }
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildMedsTab$8$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m14lambda$buildMedsTab$8$commedicarepatientMainActivity(View view) {
        showMedModal(null, -1);
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildMedsTab$9$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m15lambda$buildMedsTab$9$commedicarepatientMainActivity(String[] strArr, View view) {
        this.medFilter = strArr[0];
        render();
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildMedsTab$10$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m11lambda$buildMedsTab$10$commedicarepatientMainActivity(JSONObject jSONObject, int i, View view) {
        try {
            jSONObject.put("estoque_atual", i + 30);
            this.stockMovements.put(new JSONObject().put("id", "sm-" + System.currentTimeMillis()).put("med_nome", jSONObject.optString("nome")).put("tipo", "entrada").put("qtd", 30).put("data", todayIso()).put("motivo", "Reposição manual (+30)"));
            saveAll();
            render();
        } catch (Exception e) {
        }
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildMedsTab$11$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m12lambda$buildMedsTab$11$commedicarepatientMainActivity(JSONObject jSONObject, int i, View view) {
        showMedModal(jSONObject, i);
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildMedsTab$12$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m13lambda$buildMedsTab$12$commedicarepatientMainActivity(int i, View view) {
        this.meds.remove(i);
        saveAll();
        render();
    }

    private void showMedModal(final JSONObject jSONObject, final int i) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        ScrollView scrollView = new ScrollView(this);
        LinearLayout linearLayout = new LinearLayout(this);
        linearLayout.setOrientation(1);
        linearLayout.setPadding(dp(20), dp(20), dp(20), dp(20));
        linearLayout.setBackgroundColor(this.cSurface);
        TextView textView = new TextView(this);
        textView.setText(jSONObject == null ? "Cadastrar Medicamento" : "Editar Medicamento");
        textView.setTextColor(this.cTextMain);
        textView.setTextSize(sp(18.0f));
        textView.setTypeface(null, 1);
        textView.setPadding(0, 0, 0, dp(12));
        linearLayout.addView(textView);
        String str = EMBEDDED_API_KEY;
        final EditText createInput = createInput("Nome do Medicamento", jSONObject != null ? jSONObject.optString("nome") : EMBEDDED_API_KEY);
        final EditText createInput2 = createInput("Dosagem (ex: 50mg)", jSONObject != null ? jSONObject.optString("dosagem") : EMBEDDED_API_KEY);
        final EditText createInput3 = createInput("Forma (Comprimido, Cápsula, Gotas)", jSONObject != null ? jSONObject.optString("forma", "Comprimido") : "Comprimido");
        final EditText createInput4 = createInput("Tipo de uso (continuo, temporario, sos)", jSONObject != null ? jSONObject.optString("tipo_uso", "continuo") : "continuo");
        final EditText createInput5 = createInput("Horários separados por vírgula (ex: 08:00,20:00)", (jSONObject == null || jSONObject.optJSONArray("horarios") == null) ? "08:00,20:00" : joinArray(jSONObject.optJSONArray("horarios")));
        final EditText createInput6 = createInput("Estoque Atual", String.valueOf(jSONObject != null ? jSONObject.optInt("estoque_atual", 30) : 30));
        createInput6.setInputType(2);
        final EditText createInput7 = createInput("Estoque Mínimo (Alerta)", String.valueOf(jSONObject != null ? jSONObject.optInt("estoque_minimo", 10) : 10));
        createInput7.setInputType(2);
        if (jSONObject != null) {
            str = jSONObject.optString("instrucoes");
        }
        final EditText createInput8 = createInput("Instruções / Observações", str);
        linearLayout.addView(createInput);
        linearLayout.addView(createInput2);
        linearLayout.addView(createInput3);
        linearLayout.addView(createInput4);
        linearLayout.addView(createInput5);
        linearLayout.addView(createInput6);
        linearLayout.addView(createInput7);
        linearLayout.addView(createInput8);
        scrollView.addView(linearLayout);
        builder.setView(scrollView);
        builder.setPositiveButton("Salvar", new DialogInterface.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda11
            @Override // android.content.DialogInterface.OnClickListener
            public final void onClick(DialogInterface dialogInterface, int i2) {
                MainActivity.this.m20lambda$showMedModal$13$commedicarepatientMainActivity(jSONObject, createInput, createInput2, createInput3, createInput4, createInput5, createInput6, createInput7, createInput8, i, dialogInterface, i2);
            }
        });
        builder.setNegativeButton("Cancelar", (DialogInterface.OnClickListener) null);
        builder.show();
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$showMedModal$13$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m20lambda$showMedModal$13$commedicarepatientMainActivity(JSONObject jSONObject, EditText editText, EditText editText2, EditText editText3, EditText editText4, EditText editText5, EditText editText6, EditText editText7, EditText editText8, int i, DialogInterface dialogInterface, int i2) {
        try {
            JSONObject jSONObject2;
            if (jSONObject != null) {
                jSONObject2 = jSONObject;
            } else {
                jSONObject2 = new JSONObject();
            }
            if (jSONObject == null) {
                jSONObject2.put("id", "med-" + System.currentTimeMillis());
            }
            jSONObject2.put("nome", editText.getText().toString().trim());
            jSONObject2.put("dosagem", editText2.getText().toString().trim());
            jSONObject2.put("forma", editText3.getText().toString().trim());
            jSONObject2.put("tipo_uso", editText4.getText().toString().trim().toLowerCase(Locale.ROOT));
            JSONArray jSONArray = new JSONArray();
            for (String str : editText5.getText().toString().split(",")) {
                if (!str.trim().isEmpty()) {
                    jSONArray.put(str.trim());
                }
            }
            jSONObject2.put("horarios", jSONArray);
            jSONObject2.put("frequencia", jSONArray.length() + "x ao dia");
            jSONObject2.put("estoque_atual", Integer.parseInt(editText6.getText().toString().trim().isEmpty() ? "0" : editText6.getText().toString().trim()));
            jSONObject2.put("estoque_minimo", Integer.parseInt(editText7.getText().toString().trim().isEmpty() ? "5" : editText7.getText().toString().trim()));
            jSONObject2.put("instrucoes", editText8.getText().toString().trim());
            if (i >= 0) {
                this.meds.put(i, jSONObject2);
            } else {
                this.meds.put(jSONObject2);
            }
            saveAll();
            render();
        } catch (Exception e) {}
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

    private void buildCalendarTab(LinearLayout linearLayout) {
        linearLayout.addView(sectionHeader("Agenda de Saúde & Histórico", "Consultas, exames, doses e diário do dia"));
        LinearLayout linearLayout2 = new LinearLayout(this);
        linearLayout2.setOrientation(0);
        int i = 16;
        linearLayout2.setGravity(16);
        linearLayout2.setPadding(0, 0, 0, dp(14));
        TextView textView = new TextView(this);
        textView.setText("📅 Data Selecionada: " + this.selectedCalDate + " (Alterar)");
        textView.setTextColor(this.cPrimary);
        textView.setTypeface(null, 1);
        textView.setTextSize(sp(13.0f));
        textView.setBackground(shape(this.cPrimaryLight, 12, 0, 0));
        textView.setPadding(dp(14), dp(10), dp(14), dp(10));
        textView.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1.0f));
        textView.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda13
            @Override // android.view.View.OnClickListener
            public final void onClick(View view) {
                MainActivity.this.m2lambda$buildCalendarTab$15$commedicarepatientMainActivity(view);
            }
        });
        linearLayout2.addView(textView);
        linearLayout.addView(linearLayout2);
        int i2 = 0;
        while (i2 < this.events.length()) {
            JSONObject optJSONObject = this.events.optJSONObject(i2);
            if (optJSONObject != null) {
                LinearLayout linearLayout3 = new LinearLayout(this);
                linearLayout3.setOrientation(1);
                linearLayout3.setBackground(shape(this.cSurface, i, this.cBorder, 1));
                linearLayout3.setPadding(dp(14), dp(14), dp(14), dp(14));
                LinearLayout.LayoutParams layoutParams = new LinearLayout.LayoutParams(-1, -2);
                layoutParams.bottomMargin = dp(10);
                linearLayout3.setLayoutParams(layoutParams);
                TextView textView2 = new TextView(this);
                textView2.setText("🏥 " + optJSONObject.optString("titulo"));
                textView2.setTextColor(this.cTextMain);
                textView2.setTextSize(sp(15.0f));
                textView2.setTypeface(null, 1);
                linearLayout3.addView(textView2);
                TextView textView3 = new TextView(this);
                textView3.setText(optJSONObject.optString("data") + " às " + optJSONObject.optString("hora") + " • " + optJSONObject.optString("local") + "\n" + optJSONObject.optString("notas"));
                textView3.setTextColor(this.cTextMuted);
                textView3.setTextSize(sp(12.0f));
                textView3.setPadding(0, dp(4), 0, 0);
                linearLayout3.addView(textView3);
                linearLayout.addView(linearLayout3);
            }
            i2++;
            i = 16;
        }
        linearLayout.addView(sectionHeader("Diário Clínico (" + this.selectedCalDate + ")", "Anotações de pressão, glicemia ou sintomas"));
        final EditText createInput = createInput("Escreva observações do dia...", this.calNotes.optString(this.selectedCalDate, EMBEDDED_API_KEY));
        linearLayout.addView(createInput);
        TextView createButton = createButton("Salvar Anotação do Dia", this.cPrimary, -1);
        createButton.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda14
            @Override // android.view.View.OnClickListener
            public final void onClick(View view) {
                MainActivity.this.m3lambda$buildCalendarTab$16$commedicarepatientMainActivity(createInput, view);
            }
        });
        linearLayout.addView(createButton);
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildCalendarTab$15$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m2lambda$buildCalendarTab$15$commedicarepatientMainActivity(View view) {
        Calendar calendar = Calendar.getInstance();
        new DatePickerDialog(this, new DatePickerDialog.OnDateSetListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda16
            @Override // android.app.DatePickerDialog.OnDateSetListener
            public final void onDateSet(DatePicker datePicker, int i, int i2, int i3) {
                MainActivity.this.m1lambda$buildCalendarTab$14$commedicarepatientMainActivity(datePicker, i, i2, i3);
            }
        }, calendar.get(1), calendar.get(2), calendar.get(5)).show();
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildCalendarTab$14$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m1lambda$buildCalendarTab$14$commedicarepatientMainActivity(DatePicker datePicker, int i, int i2, int i3) {
        this.selectedCalDate = String.format(Locale.US, "%04d-%02d-%02d", Integer.valueOf(i), Integer.valueOf(i2 + 1), Integer.valueOf(i3));
        render();
    }

    /* JADX INFO: Access modifiers changed from: package-private */
    /* renamed from: lambda$buildCalendarTab$16$com-medicare-patient-MainActivity, reason: not valid java name */
    public /* synthetic */ void m3lambda$buildCalendarTab$16$commedicarepatientMainActivity(EditText editText, View view) {
        try {
            this.calNotes.put(this.selectedCalDate, editText.getText().toString().trim());
            saveAll();
            Toast.makeText(this, "Anotação salva!", 0).show();
        } catch (Exception e) {
        }
    }

    private void buildAiTab(LinearLayout linearLayout) {
        linearLayout.addView(sectionHeader("Assistente Farmacêutico MediCare", "Verificador de interações e orientações da sua receita"));
        LinearLayout linearLayout2 = new LinearLayout(this);
        linearLayout2.setOrientation(1);
        linearLayout2.setBackground(shape(this.cSurface, 18, this.cBorder, 1));
        linearLayout2.setPadding(dp(16), dp(16), dp(16), dp(16));
        TextView textView = new TextView(this);
        textView.setText("🔍 Análise Automática da Sua Prescrição Ativa");
        textView.setTextColor(this.cTextMain);
        textView.setTextSize(sp(15.0f));
        textView.setTypeface(null, 1);
        linearLayout2.addView(textView);
        TextView textView2 = new TextView(this);
        textView2.setText("• Losartana 50mg + Metformina 850mg: Sem interação adversa grave. Manter hidratação adequada.\n• Alergia Registrada (Penicilina): Atenção! Amoxicilina pertence ao grupo das penicilinas — confirme imediatamente com seu médico.\n• Horários otimizados: 08:00, 12:30, 20:00 e 21:00 sem conflito gástrico.");
        textView2.setTextColor(this.cTextMuted);
        textView2.setTextSize(sp(13.0f));
        textView2.setPadding(0, dp(8), 0, 0);
        linearLayout2.addView(textView2);
        linearLayout.addView(linearLayout2);
    }

    private void buildProfileTab(LinearLayout linearLayout) {
        LinearLayout linearLayout2 = new LinearLayout(this);
        linearLayout2.setOrientation(1);
        linearLayout2.setBackground(shape(this.cSurface, 20, this.cBorder, 1));
        linearLayout2.setPadding(dp(18), dp(18), dp(18), dp(18));
        LinearLayout.LayoutParams layoutParams = new LinearLayout.LayoutParams(-1, -2);
        layoutParams.bottomMargin = dp(16);
        linearLayout2.setLayoutParams(layoutParams);
        TextView textView = new TextView(this);
        textView.setText(this.profile.optString("nome", "Maria Silva"));
        textView.setTextColor(this.cTextMain);
        textView.setTextSize(sp(20.0f));
        textView.setTypeface(null, 1);
        linearLayout2.addView(textView);
        TextView textView2 = new TextView(this);
        textView2.setText("Tipo Sanguíneo: " + this.profile.optString("tipo_sanguineo", "O+") + " • Peso: " + this.profile.optString("peso", "68") + "kg • Altura: " + this.profile.optString("altura", "162") + "cm\nCPF: " + this.profile.optString("cpf") + " • Tel: " + this.profile.optString("telefone"));
        textView2.setTextColor(this.cTextMuted);
        textView2.setTextSize(sp(12.0f));
        textView2.setPadding(0, dp(6), 0, 0);
        linearLayout2.addView(textView2);
        linearLayout.addView(linearLayout2);
        LinearLayout linearLayout3 = new LinearLayout(this);
        linearLayout3.setOrientation(1);
        linearLayout3.setBackground(shape(this.cPrimaryLight, 18, this.cPrimary, 1));
        linearLayout3.setPadding(dp(16), dp(16), dp(16), dp(16));
        LinearLayout.LayoutParams layoutParams2 = new LinearLayout.LayoutParams(-1, -2);
        layoutParams2.bottomMargin = dp(14);
        linearLayout3.setLayoutParams(layoutParams2);
        TextView textView3 = new TextView(this);
        textView3.setText("☁️ Sincronização Automática em Nuvem");
        textView3.setTextColor(this.cPrimaryHover);
        textView3.setTextSize(sp(15.0f));
        textView3.setTypeface(null, 1);
        linearLayout3.addView(textView3);
        TextView textView4 = new TextView(this);
        textView4.setText("Status: " + this.lastSyncTimestamp + "\nToque aqui caso queira forçar uma sincronização imediata.");
        textView4.setTextColor(this.cTextMain);
        textView4.setTextSize(sp(12.0f));
        textView4.setPadding(0, dp(4), 0, 0);
        linearLayout3.addView(textView4);
        linearLayout3.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda17
            @Override // android.view.View.OnClickListener
            public final void onClick(View view) {
                MainActivity.this.m16lambda$buildProfileTab$17$commedicarepatientMainActivity(view);
            }
        });
        linearLayout.addView(linearLayout3);
        LinearLayout.LayoutParams layoutParams3 = new LinearLayout.LayoutParams(-1, -2);
        layoutParams3.bottomMargin = dp(10);
        TextView createButton = createButton(this.isDarkMode ? "☀️ Mudar para Tema Claro" : "🌙 Mudar para Tema Escuro", this.cSurface, this.cTextMain);
        createButton.setLayoutParams(layoutParams3);
        createButton.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda18
            @Override // android.view.View.OnClickListener
            public final void onClick(View view) {
                MainActivity.this.m17lambda$buildProfileTab$18$commedicarepatientMainActivity(view);
            }
        });
        linearLayout.addView(createButton);
        TextView createButton2 = createButton(this.isAccessibilityMode ? "🔤 Modo Acessibilidade: ATIVO (Fontes Grandes)" : "🔤 Ativar Modo Acessibilidade (Idosos)", this.cSurface, this.cTextMain);
        createButton2.setLayoutParams(layoutParams3);
        createButton2.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda19
            @Override // android.view.View.OnClickListener
            public final void onClick(View view) {
                MainActivity.this.m18lambda$buildProfileTab$19$commedicarepatientMainActivity(view);
            }
        });
        linearLayout.addView(createButton2);
        TextView createButton3 = createButton("Sair da Conta", this.cDangerBg, this.cDanger);
        createButton3.setOnClickListener(new View.OnClickListener() { // from class: com.medicare.patient.MainActivity$$ExternalSyntheticLambda20
            @Override // android.view.View.OnClickListener
            public final void onClick(View view) {
                MainActivity.this.m19lambda$buildProfileTab$20$commedicarepatientMainActivity(view);
            }
        });
        linearLayout.addView(createButton3);
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
