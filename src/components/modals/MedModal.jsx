'use client';
// src/components/modals/MedModal.jsx
// Modal de cadastro/edição de medicamento com catálogo + tipo de tratamento
// + detecção automática de reposição/ajuste de estoque.
//
// Fluxo (novo cadastro):
//   STEP 1 (SEARCH)     → Pesquisa no catálogo
//   STEP 2 (TREATMENT)  → Escolha do tipo de tratamento
//   STEP 3 (FORM)       → Campos finais, condicionais ao tipo escolhido
//
// Fluxo (edição de medicamento existente):
//   STEP 3 (FORM) direto → se a quantidade foi alterada ao salvar,
//   exibe StockMovementModal antes de confirmar (compra/ajuste/correção).

import { useState } from 'react';
import { PILL_COLORS, UNITS, WEEK_S, C } from '@/lib/theme';
import { MEDICINE_TYPES } from '@/data/medicationCatalog';
import { MedicationSearchInput } from '@/components/medications/MedicationSearchInput';
import { TREATMENT_TYPES, computeEndDate, calcTreatmentDays } from '@/lib/treatmentTypes';
import { StockMovementModal } from '@/components/modals/StockMovementModal';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';

const STEPS = { SEARCH: 'search', TREATMENT: 'treatment', FORM: 'form' };

// ─── Preview do medicamento selecionado no catálogo ───────────────────────────
function CatalogPreview({ item, T, scale }) {
  const cfg = MEDICINE_TYPES[item.medicine_type] || MEDICINE_TYPES.outro;
  return (
    <div style={{ background: `${cfg.color}10`, border: `1.5px solid ${cfg.color}40`, borderRadius: 16, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
        {item.is_custom ? '✨' : '💊'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
          <p style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 800 }}>{item.commercial_name}</p>
          <span style={{ fontSize: 9 * scale, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: cfg.bg, color: cfg.color, textTransform: 'uppercase', letterSpacing: '.4px' }}>{cfg.label}</span>
        </div>
        <p style={{ color: T.sub, fontSize: 12 * scale }}>{item.active_ingredient}{item.dosage ? ` · ${item.dosage}` : ''}</p>
        {item.manufacturer && <p style={{ color: T.muted, fontSize: 11 * scale, marginTop: 2 }}>🏭 {item.manufacturer}</p>}
      </div>
    </div>
  );
}

// ─── Seletor de tipo de tratamento ─────────────────────────────────────────────
function TreatmentTypeSelector({ value, onChange, T, scale }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Object.values(TREATMENT_TYPES).map(t => (
        <button
          key={t.code}
          onClick={() => onChange(t.code)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
            padding: '14px 16px', borderRadius: 14,
            border: `2px solid ${value === t.code ? t.color : T.bdr}`,
            background: value === t.code ? `${t.color}12` : T.bg2,
            cursor: 'pointer', transition: 'all .15s',
          }}
        >
          <span style={{ fontSize: 24, flexShrink: 0 }}>{t.icon}</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: value === t.code ? t.color : T.txt, fontWeight: 800, fontSize: 14 * scale }}>{t.label}</p>
            <p style={{ color: T.muted, fontSize: 11.5 * scale, marginTop: 2, lineHeight: 1.4 }}>{t.description}</p>
          </div>
          {value === t.code && <span style={{ color: t.color, fontSize: 18, flexShrink: 0 }}>✓</span>}
        </button>
      ))}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export function MedModal({ med, onSave, onClose, T, scale = 1, userId }) {
  const { recordStockMovement } = useApp();
  const isEditing = Boolean(med);

  const [step, setStep] = useState(isEditing ? STEPS.FORM : STEPS.SEARCH);
  const [selectedCatalog, setSelectedCatalog] = useState(null);
  const [saving, setSaving] = useState(false);

  const [treatmentType, setTreatmentType] = useState(med?.treatment_type || 'continuous');
  const [startDate, setStartDate] = useState(med?.start_date || new Date().toISOString().slice(0, 10));
  const [durationDays, setDurationDays] = useState(
    med?.treatment_days || (med?.start_date && med?.end_date ? calcTreatmentDays(med.start_date, med.end_date) : 7)
  );

  const [form, setForm] = useState(med || {
    nome: '', dosagem: '', quantidade: 30,
    unidade: 'comprimido', cor: PILL_COLORS[0],
    observacoes: '', ativo: true,
  });

  const [horarios, setHorarios] = useState(
    med?.horarios?.length > 0 ? med.horarios : ['08:00']
  );
  const [dias, setDias] = useState(
    med?.dias_semana?.length > 0 ? med.dias_semana : [1, 2, 3, 4, 5, 6, 7]
  );

  // Movimentação de estoque pendente — exibida antes de confirmar o salvamento
  // quando a quantidade de um medicamento já existente é alterada.
  const [pendingPayload, setPendingPayload] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleDia = (d) => setDias(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d]);

  // ── Seleção do catálogo → avança para escolha do tipo de tratamento ────────
  const handleCatalogSelect = (item) => {
    setSelectedCatalog(item);
    const unitMap = { 'comprimido':'comprimido','cápsula':'cápsula','ml':'ml','gotas':'gotas','sachê':'sachê','dose':'unidade' };
    const unit = unitMap[item.unit?.toLowerCase()] || 'comprimido';

    setForm({
      nome: item.commercial_name, dosagem: item.dosage || '', quantidade: 30,
      unidade: unit, cor: PILL_COLORS[Math.floor(Math.random() * PILL_COLORS.length)],
      observacoes: item.is_custom ? '(Medicamento personalizado)' : '', ativo: true,
      _catalogId: item.id, _activeIngredient: item.active_ingredient,
      _manufacturer: item.manufacturer, _medicineType: item.medicine_type,
      _pharmaceuticalForm: item.pharmaceutical_form, _isCustom: Boolean(item.is_custom),
    });
    setStep(STEPS.TREATMENT);
  };

  const handleManual = () => {
    setSelectedCatalog(null);
    setForm({ nome: '', dosagem: '', quantidade: 30, unidade: 'comprimido', cor: PILL_COLORS[0], observacoes: '', ativo: true });
    setStep(STEPS.TREATMENT);
  };

  // ── Construção do payload final ────────────────────────────────────────────
  const buildPayload = () => {
    const isTemporary = treatmentType === 'temporary';
    const isSOS       = treatmentType === 'sos';
    const endDate = isTemporary ? computeEndDate(startDate, durationDays) : null;

    return {
      nome: form.nome, dosagem: form.dosagem, quantidade: form.quantidade,
      unidade: form.unidade, cor: form.cor, observacoes: form.observacoes,
      ativo: form.ativo !== false,
      horarios: isSOS ? [] : (horarios.length > 0 ? horarios : ['08:00']),
      dias_semana: isSOS ? [] : (dias.length > 0 ? dias : [1,2,3,4,5,6,7]),
      treatment_type: treatmentType,
      start_date: isTemporary ? startDate : null,
      end_date: endDate,
      treatment_days: isTemporary ? durationDays : null,
      status: med?.status || 'ativo',
    };
  };

  // ── Confirma efetivamente o salvamento (após eventual modal de estoque) ────
  const commitSave = async (payload, movementDetails = null) => {
    setSaving(true);

    if (selectedCatalog?.is_custom && supabase && userId && !isEditing) {
      try {
        await supabase.from('custom_medications').upsert({
          id: selectedCatalog.id !== String(Date.now()) ? selectedCatalog.id : undefined,
          user_id: userId, commercial_name: form.nome,
          active_ingredient: form._activeIngredient, dosage: form.dosagem,
          pharmaceutical_form: form._pharmaceuticalForm, unit: form.unidade,
          manufacturer: form._manufacturer, medicine_type: form._medicineType || 'outro',
        });
      } catch {}
    }

    onSave(payload, payload.horarios, payload.dias_semana);

    if (movementDetails && med) {
      await recordStockMovement({
        medicationId: med.id,
        movementType: movementDetails.movementType,
        quantityBefore: med.quantidade,
        quantityAfter: payload.quantidade,
        purchasePrice: movementDetails.purchasePrice,
        purchaseLocation: movementDetails.purchaseLocation,
        batch: movementDetails.batch,
        expirationDate: movementDetails.expirationDate,
        notes: movementDetails.notes,
      });
    }

    setSaving(false);
    setPendingPayload(null);
  };

  // ── Salvar: detecta alteração de estoque antes de confirmar ────────────────
  const handleSave = async () => {
    if (!form.nome.trim()) return;
    const payload = buildPayload();

    const quantityChanged = isEditing && Number(payload.quantidade) !== Number(med.quantidade);
    if (quantityChanged) {
      // Aguarda confirmação no StockMovementModal antes de persistir
      setPendingPayload(payload);
      return;
    }

    await commitSave(payload);
  };

  const handleStockMovementConfirm = async (movementDetails) => {
    await commitSave(pendingPayload, movementDetails);
  };

  const inp = { background: T.inp, border: `1.5px solid ${T.inpB}`, borderRadius: 12, padding: '13px 15px', color: T.txt, fontSize: 15 * scale, width: '100%', outline: 'none' };

  // ── STEP: SEARCH ───────────────────────────────────────────────────────────
  if (step === STEPS.SEARCH) {
    return (
      <div onClick={onClose} role="dialog" aria-modal="true" aria-label="Adicionar medicamento"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(16px)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div className="anim-fadeUp" onClick={e => e.stopPropagation()}
          style={{ background: T.bg1, borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 480, height: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${T.bdr}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💊</div>
            <div style={{ flex: 1 }}>
              <h2 style={{ color: T.txt, fontSize: 18 * scale, fontWeight: 900, lineHeight: 1.2 }}>Adicionar medicamento</h2>
              <p style={{ color: T.sub, fontSize: 12 * scale }}>Busque no catálogo ou cadastre manualmente</p>
            </div>
            <button onClick={onClose} aria-label="Fechar" style={{ width: 36, height: 36, borderRadius: '50%', background: T.bg3, color: T.sub, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ paddingTop: 12, flexShrink: 0 }} />
            <MedicationSearchInput onSelect={handleCatalogSelect} onManual={handleManual} userId={userId} T={T} scale={scale} autoFocus />
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: TREATMENT ─────────────────────────────────────────────────────────
  if (step === STEPS.TREATMENT) {
    return (
      <div onClick={onClose} role="dialog" aria-modal="true" aria-label="Tipo de tratamento"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(16px)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div className="anim-fadeUp" onClick={e => e.stopPropagation()}
          style={{ background: T.bg1, borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', paddingBottom: 32 }}>
          <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${T.bdr}`, display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, background: T.bg1, zIndex: 10 }}>
            <button onClick={() => setStep(STEPS.SEARCH)} aria-label="Voltar" style={{ width: 36, height: 36, borderRadius: '50%', background: T.bg3, border: 'none', color: T.sub, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
            <div>
              <h2 style={{ color: T.txt, fontSize: 18 * scale, fontWeight: 800 }}>Tipo de tratamento</h2>
              <p style={{ color: T.sub, fontSize: 12 * scale }}>Como este medicamento será utilizado?</p>
            </div>
          </div>
          <div style={{ padding: 20 }}>
            {selectedCatalog && <CatalogPreview item={selectedCatalog} T={T} scale={scale} />}
            <TreatmentTypeSelector value={treatmentType} onChange={setTreatmentType} T={T} scale={scale} />
            <button
              onClick={() => setStep(STEPS.FORM)}
              style={{ width: '100%', marginTop: 20, padding: '16px', borderRadius: 14, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', fontWeight: 800, fontSize: 15 * scale, border: 'none', boxShadow: '0 4px 20px rgba(59,130,246,.35)', cursor: 'pointer' }}
            >
              Continuar →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: FORM ───────────────────────────────────────────────────────────────
  const isTemporary = treatmentType === 'temporary';
  const isSOS       = treatmentType === 'sos';
  const treatMeta   = TREATMENT_TYPES[treatmentType];

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label={isEditing ? 'Editar medicamento' : 'Novo medicamento'}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(16px)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="anim-fadeUp" onClick={e => e.stopPropagation()}
        style={{ background: T.bg1, borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', paddingBottom: 36 }}>

        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${T.bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: T.bg1, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isEditing && (
              <button onClick={() => setStep(STEPS.TREATMENT)} aria-label="Voltar" style={{ width: 36, height: 36, borderRadius: '50%', background: T.bg3, border: 'none', color: T.sub, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
            )}
            <h2 style={{ color: T.txt, fontSize: 18 * scale, fontWeight: 800 }}>{isEditing ? 'Editar medicamento' : 'Confirmar dados'}</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ width: 36, height: 36, borderRadius: '50%', background: T.bg3, color: T.sub, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: 20 }}>
          {selectedCatalog && !isEditing && <CatalogPreview item={selectedCatalog} T={T} scale={scale} />}

          {/* Tipo de tratamento (editável mesmo na edição) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, padding: '10px 14px', borderRadius: 12, background: `${treatMeta.color}10`, border: `1px solid ${treatMeta.color}30` }}>
            <span style={{ fontSize: 18 }}>{treatMeta.icon}</span>
            <p style={{ color: treatMeta.color, fontWeight: 700, fontSize: 13 * scale, flex: 1 }}>{treatMeta.label}</p>
            <button onClick={() => setStep(STEPS.TREATMENT)} style={{ background: 'none', border: 'none', color: treatMeta.color, fontSize: 12 * scale, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Alterar</button>
          </div>

          {/* Cor */}
          <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 8 }}>Cor do medicamento</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {PILL_COLORS.map(cor => (
              <button key={cor} onClick={() => set('cor', cor)} aria-label={`Cor ${cor}`} aria-pressed={form.cor === cor}
                style={{ width: 36, height: 36, borderRadius: 10, background: cor, border: form.cor === cor ? '3px solid #fff' : '3px solid transparent', outline: form.cor === cor ? `2px solid ${cor}` : 'none', transform: form.cor === cor ? 'scale(1.18)' : 'scale(1)', transition: 'all .15s', boxShadow: form.cor === cor ? `0 0 12px ${cor}90` : 'none', cursor: 'pointer' }} />
            ))}
          </div>

          {/* Campos principais */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>Nome *</label>
              <input style={inp} placeholder="Nome do medicamento" value={form.nome} onChange={e => set('nome', e.target.value)} />
            </div>

            {form._activeIngredient && (
              <div>
                <label style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>Princípio ativo</label>
                <div style={{ ...inp, background: T.bg2, color: T.sub, border: `1.5px solid ${T.bdr}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13 }}>🧬</span>
                  <span style={{ fontSize: 14 * scale }}>{form._activeIngredient}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>Dosagem</label>
                <input style={inp} placeholder="Ex: 500mg" value={form.dosagem} onChange={e => set('dosagem', e.target.value)} />
              </div>
              <div>
                <label style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>
                  Qtd. disponível {isEditing && <span title="Alterar este valor registra automaticamente uma movimentação de estoque" style={{ cursor: 'help' }}>ℹ️</span>}
                </label>
                <input type="number" min="0" style={inp} value={form.quantidade} onChange={e => set('quantidade', Math.max(0, +e.target.value))} />
              </div>
            </div>

            <div>
              <label style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>Unidade</label>
              <select style={inp} value={form.unidade} onChange={e => set('unidade', e.target.value)}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>

            {form._manufacturer && (
              <div>
                <label style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>Fabricante</label>
                <div style={{ ...inp, background: T.bg2, color: T.sub, border: `1.5px solid ${T.bdr}` }}>{form._manufacturer}</div>
              </div>
            )}

            <div>
              <label style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>Observações</label>
              <textarea rows={2} style={{ ...inp, resize: 'none' }} placeholder="Tomar com água, em jejum…" value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
            </div>
          </div>

          {/* ── Campos condicionais: TEMPORÁRIO ── */}
          {isTemporary && (
            <div style={{ marginTop: 20, padding: 16, borderRadius: 14, background: `${TREATMENT_TYPES.temporary.color}08`, border: `1px solid ${TREATMENT_TYPES.temporary.color}25` }}>
              <p style={{ color: TREATMENT_TYPES.temporary.color, fontSize: 12 * scale, fontWeight: 800, marginBottom: 12 }}>🟡 Duração do tratamento</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ color: T.sub, fontSize: 10.5 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 6 }}>Início</label>
                  <input type="date" style={inp} value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ color: T.sub, fontSize: 10.5 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 6 }}>Duração (dias)</label>
                  <input type="number" min="1" style={inp} value={durationDays} onChange={e => setDurationDays(Math.max(1, +e.target.value))} />
                </div>
              </div>
              <p style={{ color: T.muted, fontSize: 11 * scale }}>
                Término previsto: <strong style={{ color: T.sub }}>{new Date(computeEndDate(startDate, durationDays) + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
              </p>
            </div>
          )}

          {/* ── Horários e dias: apenas para Contínuo e Temporário ── */}
          {!isSOS && (
            <>
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px' }}>Horários de administração</p>
                  <button onClick={() => setHorarios(h => [...h, '12:00'])} style={{ color: C.blue, border: '1px solid rgba(59,130,246,.35)', borderRadius: 99, padding: '4px 12px', fontSize: 12 * scale, fontWeight: 700, background: 'rgba(59,130,246,.08)', cursor: 'pointer' }}>+ Adicionar horário</button>
                </div>
                {horarios.map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input type="time" style={{ ...inp, flex: 1 }} value={h} onChange={e => setHorarios(hs => hs.map((x, idx) => idx === i ? e.target.value : x))} />
                    {horarios.length > 1 && (
                      <button onClick={() => setHorarios(hs => hs.filter((_, idx) => idx !== i))} aria-label={`Remover horário ${h}`} style={{ width: 44, borderRadius: 12, background: 'rgba(239,68,68,.12)', color: C.red, fontSize: 18, border: '1px solid rgba(239,68,68,.25)', cursor: 'pointer' }}>×</button>
                    )}
                  </div>
                ))}
              </div>

              {treatmentType === 'continuous' && (
                <div style={{ marginTop: 16, marginBottom: 24 }}>
                  <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>Dias da semana</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {WEEK_S.map((d, i) => (
                      <button key={i} onClick={() => toggleDia(i + 1)} aria-pressed={dias.includes(i + 1)} aria-label={`${d} ${dias.includes(i + 1) ? 'ativo' : 'inativo'}`}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12 * scale, fontWeight: 700, border: 'none', cursor: 'pointer', background: dias.includes(i + 1) ? C.blue : T.bg3, color: dias.includes(i + 1) ? '#fff' : T.sub, transition: 'all .15s' }}
                      >{d}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {isSOS && (
            <div style={{ marginTop: 20, marginBottom: 20, padding: 14, borderRadius: 12, background: `${TREATMENT_TYPES.sos.color}08`, border: `1px solid ${TREATMENT_TYPES.sos.color}25` }}>
              <p style={{ color: TREATMENT_TYPES.sos.color, fontSize: 12 * scale, fontWeight: 700, lineHeight: 1.5 }}>
                🔵 Este medicamento não terá horários fixos. Ele ficará disponível na lista rápida de "Medicamentos SOS" para registro manual sempre que for utilizado.
              </p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !form.nome.trim()}
            style={{
              width: '100%', padding: '17px', borderRadius: 14,
              background: !form.nome.trim() ? T.bg3 : 'linear-gradient(135deg,#3b82f6,#6366f1)',
              color: !form.nome.trim() ? T.muted : '#fff', fontWeight: 800, fontSize: 16 * scale, border: 'none',
              boxShadow: form.nome.trim() ? '0 4px 20px rgba(59,130,246,.35)' : 'none',
              letterSpacing: '.3px', cursor: form.nome.trim() ? 'pointer' : 'not-allowed',
              opacity: saving ? .7 : 1, transition: 'all .2s', marginTop: isSOS ? 0 : 4,
            }}
          >
            {saving ? '⟳ Salvando…' : isEditing ? '✓ Salvar alterações' : '+ Adicionar medicamento'}
          </button>
        </div>
      </div>

      {/* Modal de movimentação de estoque — aparece quando a quantidade muda */}
      {pendingPayload && med && (
        <StockMovementModal
          med={med}
          quantityBefore={med.quantidade}
          quantityAfter={pendingPayload.quantidade}
          onConfirm={handleStockMovementConfirm}
          onClose={() => setPendingPayload(null)}
          T={T}
          scale={scale}
        />
      )}
    </div>
  );
}
