import { getDoseStatus, buildDoses, timeLabel } from '@/lib/doseUtils';

// Mock current time to 10:00
const MOCK_NOW = new Date('2024-01-15T10:00:00');
const OriginalDate = Date;

beforeAll(() => {
  global.Date = class extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) return new OriginalDate(MOCK_NOW);
      return new OriginalDate(...args);
    }
    static now() { return MOCK_NOW.getTime(); }
  };
});

afterAll(() => { global.Date = OriginalDate; });

// ─── getDoseStatus ────────────────────────────────────────────────────────────
describe('getDoseStatus', () => {
  it('returns confirmed when confirmed=true', () => {
    expect(getDoseStatus('08:00', true)).toBe('confirmed');
  });

  it('returns upcoming when dose is within 15 min (future)', () => {
    // 10:10 is 10 min in future from mock 10:00
    expect(getDoseStatus('10:10', false)).toBe('upcoming');
  });

  it('returns scheduled when dose is >15 min in future', () => {
    expect(getDoseStatus('11:00', false)).toBe('scheduled');
  });

  it('returns pending when 0-30 min past', () => {
    // 09:50 is 10 min ago
    expect(getDoseStatus('09:50', false)).toBe('pending');
  });

  it('returns late when 30-120 min past', () => {
    // 08:30 is 90 min ago
    expect(getDoseStatus('08:30', false)).toBe('late');
  });

  it('returns missed when >120 min past', () => {
    // 06:00 is 240 min ago
    expect(getDoseStatus('06:00', false)).toBe('missed');
  });
});

// ─── buildDoses ───────────────────────────────────────────────────────────────
describe('buildDoses', () => {
  const meds = [
    {
      id: 'med1', user_id: 'u1',
      nome: 'Aspirina', dosagem: '100mg', unidade: 'comprimido',
      cor: '#ef4444', ativo: true,
      horarios: ['08:00', '20:00'], dias_semana: [1,2,3,4,5,6,7],
    },
    {
      id: 'med2', user_id: 'u1',
      nome: 'Vitamina D', dosagem: '2000UI', unidade: 'cápsula',
      cor: '#f59e0b', ativo: false,
      horarios: ['14:00'], dias_semana: [1,2,3,4,5,6,7],
    },
  ];

  it('only includes active medications', () => {
    const doses = buildDoses(meds, []);
    expect(doses.every((d) => d.nome !== 'Vitamina D')).toBe(true);
  });

  it('creates one dose per horario', () => {
    const doses = buildDoses(meds, []);
    expect(doses.length).toBe(2); // Aspirina has 2 horarios
  });

  it('uses fallback horario when horarios is empty', () => {
    const medNoHorario = [{ ...meds[0], horarios: [] }];
    const doses = buildDoses(medNoHorario, []);
    expect(doses.length).toBe(1);
    expect(doses[0].hora).toBe('08:00');
  });

  it('marks dose as confirmed when found in history', () => {
    const today = new Date().toDateString();
    const history = [{
      id: 'h1', med_id: 'med1', user_id: 'u1',
      hora: '08:00', status: 'confirmed', atraso_minutos: 0,
      created_at: new Date().toISOString(),
    }];
    const doses = buildDoses(meds, history);
    const morningDose = doses.find((d) => d.hora === '08:00');
    expect(morningDose.status).toBe('confirmed');
  });

  it('sorts doses by hora', () => {
    const doses = buildDoses(meds, []);
    for (let i = 1; i < doses.length; i++) {
      expect(doses[i].hora >= doses[i-1].hora).toBe(true);
    }
  });

  it('generates unique ids per med+hora combination', () => {
    const doses = buildDoses(meds, []);
    const ids = doses.map((d) => d.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ─── timeLabel ────────────────────────────────────────────────────────────────
describe('timeLabel', () => {
  it('shows minutes when < 60 min away', () => {
    expect(timeLabel('10:10')).toBe('em 10 min');
  });

  it('shows hours when > 60 min away', () => {
    expect(timeLabel('12:00')).toBe('em 2h');
  });

  it('shows minutes ago when recent past', () => {
    expect(timeLabel('09:50')).toBe('10 min atrás');
  });

  it('shows hours ago when distant past', () => {
    expect(timeLabel('07:00')).toBe('3h atrás');
  });
});
