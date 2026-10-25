package br.com.medicare.paciente

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import br.com.medicare.paciente.domain.model.DoseStatus
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

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestNotificationPermissionIfNeeded()
        handleDeepLinkIntent(intent)

        setContent {
            val state by viewModel.uiState.collectAsState()
            val darkTheme by viewModel.sessionManager.darkTheme.collectAsState()
            val highContrast by viewModel.sessionManager.highContrast.collectAsState()
            val fontScale by viewModel.sessionManager.fontScale.collectAsState()

            var currentTab by remember { mutableStateOf(PatientTab.HOME) }
            val snackbarHostState = remember { SnackbarHostState() }

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
                    val pendingCount = state.dailyDoses.count { it.status != DoseStatus.CONFIRMED }

                    Scaffold(
                        snackbarHost = { SnackbarHost(snackbarHostState) },
                        bottomBar = {
                            MediCareBottomNav(
                                currentTab = currentTab,
                                pendingDosesCount = pendingCount,
                                onSelectTab = { currentTab = it }
                            )
                        }
                    ) { innerPadding ->
                        Box(modifier = Modifier.padding(innerPadding).fillMaxSize()) {
                            when (currentTab) {
                                PatientTab.HOME -> PatientHomeScreen(
                                    state = state,
                                    onDoseClick = { viewModel.openDoseByDeepLink(it.id) },
                                    onRegisterSos = viewModel::registerSosUse
                                )
                                PatientTab.MEDS -> PatientMedsScreen(
                                    state = state,
                                    onSaveMedication = viewModel::saveMedication,
                                    onDeleteMedication = viewModel::deleteMedication,
                                    onAdjustStock = viewModel::adjustStock
                                )
                                PatientTab.CALENDAR -> PatientCalendarScreen(
                                    state = state,
                                    onAddEvent = viewModel::addHealthEvent
                                )
                                PatientTab.STATS -> PatientStatsScreen(state = state)
                                PatientTab.AI -> PatientAiScreen(
                                    state = state,
                                    onSendQuestion = viewModel::askAi
                                )
                                PatientTab.PROFILE -> PatientProfileScreen(
                                    state = state,
                                    darkTheme = darkTheme,
                                    highContrast = highContrast,
                                    fontScale = fontScale,
                                    onToggleDark = viewModel.sessionManager::setDarkTheme,
                                    onToggleHighContrast = viewModel.sessionManager::setHighContrast,
                                    onChangeFontScale = viewModel.sessionManager::setFontScale,
                                    onLogout = viewModel::logout
                                )
                            }
                        }
                    }

                    // Modal de confirmação rápida (acionado por clique no card ou por Deep Link da notificação)
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
}
