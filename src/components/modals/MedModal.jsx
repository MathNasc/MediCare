'use client';
// src/components/modals/MedModal.jsx
// Modal de cadastro de medicamento com catálogo integrado.
//
// Fluxo:
//   STEP 1 → Pesquisa no catálogo
//   STEP 2 → Confirmação do preenchimento automático + campos do usuário
//   (manual) → Formulário completo sem catálogo
//
// Ao editar um medicamento existente, pula direto para o STEP 2 (formulário).

import { useState } from 'react';
import { PILL_COLORS, UNITS, WEEK_S, C } from '@/lib/theme';
import { MEDICINE_TYPES } from '@/data/medicationCatalog';
import { MedicationSearchInput } from '@/components/medications/MedicationSearchInput';
import { supabase } from '@/lib/supabase';

// ─── Constantes ───────────────────────────────────────────────────────────────
const STEPS = { SEARCH: 'search', FORM: 'form' };

// ─── Preview do medicamento selecionado ───────────────────────────────────────
function CatalogPreview({ item, T, scale }) {
  const cfg = MEDICINE_TYPES[item.medicine_type] || MEDICINE_TYPES.outro;
  return (
    <div style={{
      background: `${cfg.color}10`,
      border: `1.5px solid ${cfg.color}40`,
      borderRadius: 16,
      padding: 14,
      marginBottom: 16,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: cfg.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        flexShrink: 0,
      }}>
        {item.is_custom ? '✨' : '💊'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
          <p style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 800 }}>
            {item.commercial_name}
          </p>
          <span style={{
            fontSize: 9 * scale,
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: 99,
            background: cfg.bg,
            color: cfg.color,
            textTransform: 'uppercase',
            letterSpacing: '.4px',
          }}>
            {cfg.label}
          </span>
        </div>
        <p style={{ color: T.sub, fontSize: 12 * scale }}>
          {item.active_ingredient}{item.dosage ? ` · ${item.dosage}` : ''}
        </p>
        {item.manufacturer && (
          <p style={{ color: T.muted, fontSize: 11 * scale, marginTop: 2 }}>
            🏭 {item.manufacturer}
          </p>
        )}
        {item.pharmaceutical_form && (
          <p style={{ color: T.muted, fontSize: 11 * scale }}>
            💊 {item.pharmaceutical_form}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export function MedModal({ med, onSave, onClose, T, scale = 1, userId }) {
  // Se está editando, vai direto para o formulário
  const isEditing = Boolean(med);

  const [step, setStep] = useState(isEditing ? STEPS.FORM : STEPS.SEARCH);
  const [selectedCatalog, setSelectedCatalog] = useState(null);
  const [saving, setSaving] = useState(false);

  // Estado do formulário — pré-preenchido se medicamento existente ou catálogo selecionado
  const [form, setForm] = useState(med || {
    nome: '',
    dosagem: '',
    quantidade: 30,
    unidade: 'comprimido',
    cor: PILL_COLORS[0],
    observacoes: '',
    ativo: true,
  });

  const [horarios, setHorarios] = useState(
    med?.horarios?.length > 0 ? med.horarios : ['08:00']
  );
  const [dias, setDias] = useState(
    med?.dias_semana?.length > 0 ? med.dias_semana : [1, 2, 3, 4, 5, 6, 7]
  );

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleDia = (d) =>
    setDias(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d]);

  // ── Seleção do catálogo → preenche formulário ──────────────────────────────
  const handleCatalogSelect = (item) => {
    setSelectedCatalog(item);

    // Mapeia unidade do catálogo para as opções do sistema
    const unitMap = {
      'comprimido': 'comprimido',
      'cápsula':    'cápsula',
      'ml':         'ml',
      'gotas':      'gotas',
      'sachê':      'sachê',
      'dose':       'unidade',
    };
    const unit = unitMap[item.unit?.toLowerCase()] || 'comprimido';

    setForm({
      nome:        item.commercial_name,
      dosagem:     item.dosage || '',
      quantidade:  30,
      unidade:     unit,
      cor:         PILL_COLORS[Math.floor(Math.random() * PILL_COLORS.length)],
      observacoes: item.is_custom ? '(Medicamento personalizado)' : '',
      ativo:       true,
      // Metadados do catálogo
      _catalogId:         item.id,
      _activeIngredient:  item.active_ingredient,
      _manufacturer:      item.manufacturer,
      _medicineType:      item.medicine_type,
      _pharmaceuticalForm: item.pharmaceutical_form,
      _isCustom:          Boolean(item.is_custom),
    });
    setStep(STEPS.FORM);
  };

  // ── Cadastro manual (sem catálogo) ────────────────────────────────────────
  const handleManual = () => {
    setSelectedCatalog(null);
    setForm({
      nome: '', dosagem: '', quantidade: 30,
      unidade: 'comprimido', cor: PILL_COLORS[0],
      observacoes: '', ativo: true,
    });
    setStep(STEPS.FORM);
  };

  // ── Salvar ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);

    // Se o medicamento selecionado era personalizado do usuário,
    // salva na tabela custom_medications do Supabase
    if (selectedCatalog?.is_custom && supabase && userId && !isEditing) {
      try {
        await supabase.from('custom_medications').upsert({
          id:                 selectedCatalog.id !== String(Date.now()) ? selectedCatalog.id : undefined,
          user_id:            userId,
          commercial_name:    form.nome,
          active_ingredient:  form._activeIngredient,
          dosage:             form.dosagem,
          pharmaceutical_form: form._pharmaceuticalForm,
          unit:               form.unidade,
          manufacturer:       form._manufacturer,
          medicine_type:      form._medicineType || 'outro',
        });
      } catch { /* silencioso — não bloqueia o save principal */ }
    }

    // Dados a salvar no medicamentos principal
    const payload = {
      nome:        form.nome,
      dosagem:     form.dosagem,
      quantidade:  form.quantidade,
      unidade:     form.unidade,
      cor:         form.cor,
      observacoes: form.observacoes,
      ativo:       form.ativo !== false,
      horarios:    horarios.length > 0 ? horarios : ['08:00'],
      dias_semana: dias.length > 0 ? dias : [1,2,3,4,5,6,7],
    };

    setSaving(false);
    onSave(payload, horarios, dias);
  };

  const inp = {
    background: T.inp,
    border: `1.5px solid ${T.inpB}`,
    borderRadius: 12,
    padding: '13px 15px',
    color: T.txt,
    fontSize: 15 * scale,
    width: '100%',
    outline: 'none',
  };

  // ── Render: STEP SEARCH ───────────────────────────────────────────────────
  if (step === STEPS.SEARCH) {
    return (
      <div
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Adicionar medicamento"
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.82)',
          backdropFilter: 'blur(16px)',
          zIndex: 300,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        <div
          className="anim-fadeUp"
          onClick={e => e.stopPropagation()}
          style={{
            background: T.bg1,
            borderRadius: '28px 28px 0 0',
            width: '100%',
            maxWidth: 480,
            height: '90vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '20px 16px 12px',
            borderBottom: `1px solid ${T.bdr}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 13,
              background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}>
              💊
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ color: T.txt, fontSize: 18 * scale, fontWeight: 900, lineHeight: 1.2 }}>
                Adicionar medicamento
              </h2>
              <p style={{ color: T.sub, fontSize: 12 * scale }}>
                Busque no catálogo ou cadastre manualmente
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: T.bg3, color: T.sub, fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer',
              }}
            >×</button>
          </div>

          {/* Search */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ paddingTop: 12, flexShrink: 0 }} />
            <MedicationSearchInput
              onSelect={handleCatalogSelect}
              onManual={handleManual}
              userId={userId}
              T={T}
              scale={scale}
              autoFocus
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Render: STEP FORM ─────────────────────────────────────────────────────
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Editar medicamento' : 'Novo medicamento'}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.82)',
        backdropFilter: 'blur(16px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        className="anim-fadeUp"
        onClick={e => e.stopPropagation()}
        style={{
          background: T.bg1,
          borderRadius: '28px 28px 0 0',
          width: '100%',
          maxWidth: 480,
          maxHeight: '92vh',
          overflowY: 'auto',
          paddingBottom: 36,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: `1px solid ${T.bdr}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          background: T.bg1,
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Botão voltar (só aparece no fluxo do catálogo) */}
            {!isEditing && (
              <button
                onClick={() => setStep(STEPS.SEARCH)}
                aria-label="Voltar para busca"
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: T.bg3, border: 'none', color: T.sub,
                  fontSize: 18, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer',
                }}
              >‹</button>
            )}
            <h2 style={{ color: T.txt, fontSize: 18 * scale, fontWeight: 800 }}>
              {isEditing ? 'Editar medicamento' : 'Confirmar dados'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: T.bg3, color: T.sub, fontSize: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: 'pointer',
            }}
          >×</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Preview do catálogo selecionado */}
          {selectedCatalog && !isEditing && (
            <CatalogPreview item={selectedCatalog} T={T} scale={scale} />
          )}

          {/* Cor */}
          <p style={{
            color: T.sub, fontSize: 11 * scale, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 8,
          }}>
            Cor do medicamento
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {PILL_COLORS.map(cor => (
              <button
                key={cor}
                onClick={() => set('cor', cor)}
                aria-label={`Cor ${cor}`}
                aria-pressed={form.cor === cor}
                style={{
                  width: 36, height: 36, borderRadius: 10, background: cor,
                  border: form.cor === cor ? '3px solid #fff' : '3px solid transparent',
                  outline: form.cor === cor ? `2px solid ${cor}` : 'none',
                  transform: form.cor === cor ? 'scale(1.18)' : 'scale(1)',
                  transition: 'all .15s',
                  boxShadow: form.cor === cor ? `0 0 12px ${cor}90` : 'none',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>

          {/* Campos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Nome */}
            <div>
              <label style={{
                color: T.sub, fontSize: 11 * scale, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '.6px',
                display: 'block', marginBottom: 6,
              }}>
                Nome *
              </label>
              <input
                style={inp}
                placeholder="Nome do medicamento"
                value={form.nome}
                onChange={e => set('nome', e.target.value)}
              />
            </div>

            {/* Princípio ativo (readonly se veio do catálogo) */}
            {form._activeIngredient && (
              <div>
                <label style={{
                  color: T.sub, fontSize: 11 * scale, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '.6px',
                  display: 'block', marginBottom: 6,
                }}>
                  Princípio ativo
                </label>
                <div style={{
                  ...inp,
                  background: T.bg2,
                  color: T.sub,
                  border: `1.5px solid ${T.bdr}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{ fontSize: 13 }}>🧬</span>
                  <span style={{ fontSize: 14 * scale }}>{form._activeIngredient}</span>
                </div>
              </div>
            )}

            {/* Dosagem + Quantidade */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{
                  color: T.sub, fontSize: 11 * scale, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '.6px',
                  display: 'block', marginBottom: 6,
                }}>Dosagem</label>
                <input
                  style={inp}
                  placeholder="Ex: 500mg"
                  value={form.dosagem}
                  onChange={e => set('dosagem', e.target.value)}
                />
              </div>
              <div>
                <label style={{
                  color: T.sub, fontSize: 11 * scale, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '.6px',
                  display: 'block', marginBottom: 6,
                }}>Qtd. disponível</label>
                <input
                  type="number"
                  min="0"
                  style={inp}
                  value={form.quantidade}
                  onChange={e => set('quantidade', Math.max(0, +e.target.value))}
                />
              </div>
            </div>

            {/* Unidade */}
            <div>
              <label style={{
                color: T.sub, fontSize: 11 * scale, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '.6px',
                display: 'block', marginBottom: 6,
              }}>Unidade</label>
              <select
                style={inp}
                value={form.unidade}
                onChange={e => set('unidade', e.target.value)}
              >
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>

            {/* Fabricante (readonly se veio do catálogo) */}
            {form._manufacturer && (
              <div>
                <label style={{
                  color: T.sub, fontSize: 11 * scale, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '.6px',
                  display: 'block', marginBottom: 6,
                }}>Fabricante</label>
                <div style={{
                  ...inp,
                  background: T.bg2,
                  color: T.sub,
                  border: `1.5px solid ${T.bdr}`,
                }}>
                  {form._manufacturer}
                </div>
              </div>
            )}

            {/* Observações */}
            <div>
              <label style={{
                color: T.sub, fontSize: 11 * scale, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '.6px',
                display: 'block', marginBottom: 6,
              }}>Observações</label>
              <textarea
                rows={2}
                style={{ ...inp, resize: 'none' }}
                placeholder="Tomar com água, em jejum…"
                value={form.observacoes}
                onChange={e => set('observacoes', e.target.value)}
              />
            </div>
          </div>

          {/* Horários */}
          <div style={{ marginTop: 20 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}>
              <p style={{
                color: T.sub, fontSize: 11 * scale, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '.6px',
              }}>
                Horários de administração
              </p>
              <button
                onClick={() => setHorarios(h => [...h, '12:00'])}
                style={{
                  color: C.blue,
                  border: `1px solid rgba(59,130,246,.35)`,
                  borderRadius: 99,
                  padding: '4px 12px',
                  fontSize: 12 * scale,
                  fontWeight: 700,
                  background: 'rgba(59,130,246,.08)',
                  cursor: 'pointer',
                }}
              >
                + Adicionar horário
              </button>
            </div>
            {horarios.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="time"
                  style={{ ...inp, flex: 1 }}
                  value={h}
                  onChange={e => setHorarios(hs => hs.map((x, idx) => idx === i ? e.target.value : x))}
                />
                {horarios.length > 1 && (
                  <button
                    onClick={() => setHorarios(hs => hs.filter((_, idx) => idx !== i))}
                    aria-label={`Remover horário ${h}`}
                    style={{
                      width: 44, borderRadius: 12,
                      background: 'rgba(239,68,68,.12)',
                      color: C.red, fontSize: 18,
                      border: '1px solid rgba(239,68,68,.25)',
                      cursor: 'pointer',
                    }}
                  >×</button>
                )}
              </div>
            ))}
          </div>

          {/* Dias da semana */}
          <div style={{ marginTop: 16, marginBottom: 24 }}>
            <p style={{
              color: T.sub, fontSize: 11 * scale, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10,
            }}>
              Dias da semana
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              {WEEK_S.map((d, i) => (
                <button
                  key={i}
                  onClick={() => toggleDia(i + 1)}
                  aria-pressed={dias.includes(i + 1)}
                  aria-label={`${d} ${dias.includes(i + 1) ? 'ativo' : 'inativo'}`}
                  style={{
                    flex: 1, padding: '9px 0',
                    borderRadius: 10, fontSize: 12 * scale, fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                    background: dias.includes(i + 1) ? C.blue : T.bg3,
                    color:      dias.includes(i + 1) ? '#fff' : T.sub,
                    transition: 'all .15s',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Botão salvar */}
          <button
            onClick={handleSave}
            disabled={saving || !form.nome.trim()}
            style={{
              width: '100%', padding: '17px', borderRadius: 14,
              background: !form.nome.trim()
                ? T.bg3
                : 'linear-gradient(135deg,#3b82f6,#6366f1)',
              color: !form.nome.trim() ? T.muted : '#fff',
              fontWeight: 800, fontSize: 16 * scale, border: 'none',
              boxShadow: form.nome.trim() ? '0 4px 20px rgba(59,130,246,.35)' : 'none',
              letterSpacing: '.3px', cursor: form.nome.trim() ? 'pointer' : 'not-allowed',
              opacity: saving ? .7 : 1,
              transition: 'all .2s',
            }}
          >
            {saving
              ? '⟳ Salvando…'
              : isEditing
                ? '✓ Salvar alterações'
                : '+ Adicionar medicamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
