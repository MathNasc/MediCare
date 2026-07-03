// src/lib/catalogSearch.js
// ─── Pesquisa inteligente no catálogo de medicamentos ─────────────────────────
// 1. Normaliza o texto (remove acentos, lowercase)
// 2. Busca local no dataset estático (< 50ms)
// 3. Fallback para Supabase fulltext se disponível
// 4. Inclui medicamentos personalizados do usuário

import MEDICATION_CATALOG from '@/data/medicationCatalog';
import { supabase } from './supabase';

// ─── Normalização ─────────────────────────────────────────────────────────────
export function normalize(str = '') {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

// ─── Score de relevância simples ──────────────────────────────────────────────
function scoreMatch(item, terms) {
  const fields = [
    normalize(item.commercial_name)   + ' ',
    normalize(item.active_ingredient) + ' ',
    normalize(item.manufacturer)      + ' ',
    normalize(item.dosage)            + ' ',
  ];
  const haystack = fields.join(' ');

  let score = 0;
  for (const term of terms) {
    if (!term) continue;
    // Começa com o termo → maior peso
    if (normalize(item.commercial_name).startsWith(term)) score += 10;
    // Princípio ativo começa com o termo
    if (normalize(item.active_ingredient).startsWith(term)) score += 8;
    // Contém o termo em qualquer campo
    if (haystack.includes(term)) score += 3;
    // Contem parcialmente
    if (haystack.split(' ').some(w => w.startsWith(term))) score += 2;
  }
  return score;
}

// ─── Pesquisa local (dataset estático) ───────────────────────────────────────
export function searchLocal(query, limit = 20) {
  if (!query || query.trim().length < 2) return [];
  const terms = normalize(query).split(/\s+/).filter(Boolean);

  const results = MEDICATION_CATALOG
    .map(item => ({ ...item, _score: scoreMatch(item, terms) }))
    .filter(item => item._score > 0)
    .sort((a, b) => b._score - a._score || a.commercial_name.localeCompare(b.commercial_name))
    .slice(0, limit);

  return results;
}

// ─── Pesquisa híbrida: local + Supabase + medicamentos personalizados ──────────
export async function searchCatalog(query, userId = null, limit = 20) {
  if (!query || query.trim().length < 2) return [];

  // Sempre busca local primeiro (instantânea)
  const localResults = searchLocal(query, limit);

  // Busca medicamentos personalizados do usuário
  let customResults = [];
  if (userId && supabase) {
    try {
      const { data } = await supabase
        .from('custom_medications')
        .select('*')
        .eq('user_id', userId)
        .or(`commercial_name.ilike.%${query}%,active_ingredient.ilike.%${query}%`)
        .limit(5);
      customResults = (data || []).map(d => ({ ...d, is_custom: true }));
    } catch {}
  }

  // Busca no Supabase se disponível (complementa resultados locais)
  let dbResults = [];
  if (supabase && localResults.length < 5) {
    try {
      const { data } = await supabase
        .rpc('search_medications', { query, result_limit: limit });
      dbResults = data || [];
    } catch {}
  }

  // Mescla: custom primeiro, depois local, depois DB (deduplicado por nome+dosagem)
  const seen = new Set();
  const merged = [...customResults, ...localResults, ...dbResults].filter(item => {
    const key = `${normalize(item.commercial_name)}-${normalize(item.dosage || '')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return merged.slice(0, limit);
}

// ─── Busca por ID (para preenchimento automático) ─────────────────────────────
export function findById(id) {
  return MEDICATION_CATALOG.find(m => m.id === id) || null;
}

// ─── Grupos de sugestão (sem query — mostra populares por categoria) ───────────
export function getPopularByCategory() {
  const categories = {
    'Anti-hipertensivos':  ['Losartana Potássica 50mg', 'Enalapril 10mg', 'Anlodipino 5mg'],
    'Diabetes':            ['Metformina 850mg', 'Glifage XR 500mg', 'Dapagliflozina 10mg'],
    'Colesterol':          ['Sinvastatina 20mg', 'Atorvastatina 20mg', 'Rosuvastatina 10mg'],
    'Dor / Febre':         ['Paracetamol 750mg', 'Dipirona 500mg', 'Ibuprofeno 400mg'],
    'Estômago':            ['Omeprazol 20mg', 'Pantoprazol 40mg', 'Domperidona 10mg'],
    'Tireoide':            ['Puran T4 50mcg', 'Levotiroxina 100mcg'],
    'Vitaminas':           ['Vitamina D3 2000UI', 'Ômega 3 1000mg', 'Ácido Fólico 5mg'],
  };

  return Object.entries(categories).map(([cat, names]) => ({
    category: cat,
    items: names
      .map(name => MEDICATION_CATALOG.find(m => m.commercial_name === name))
      .filter(Boolean),
  }));
}
