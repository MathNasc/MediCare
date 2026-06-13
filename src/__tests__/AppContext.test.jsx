import { renderHook, act } from '@testing-library/react';
import { AppProvider, useApp } from '@/context/AppContext';

// Mock DB modules
jest.mock('@/lib/db', () => ({
  AuthDB: {
    current: jest.fn().mockResolvedValue(null),
    logout:  jest.fn(),
  },
  MedDB: {
    list:   jest.fn().mockResolvedValue([]),
    add:    jest.fn().mockImplementation((m) => Promise.resolve({ ...m, id: 'new-id', created_at: new Date().toISOString() })),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
  HistDB: {
    list: jest.fn().mockResolvedValue([]),
    add:  jest.fn().mockResolvedValue(undefined),
  },
  uid: jest.fn(() => 'test-uid'),
}));

describe('AppContext', () => {
  it('starts in loading state', () => {
    const { result } = renderHook(() => useApp(), { wrapper: AppProvider });
    expect(result.current.loading).toBe(true);
  });

  it('sets user=null when no session', async () => {
    const { result } = renderHook(() => useApp(), { wrapper: AppProvider });
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('loads data after login', async () => {
    const { AuthDB, MedDB, HistDB } = require('@/lib/db');
    const mockUser = { id: 'u1', nome: 'Test', email: 'test@test.com' };
    AuthDB.current.mockResolvedValueOnce(mockUser);
    MedDB.list.mockResolvedValueOnce([
      { id: 'm1', user_id: 'u1', nome: 'Aspirina', horarios: ['08:00'], ativo: true, dosagem: '100mg', unidade: 'comprimido', cor: '#ef4444', quantidade: 10, dias_semana: [1,2,3,4,5,6,7] }
    ]);

    const { result } = renderHook(() => useApp(), { wrapper: AppProvider });
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.meds.length).toBeGreaterThan(0);
  });
});
