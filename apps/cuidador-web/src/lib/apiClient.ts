const BASE_URL = typeof window !== 'undefined' ? '' : 'http://localhost:3000';

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('medicare_cuidador_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('medicare_cuidador_token', token);
      } else {
        localStorage.removeItem('medicare_cuidador_token');
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      this.setToken(null);
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        // Redirecionamento ou emissão de evento de sessão expirada
      }
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Erro desconhecido na requisição' }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  // Auth methods
  async login(email: string, password: string) {
    const data = await this.request<{
      access_token: string;
      refresh_token: string;
      user: { id: string; email: string; user_metadata?: { nome?: string; role?: string } };
    }>('/api/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.access_token) {
      this.setToken(data.access_token);
    }
    return data;
  }

  async logout() {
    try {
      await this.request('/api/auth/v1/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  // REST RPC methods
  async getMyPatients() {
    return this.request<any[]>('/api/rest/v1/caregiver_relationships?status=eq.active&select=*');
  }

  async getPatientSummary(patientId: string) {
    return this.request<any>('/api/rest/v1/rpc/get_patient_summary', {
      method: 'POST',
      body: JSON.stringify({ p_patient_id: patientId }),
    });
  }

  async getTreatmentDashboard() {
    return this.request<any>('/api/rest/v1/rpc/get_treatment_dashboard', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
