import {
  DEFAULT_CARE_SETTINGS,
  normalizeCareSettings,
  normalizeConfigMode,
  resolveEffectiveCareSettings,
  formatMinutesLabelPt,
  shouldPatientRequireCaregiverApproval,
} from '@/lib/careSettings';
import {
  checkOverdueDosesForCaregivers,
} from '@/lib/caregiverNotifications';

describe('careSettings helpers', () => {
  test('normalizeCareSettings returns defaults and clamps out-of-range numbers', () => {
    expect(normalizeCareSettings()).toEqual(DEFAULT_CARE_SETTINGS);

    const normalized = normalizeCareSettings({
      overdue_notify_minutes: 9999,
      require_caregiver_confirm: 'false',
      require_confirm_after_missed: '1',
      require_confirm_undo: 0,
      missed_dose_minutes: 10,
      allow_patient_med_edit: false,
      notify_low_stock: 'true',
      low_stock_threshold: 120,
      notify_sos_usage: '0',
    });

    expect(normalized).toEqual({
      overdue_notify_minutes: 720,
      require_caregiver_confirm: false,
      require_confirm_after_missed: true,
      require_confirm_undo: false,
      missed_dose_minutes: 30,
      allow_patient_med_edit: false,
      notify_low_stock: true,
      low_stock_threshold: 50,
      notify_sos_usage: false,
    });
  });

  test('formatMinutesLabelPt formats durations in Portuguese', () => {
    expect(formatMinutesLabelPt(0)).toBe('Desativado');
    expect(formatMinutesLabelPt(15)).toBe('15min');
    expect(formatMinutesLabelPt(60)).toBe('1h');
    expect(formatMinutesLabelPt(90)).toBe('1h30');
    expect(formatMinutesLabelPt(180)).toBe('3h');
  });

  test('shouldPatientRequireCaregiverApproval respects on-time, missed, and undo rules', () => {
    const strictCfg = {
      require_caregiver_confirm: true,
      require_confirm_after_missed: false,
      require_confirm_undo: true,
    };
    expect(shouldPatientRequireCaregiverApproval({ careSettings: strictCfg, actionType: 'confirm', isDoseMissed: false })).toBe(true);
    expect(shouldPatientRequireCaregiverApproval({ careSettings: strictCfg, actionType: 'confirm', isDoseMissed: true })).toBe(true);
    expect(shouldPatientRequireCaregiverApproval({ careSettings: strictCfg, actionType: 'undo' })).toBe(true);

    const assistedCfg = {
      require_caregiver_confirm: false,
      require_confirm_after_missed: true,
      require_confirm_undo: true,
    };
    expect(shouldPatientRequireCaregiverApproval({ careSettings: assistedCfg, actionType: 'confirm', isDoseMissed: false })).toBe(false);
    expect(shouldPatientRequireCaregiverApproval({ careSettings: assistedCfg, actionType: 'confirm', isDoseMissed: true })).toBe(true);
    expect(shouldPatientRequireCaregiverApproval({ careSettings: assistedCfg, actionType: 'undo' })).toBe(true);

    const freeCfg = {
      require_caregiver_confirm: false,
      require_confirm_after_missed: false,
      require_confirm_undo: false,
    };
    expect(shouldPatientRequireCaregiverApproval({ careSettings: freeCfg, actionType: 'confirm', isDoseMissed: false })).toBe(false);
    expect(shouldPatientRequireCaregiverApproval({ careSettings: freeCfg, actionType: 'confirm', isDoseMissed: true })).toBe(false);
    expect(shouldPatientRequireCaregiverApproval({ careSettings: freeCfg, actionType: 'undo' })).toBe(false);
  });
});

describe('checkOverdueDosesForCaregivers with patient_care_settings', () => {
  test('triggers alert using custom 30-minute period and low stock threshold, and skips overdue when period is 0', async () => {
    const fixedNow = new Date('2026-11-19T14:05:00-03:00');
    const schedHora = '13:30';

    const insertedNotifs = [];
    const mockClient = {
      async query(sql, params = []) {
        if (sql.includes('FROM caregiver_relationships cr')) {
          return {
            rowCount: 2,
            rows: [
              { patient_id: 'pat-1', caregiver_id: 'cg-1', patient_name: 'Maria' },
              { patient_id: 'pat-2', caregiver_id: 'cg-1', patient_name: 'João' },
            ],
          };
        }
        if (sql.includes('FROM public.patient_care_settings')) {
          return {
            rowCount: 2,
            rows: [
              {
                patient_id: 'pat-1',
                overdue_notify_minutes: 30,
                notify_low_stock: true,
                low_stock_threshold: 8,
              },
              {
                patient_id: 'pat-2',
                overdue_notify_minutes: 0,
                notify_low_stock: false,
                low_stock_threshold: 5,
              },
            ],
          };
        }
        if (sql.includes('FROM medicamentos')) {
          return {
            rowCount: 2,
            rows: [
              {
                id: 'med-1',
                user_id: 'pat-1',
                nome: 'Losartana',
                dosagem: '50mg',
                unidade: 'comprimidos',
                quantidade: 6,
                horarios: [schedHora],
                dias_semana: [],
                treatment_type: 'continuous',
              },
              {
                id: 'med-2',
                user_id: 'pat-2',
                nome: 'Dipirona',
                dosagem: '500mg',
                unidade: 'comprimidos',
                quantidade: 2,
                horarios: [schedHora],
                dias_semana: [],
                treatment_type: 'continuous',
              },
            ],
          };
        }
        if (sql.includes('FROM notification_logs') || sql.includes('FROM historico_doses') || sql.includes('FROM push_subscriptions')) {
          return { rowCount: 0, rows: [] };
        }
        if (sql.includes('INSERT INTO notificacoes')) {
          insertedNotifs.push({ title: params[2], message: params[3], userId: params[1] });
          return { rowCount: 1, rows: [{ id: params[0] }] };
        }
        return { rowCount: 0, rows: [] };
      },
    };

    const res = await checkOverdueDosesForCaregivers(mockClient, {
      timeZone: 'America/Sao_Paulo',
      now: fixedNow,
    });

    expect(insertedNotifs.some((n) => n.title.includes('Estoque baixo: Losartana'))).toBe(true);
    expect(insertedNotifs.some((n) => n.title.includes('Dipirona'))).toBe(false);
    expect(insertedNotifs.some((n) => n.title.includes('+30min') && n.title.includes('Losartana'))).toBe(true);
    expect(res.alertsCreated).toBe(2);
  });
});

describe('normalizeConfigMode & resolveEffectiveCareSettings', () => {
  const globalRow = {
    overdue_notify_minutes: 45,
    require_caregiver_confirm: false,
    require_confirm_after_missed: true,
    require_confirm_undo: true,
    missed_dose_minutes: 120,
    allow_patient_med_edit: false,
    notify_low_stock: true,
    low_stock_threshold: 4,
    notify_sos_usage: true,
  };

  const groupRow = {
    id: 'grp-ala-a',
    name: 'Ala A - Idosos',
    color: '#10b981',
    overdue_notify_minutes: 15,
    require_caregiver_confirm: true,
    require_confirm_after_missed: true,
    require_confirm_undo: true,
    missed_dose_minutes: 90,
    allow_patient_med_edit: false,
    notify_low_stock: true,
    low_stock_threshold: 10,
    notify_sos_usage: true,
  };

  test('normalizeConfigMode accepts valid modes and falls back cleanly', () => {
    expect(normalizeConfigMode('GLOBAL')).toBe('global');
    expect(normalizeConfigMode(' group ')).toBe('group');
    expect(normalizeConfigMode('custom')).toBe('custom');
    expect(normalizeConfigMode('invalid', 'custom')).toBe('custom');
    expect(normalizeConfigMode('', 'global')).toBe('global');
  });

  test('resolves Group -> Global -> Custom -> Default hierarchy accurately', () => {
    // 1. Novo paciente sem linha individual herda Global da clínica
    const unconfigured = resolveEffectiveCareSettings({ patientRow: null, groupRow: null, globalRow });
    expect(unconfigured.config_mode).toBe('global');
    expect(unconfigured.effective_source).toBe('global');
    expect(unconfigured.overdue_notify_minutes).toBe(45);
    expect(unconfigured.require_caregiver_confirm).toBe(false);

    // 2. Paciente sem linha nem global cai no DEFAULT_CARE_SETTINGS
    const pureDefault = resolveEffectiveCareSettings({ patientRow: null, groupRow: null, globalRow: null });
    expect(pureDefault.config_mode).toBe('global');
    expect(pureDefault.effective_source).toBe('default');
    expect(pureDefault.overdue_notify_minutes).toBe(DEFAULT_CARE_SETTINGS.overdue_notify_minutes);

    // 3. Paciente em modo Grupo recebe as regras do grupo com metadados
    const inGroup = resolveEffectiveCareSettings({
      patientRow: { config_mode: 'group', group_id: 'grp-ala-a', overdue_notify_minutes: 99 },
      groupRow,
      globalRow,
    });
    expect(inGroup.config_mode).toBe('group');
    expect(inGroup.effective_source).toBe('group');
    expect(inGroup.group_id).toBe('grp-ala-a');
    expect(inGroup.group_name).toBe('Ala A - Idosos');
    expect(inGroup.overdue_notify_minutes).toBe(15);
    expect(inGroup.low_stock_threshold).toBe(10);

    // 4. Paciente em modo Custom ignora Global/Grupo e usa suas regras próprias
    const inCustom = resolveEffectiveCareSettings({
      patientRow: {
        config_mode: 'custom',
        overdue_notify_minutes: 120,
        require_caregiver_confirm: false,
        require_confirm_after_missed: false,
      },
      groupRow,
      globalRow,
    });
    expect(inCustom.config_mode).toBe('custom');
    expect(inCustom.effective_source).toBe('custom');
    expect(inCustom.overdue_notify_minutes).toBe(120);
    expect(inCustom.require_confirm_after_missed).toBe(false);

    // 5. Fallback caso um paciente esteja em modo Grupo mas o grupo não exista mais (cai para Global)
    const missingGroup = resolveEffectiveCareSettings({
      patientRow: { config_mode: 'group', group_id: 'grp-deleted' },
      groupRow: null,
      globalRow,
    });
    expect(missingGroup.config_mode).toBe('global');
    expect(missingGroup.effective_source).toBe('global');
    expect(missingGroup.overdue_notify_minutes).toBe(45);
  });
});

