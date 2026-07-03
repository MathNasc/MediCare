'use client';
// src/components/medications/MedicationSearchInput.jsx
// Componente de busca com autocomplete para o catálogo de medicamentos.
// Exibe sugestões em tempo real, com indicadores visuais de tipo (Referência/Genérico/Similar).

import { useState, useEffect, useRef, useCallback } from 'react';
import { searchCatalog, getPopularByCategory, normalize } from '@/lib/catalogSearch';
import { MEDICINE_TYPES } from '@/data/medicationCatalog';
import { C } from '@/lib/theme';

// ─── Badge de tipo ─────────────────────────────────────────────────────────────
function TypeBadge({ type, scale = 1 }) {
  const cfg = MEDICINE_TYPES[type] || MEDICINE_TYPES.outro;
  return (
    <span style={{
      fontSize: 9 * scale,
      fontWeight: 800,
      padding: '2px 7px',
      borderRadius: 99,
      background: cfg.bg,
      color: cfg.color,
      letterSpacing: '.4px',
      textTransform: 'uppercase',
      flexShrink: 0,
    }}>
      {cfg.short}
    </span>
  );
}

// ─── Item da lista de resultados ───────────────────────────────────────────────
function ResultItem({ item, query, onSelect, T, scale, isHighlighted }) {
  // Destaca o trecho que bate com a busca
  function highlight(text = '') {
    if (!query) return text;
    const term = normalize(query);
    const norm = normalize(text);
    const idx = norm.indexOf(term);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: 'rgba(59,130,246,.25)', color: 'inherit', borderRadius: 3 }}>
          {text.slice(idx, idx + term.length)}
        </mark>
        {text.slice(idx + term.length)}
      </>
    );
  }

  return (
    <button
      onClick={() => onSelect(item)}
      style={{
        width: '100%',
        background: isHighlighted ? 'rgba(59,130,246,.08)' : 'transparent',
        border: 'none',
        borderBottom: `1px solid ${T.bdr}`,
        padding: '12px 16px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        transition: 'background .1s',
      }}
    >
      {/* Ícone de tipo */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        flexShrink: 0,
        background: item.is_custom
          ? 'rgba(139,92,246,.12)'
          : (MEDICINE_TYPES[item.medicine_type]?.bg || 'rgba(59,130,246,.12)'),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
      }}>
        {item.is_custom ? '✨' : '💊'}
      </div>

      {/* Informações */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <p style={{
            color: T.txt,
            fontSize: 14 * scale,
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {highlight(item.commercial_name)}
          </p>
          <TypeBadge type={item.medicine_type} scale={scale} />
        </div>
        <p style={{ color: T.sub, fontSize: 11 * scale, lineHeight: 1.3 }}>
          {highlight(item.active_ingredient)}
          {item.dosage ? ` · ${item.dosage}` : ''}
          {item.pharmaceutical_form ? ` · ${item.pharmaceutical_form}` : ''}
        </p>
        {item.manufacturer && (
          <p style={{ color: T.muted, fontSize: 10 * scale, marginTop: 1 }}>
            {item.manufacturer}
          </p>
        )}
      </div>

      {/* Seta */}
      <span style={{ color: T.muted, fontSize: 14, flexShrink: 0 }}>›</span>
    </button>
  );
}

// ─── Categoria popular ─────────────────────────────────────────────────────────
function PopularCategory({ category, items, onSelect, T, scale }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 4 }}>
      <p style={{
        color: T.muted,
        fontSize: 10 * scale,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.6px',
        padding: '8px 16px 4px',
      }}>
        {category}
      </p>
      {items.map(item => (
        <ResultItem
          key={`${item.id}-${item.commercial_name}`}
          item={item}
          query=""
          onSelect={onSelect}
          T={T}
          scale={scale}
          isHighlighted={false}
        />
      ))}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export function MedicationSearchInput({
  onSelect,
  onManual,
  userId,
  T,
  scale = 1,
  autoFocus = true,
}) {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [showPopular, setShowPopular] = useState(true);
  const [popular, setPopular]     = useState([]);
  const [highlighted, setHighlighted] = useState(-1);
  const [noResults, setNoResults] = useState(false);

  const inputRef    = useRef(null);
  const listRef     = useRef(null);
  const debounceRef = useRef(null);

  // Carrega populares na montagem
  useEffect(() => {
    setPopular(getPopularByCategory());
  }, []);

  // Foca o input automaticamente
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  // Debounce da pesquisa
  const runSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      setNoResults(false);
      setShowPopular(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setShowPopular(false);
    setHighlighted(-1);

    try {
      const found = await searchCatalog(q, userId, 20);
      setResults(found);
      setNoResults(found.length === 0);
    } catch {
      setResults([]);
      setNoResults(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 200);
  };

  // Navegação por teclado
  const handleKeyDown = (e) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, -1));
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      onSelect(results[highlighted]);
    } else if (e.key === 'Escape') {
      setQuery('');
      setResults([]);
      setShowPopular(true);
    }
  };

  const clearQuery = () => {
    setQuery('');
    setResults([]);
    setNoResults(false);
    setShowPopular(true);
    setHighlighted(-1);
    inputRef.current?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Campo de busca */}
      <div style={{
        position: 'relative',
        padding: '0 16px',
        marginBottom: 8,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: T.inp,
          border: `1.5px solid ${query.length >= 2 ? '#3b82f6' : T.inpB}`,
          borderRadius: 14,
          padding: '12px 14px',
          transition: 'border-color .2s',
        }}>
          {loading ? (
            <span className="anim-spin" style={{ fontSize: 16, flexShrink: 0 }}>⟳</span>
          ) : (
            <span style={{ fontSize: 16, color: T.muted, flexShrink: 0 }}>🔍</span>
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Buscar medicamento, princípio ativo…"
            autoComplete="off"
            aria-label="Buscar medicamento"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: T.txt,
              fontSize: 15 * scale,
              minWidth: 0,
            }}
          />
          {query.length > 0 && (
            <button
              onClick={clearQuery}
              aria-label="Limpar busca"
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: T.bg3,
                border: 'none',
                color: T.muted,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >✕</button>
          )}
        </div>

        {/* Dica de atalho */}
        {query.length === 0 && (
          <p style={{
            color: T.muted,
            fontSize: 11 * scale,
            marginTop: 6,
            textAlign: 'center',
          }}>
            Digite o nome comercial ou o princípio ativo
          </p>
        )}
        {query.length === 1 && (
          <p style={{ color: T.muted, fontSize: 11 * scale, marginTop: 6, textAlign: 'center' }}>
            Continue digitando…
          </p>
        )}
      </div>

      {/* Lista de resultados */}
      <div
        ref={listRef}
        role="listbox"
        aria-label="Resultados da busca"
        style={{
          flex: 1,
          overflowY: 'auto',
          background: T.bg1,
        }}
      >
        {/* Resultados da busca */}
        {!showPopular && results.length > 0 && (
          <>
            <p style={{
              color: T.muted,
              fontSize: 10 * scale,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.6px',
              padding: '8px 16px 4px',
            }}>
              {results.length} resultado{results.length !== 1 ? 's' : ''}
            </p>
            {results.map((item, idx) => (
              <ResultItem
                key={`${item.id}-${item.commercial_name}-${idx}`}
                item={item}
                query={query}
                onSelect={onSelect}
                T={T}
                scale={scale}
                isHighlighted={idx === highlighted}
              />
            ))}
          </>
        )}

        {/* Nenhum resultado encontrado */}
        {noResults && (
          <div style={{
            padding: '32px 20px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>🔍</p>
            <p style={{
              color: T.txt,
              fontSize: 16 * scale,
              fontWeight: 800,
              marginBottom: 8,
            }}>
              Não encontramos esse medicamento
            </p>
            <p style={{
              color: T.sub,
              fontSize: 13 * scale,
              marginBottom: 24,
              lineHeight: 1.6,
            }}>
              Tente buscar pelo princípio ativo ou nome genérico, ou cadastre manualmente.
            </p>
            <button
              onClick={onManual}
              style={{
                padding: '14px 24px',
                borderRadius: 13,
                background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 14 * scale,
                border: 'none',
                boxShadow: '0 4px 20px rgba(59,130,246,.35)',
                cursor: 'pointer',
              }}
            >
              + Cadastrar manualmente
            </button>
          </div>
        )}

        {/* Populares por categoria */}
        {showPopular && popular.length > 0 && (
          <>
            <p style={{
              color: T.muted,
              fontSize: 10 * scale,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.6px',
              padding: '8px 16px 4px',
            }}>
              Medicamentos frequentes
            </p>
            {popular.map(({ category, items }) => (
              <PopularCategory
                key={category}
                category={category}
                items={items}
                onSelect={onSelect}
                T={T}
                scale={scale}
              />
            ))}
          </>
        )}

        {/* Espaço extra para scroll */}
        <div style={{ height: 16 }} />
      </div>

      {/* Botão "cadastrar manualmente" sempre visível no rodapé */}
      {!noResults && (
        <div style={{
          padding: '12px 16px',
          borderTop: `1px solid ${T.bdr}`,
          background: T.bg1,
        }}>
          <button
            onClick={onManual}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 12,
              background: T.bg3,
              color: T.sub,
              fontWeight: 600,
              fontSize: 13 * scale,
              border: `1px solid ${T.bdr}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            ✏️ Não encontrei — cadastrar manualmente
          </button>
        </div>
      )}
    </div>
  );
}
