package br.com.medicare.paciente

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import br.com.medicare.paciente.notifications.DoseAlarmScheduler
import br.com.medicare.paciente.ui.components.MediCareBottomNav
import br.com.medicare.paciente.ui.components.PatientTab
import br.com.medicare.paciente.ui.components.QuickConfirmDialog
import br.com.medicare.paciente.ui.screens.*
import br.com.medicare.paciente.ui.theme.MediCareTheme
import br.com.medicare.paciente.ui.viewmodel.MediCareViewModel
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    private val viewModel: MediCareViewModel by viewModels()
    private var sysNotifGrantedState = mutableStateOf(true)
    private var notifPromptDismissedState = mutableStateOf(false)

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        sysNotifGrantedState.value = granted && NotificationManagerCompat.from(this).areNotificationsEnabled()
        if (granted) {
            notifPromptDismissedState.value = true
            viewModel.uiState.value.user?.let { u ->
                if (!u.notificationsEnabled) {
                    viewModel.updateProfile(u.copy(notificationsEnabled = true))
                }
            }
            viewModel.showToast("✓ Notificações ativadas com sucesso!")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        refreshSystemNotificationState()
        requestNotificationPermissionIfNeeded()
        handleDeepLinkIntent(intent)

        setContent {
            val state by viewModel.uiState.collectAsState()
            val darkTheme by viewModel.sessionManager.darkTheme.collectAsState()
            val highContrast by viewModel.sessionManager.highContrast.collectAsState()
            val fontScale by viewModel.sessionManager.fontScale.collectAsState()
            val oracleUrl by viewModel.sessionManager.oracleBackendUrl.collectAsState()
            val oracleKey by viewModel.sessionManager.oracleApiKey.collectAsState()
            val lastSyncStatus by viewModel.sessionManager.lastSyncStatus.collectAsState()
            val sysNotifGranted by sysNotifGrantedState
            val notifPromptDismissed by notifPromptDismissedState

            var currentTab by remember { mutableStateOf(PatientTab.HOME) }
            val tabHistory = remember { mutableStateListOf<PatientTab>() }
            var lastBackPressMs by remember { mutableStateOf(0L) }

            val snackbarHostState = remember { SnackbarHostState() }

            fun navigateToTab(target: PatientTab) {
                if (target != currentTab) {
                    tabHistory.removeAll { it == target }
                    tabHistory.add(currentTab)
                    currentTab = target
                }
            }

            // Interceptação global do botão Voltar do Android:
            // 1. Fecha modal rápido de dose se aberto
            // 2. Desempilha o histórico de telas visitadas (volta para a tela anterior com precisão)
            // 3. Volta para o Início (HOME) se estiver em outra aba
            // 4. Na tela inicial, exige confirmação de duplo toque para não fechar o app acidentalmente
            BackHandler(enabled = state.user != null) {
                when {
                    state.selectedDoseForModal != null -> {
                        viewModel.closeDoseModal()
                    }
                    tabHistory.isNotEmpty() -> {
                        currentTab = tabHistory.removeAt(tabHistory.lastIndex)
                    }
                    currentTab != PatientTab.HOME -> {
                        currentTab = PatientTab.HOME
                    }
                    else -> {
                        val now = System.currentTimeMillis()
                        if (now - lastBackPressMs < 2500L) {
                            finish()
                        } else {
                            lastBackPressMs = now
                            viewModel.showToast("Pressione voltar novamente para sair do aplicativo")
                        }
                    }
                }
            }

            LaunchedEffect(state.toastMessage) {
                state.toastMessage?.let { msg ->
                    snackbarHostState.showSnackbar(msg)
                    viewModel.clearToast()
                }
            }

            MediCareTheme(
                darkTheme = darkTheme,
                highContrast = highContrast,
                fontScale = fontScale
            ) {
                if (state.user == null) {
                    PatientAuthScreen(
                        isRemoteConfigured = state.isRemoteConfigured,
                        onLogin = viewModel::login,
                        onRegister = viewModel::register
                    )
                } else {
                    val criticalStockCount = state.medications.count { it.ativo && it.quantidade <= 5 }
                    val userNotifActive = state.user!!.notificationsEnabled && sysNotifGranted

                    Scaffold(
                        snackbarHost = { SnackbarHost(snackbarHostState) },
                        bottomBar = {
                            MediCareBottomNav(
                                currentTab = currentTab,
                                criticalStockCount = criticalStockCount,
                                onSelectTab = { navigateToTab(it) }
                            )
                        }
                    ) { innerPadding ->
                        Box(modifier = Modifier.padding(innerPadding).fillMaxSize()) {
                            when (currentTab) {
                                PatientTab.HOME -> PatientHomeScreen(
                                    state = state,
                                    onSelectDose = { viewModel.openDoseByDeepLink(it.id) },
                                    onConfirmDoseDirect = viewModel::confirmDose,
                                    onSnoozeDose = viewModel::snoozeDose,
                                    onUndoDose = viewModel::undoDose,
                                    onOpenStats = { navigateToTab(PatientTab.STATS) }
                                )
                                PatientTab.MEDS -> PatientMedsScreen(
                                    state = state,
                                    onSaveMedication = viewModel::saveMedicationFull,
                                    onRepeatTreatment = viewModel::repeatTreatment,
                                    onDeleteMedication = viewModel::deleteMedication,
                                    onRegisterSosUse = viewModel::registerSosUse,
                                    onRecordStockMovement = viewModel::recordStockMovement
                                )
                                PatientTab.CALENDAR -> PatientCalendarScreen(
                                    state = state,
                                    onSaveEvent = viewModel::saveHealthEvent,
                                    onDeleteEvent = viewModel::deleteHealthEvent,
                                    onSaveNote = viewModel::saveCalendarNote,
                                    onDeleteNote = viewModel::deleteCalendarNote,
                                    onSaveDoseObs = viewModel::saveDoseObservation,
                                    onConfirmRetroactive = viewModel::confirmDoseRetroactive
                                )
                                PatientTab.AI -> PatientAiScreen(
                                    state = state,
                                    onSendQuestion = viewModel::askAi
                                )
                                PatientTab.PROFILE -> PatientProfileScreen(
                                    state = state,
                                    darkTheme = darkTheme,
                                    highContrast = highContrast,
                                    fontScale = fontScale,
                                    oracleBackendUrl = oracleUrl,
                                    oracleApiKey = oracleKey,
                                    lastSyncStatus = lastSyncStatus,
                                    onSaveOracleConfig = { url, key ->
                                        viewModel.sessionManager.saveOracleBackendConfig(url, key)
                                        viewModel.showToast("🌐 Servidor Oracle salvo com sucesso!")
                                    },
                                    onSyncOracleNow = viewModel::syncWithOracleBackend,
                                    onToggleDark = viewModel.sessionManager::setDarkTheme,
                                    onToggleHighContrast = viewModel.sessionManager::setHighContrast,
                                    onChangeFontScale = viewModel.sessionManager::setFontScale,
                                    onUpdateProfile = viewModel::updateProfile,
                                    onChangeRoleWithPin = viewModel::changeRoleWithPin,
                                    onSaveMedication = viewModel::saveMedicationFull,
                                    onSaveAllergy = viewModel::saveAllergy,
                                    onDeleteAllergy = viewModel::deleteAllergy,
                                    onSaveCondition = viewModel::saveHealthCondition,
                                    onDeleteCondition = viewModel::deleteHealthCondition,
                                    onSaveContact = viewModel::saveEmergencyContact,
                                    onDeleteContact = viewModel::deleteEmergencyContact,
                                    onSaveProfessional = viewModel::saveHealthcareProfessional,
                                    onDeleteProfessional = viewModel::deleteHealthcareProfessional,
                                    onCreateCaregiverInvite = viewModel::createCaregiverInvite,
                                    onUpdateCaregiver = viewModel::updateCaregiverRelationship,
                                    onLogout = viewModel::logout
                                )
                                PatientTab.STATS -> PatientStatsScreen(
                                    state = state,
                                    onBackToHome = {
                                        if (tabHistory.isNotEmpty()) {
                                            currentTab = tabHistory.removeAt(tabHistory.lastIndex)
                                        } else {
                                            currentTab = PatientTab.HOME
                                        }
                                    }
                                )
                                PatientTab.STOCK_HISTORY -> PatientStatsScreen(
                                    state = state,
                                    onBackToHome = {
                                        if (tabHistory.isNotEmpty()) {
                                            currentTab = tabHistory.removeAt(tabHistory.lastIndex)
                                        } else {
                                            currentTab = PatientTab.PROFILE
                                        }
                                    }
                                )
                            }
                        }
                    }

                    if (!userNotifActive && !notifPromptDismissed) {
                        AlertDialog(
                            onDismissRequest = { notifPromptDismissedState.value = true },
                            title = { Text("🔔 Ativar Notificações") },
                            text = {
                                Text(
                                    if (sysNotifGranted)
                                        "As notificações de lembretes estão desativadas. Ative agora para receber alertas nos horários exatos dos seus medicamentos e não esquecer nenhuma dose."
                                    else
                                        "Permita as notificações do MediCare no seu celular para receber alertas sonoros nos horários dos seus medicamentos e avisos de estoque."
                                )
                            },
                            confirmButton = {
                                Button(
                                    onClick = {
                                        notifPromptDismissedState.value = true
                                        viewModel.updateProfile(state.user!!.copy(notificationsEnabled = true))
                                        if (!sysNotifGranted) {
                                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                                                ContextCompat.checkSelfPermission(
                                                    this@MainActivity,
                                                    Manifest.permission.POST_NOTIFICATIONS
                                                ) != PackageManager.PERMISSION_GRANTED
                                            ) {
                                                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                            } else {
                                                openSystemNotificationSettings()
                                            }
                                        } else {
                                            viewModel.showToast("✓ Notificações ativadas com sucesso!")
                                        }
                                    }
                                ) {
                                    Text("🔔 Permitir notificações")
                                }
                            },
                            dismissButton = {
                                TextButton(onClick = { notifPromptDismissedState.value = true }) {
                                    Text("Agora não")
                                }
                            }
                        )
                    }

                    state.selectedDoseForModal?.let { selectedDose ->
                        QuickConfirmDialog(
                            dose = selectedDose,
                            onConfirm = viewModel::confirmDose,
                            onSnooze15Min = viewModel::snoozeDose,
                            onUndo = viewModel::undoDose,
                            onDismiss = viewModel::closeDoseModal
                        )
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refreshSystemNotificationState()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLinkIntent(intent)
    }

    private fun handleDeepLinkIntent(intent: Intent?) {
        if (intent == null) return
        val extraDoseId = intent.getStringExtra(DoseAlarmScheduler.EXTRA_DOSE_ID)
        if (!extraDoseId.isNullOrBlank()) {
            viewModel.openDoseByDeepLink(extraDoseId)
            return
        }
        val uri = intent.data ?: return
        if (uri.scheme == "medicare" && uri.host == "dose") {
            val doseId = uri.lastPathSegment
            if (!doseId.isNullOrBlank()) {
                viewModel.openDoseByDeepLink(doseId)
            }
        }
    }

    private fun refreshSystemNotificationState() {
        val runtimeOk = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        sysNotifGrantedState.value = runtimeOk && NotificationManagerCompat.from(this).areNotificationsEnabled()
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val hasPerm = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!hasPerm) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun openSystemNotificationSettings() {
        try {
            val intent = Intent().apply {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    action = Settings.ACTION_APP_NOTIFICATION_SETTINGS
                    putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
                } else {
                    action = Settings.ACTION_APPLICATION_DETAILS_SETTINGS
                    data = Uri.fromParts("package", packageName, null)
                }
            }
            startActivity(intent)
        } catch (_: Exception) {}
    }
}
