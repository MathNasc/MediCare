import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSession } from '@/types';
import { api } from '@/lib/apiClient';

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verifica token existente
    const token = api.getToken();
    if (token) {
      api
        .request<{ id: string; email: string; user_metadata?: { nome?: string; role?: string } }>('/api/auth/v1/user')
        .then((u) => {
          setUser({
            id: u.id,
            email: u.email,
            nome: u.user_metadata?.nome || u.email.split('@')[0],
            role: (u.user_metadata?.role as any) || 'cuidador',
          });
        })
        .catch(() => {
          api.setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setUser({
      id: res.user.id,
      email: res.user.email,
      nome: res.user.user_metadata?.nome || res.user.email.split('@')[0],
      role: (res.user.user_metadata?.role as any) || 'cuidador',
    });
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
