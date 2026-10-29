/**
 * databaseClient.js — Camada de Abstração de Banco de Dados e Autenticação
 *
 * Isola o acesso remoto ao PostgreSQL (Oracle Cloud / API REST e Auth v1)
 * para toda a aplicação web.
 */

const databaseUrl = process.env.NEXT_PUBLIC_DATABASE_URL || '';
const databaseApiKey = process.env.NEXT_PUBLIC_DATABASE_KEY || '';

export const isDatabaseConfigured = Boolean(databaseUrl && databaseApiKey);

const SESSION_STORAGE_KEY = 'mc_auth_session';

function getStoredSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredSession(session) {
  if (typeof window === 'undefined') return;
  try {
    if (session) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {}
}

function getAuthHeaders(extra = {}) {
  const session = getStoredSession();
  const token = session?.access_token || databaseApiKey;
  return {
    'Content-Type': 'application/json',
    ...(databaseApiKey ? { apikey: databaseApiKey } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

class QueryBuilder {
  constructor(baseUrl, table) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.table = table;
    this.method = 'GET';
    this.selectCols = '*';
    this.filters = [];
    this.orderClause = null;
    this.limitVal = null;
    this.bodyData = null;
    this.expectSingle = false;
    this.maybeSingleFlag = false;
    this.returnRepresentation = false;
  }

  select(cols = '*') {
    this.selectCols = cols;
    if (this.method !== 'GET') {
      this.returnRepresentation = true;
    }
    return this;
  }

  insert(payload) {
    this.method = 'POST';
    this.bodyData = payload;
    return this;
  }

  update(payload) {
    this.method = 'PATCH';
    this.bodyData = payload;
    return this;
  }

  upsert(payload) {
    this.method = 'POST';
    this.bodyData = payload;
    this.isUpsert = true;
    return this;
  }

  delete() {
    this.method = 'DELETE';
    return this;
  }

  eq(col, val) {
    if (val !== undefined) this.filters.push([col, `eq.${val}`]);
    return this;
  }

  neq(col, val) {
    if (val !== undefined) this.filters.push([col, `neq.${val}`]);
    return this;
  }

  in(col, vals) {
    if (Array.isArray(vals)) this.filters.push([col, `in.(${vals.join(',')})`]);
    return this;
  }

  gte(col, val) {
    if (val !== undefined && val !== null) this.filters.push([col, `gte.${val}`]);
    return this;
  }

  lte(col, val) {
    if (val !== undefined && val !== null) this.filters.push([col, `lte.${val}`]);
    return this;
  }

  or(expr) {
    this.filters.push(['or', `(${expr})`]);
    return this;
  }

  textSearch(col, query) {
    this.filters.push([col, `fts.${query}`]);
    return this;
  }

  order(col, { ascending = true } = {}) {
    this.orderClause = `${col}.${ascending ? 'asc' : 'desc'}`;
    return this;
  }

  limit(n) {
    this.limitVal = n;
    return this;
  }

  single() {
    this.expectSingle = true;
    return this;
  }

  maybeSingle() {
    this.maybeSingleFlag = true;
    return this;
  }

  async execute() {
    try {
      const params = new URLSearchParams();
      if (this.selectCols) params.set('select', this.selectCols);
      for (const [k, v] of this.filters) params.append(k, v);
      if (this.orderClause) params.set('order', this.orderClause);
      if (this.limitVal != null) params.set('limit', String(this.limitVal));

      const prefer = [];
      if (this.returnRepresentation) prefer.push('return=representation');
      if (this.isUpsert) prefer.push('resolution=merge-duplicates');

      const res = await fetch(`${this.baseUrl}/api/rest/v1/${this.table}?${params.toString()}`, {
        method: this.method,
        headers: getAuthHeaders(prefer.length ? { Prefer: prefer.join(',') } : {}),
        body: this.bodyData !== null ? JSON.stringify(this.bodyData) : undefined,
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (!res.ok) {
        return { data: null, error: new Error(json?.message || json?.error || `HTTP ${res.status}`) };
      }

      if (this.expectSingle || this.maybeSingleFlag) {
        const item = Array.isArray(json) ? (json[0] ?? null) : json;
        if (this.expectSingle && !item) {
          return { data: null, error: new Error('Registro não encontrado') };
        }
        return { data: item, error: null };
      }

      return { data: json, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

function createNativeDatabaseClient(baseUrl) {
  const cleanUrl = baseUrl.replace(/\/$/, '');

  return {
    from(table) {
      return new QueryBuilder(cleanUrl, table);
    },
    async rpc(fnName, args = {}) {
      try {
        const res = await fetch(`${cleanUrl}/api/rest/v1/rpc/${fnName}`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(args),
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        if (!res.ok) {
          return { data: null, error: new Error(data?.message || data?.error || `RPC ${fnName} failed`) };
        }
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    auth: {
      async signUp({ email, password, options }) {
        try {
          const res = await fetch(`${cleanUrl}/api/auth/v1/signup`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ email, password, data: options?.data || {} }),
          });
          const data = await res.json();
          if (!res.ok) return { data: null, error: new Error(data.error || data.msg || data.error_description || 'Falha no cadastro') };
          if (data.access_token) setStoredSession(data);
          return { data: { user: data.user || data, session: data }, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
      async signInWithPassword({ email, password }) {
        try {
          const res = await fetch(`${cleanUrl}/api/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();
          if (!res.ok) return { data: null, error: new Error(data.error || data.error_description || data.msg || 'Credenciais inválidas') };
          setStoredSession(data);
          return { data: { user: data.user, session: data }, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
      async signOut() {
        try {
          await fetch(`${cleanUrl}/api/auth/v1/logout`, {
            method: 'POST',
            headers: getAuthHeaders(),
          });
        } catch {}
        setStoredSession(null);
        return { error: null };
      },
      async getSession() {
        const session = getStoredSession();
        return { data: { session }, error: null };
      },
      async getUser() {
        const session = getStoredSession();
        if (!session?.access_token) return { data: { user: null }, error: null };
        try {
          const res = await fetch(`${cleanUrl}/api/auth/v1/user`, {
            headers: getAuthHeaders(),
          });
          if (!res.ok) return { data: { user: session.user || null }, error: null };
          const user = await res.json();
          return { data: { user }, error: null };
        } catch {
          return { data: { user: session.user || null }, error: null };
        }
      },
      async updateUser(payload) {
        try {
          const res = await fetch(`${cleanUrl}/api/auth/v1/user`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) return { data: null, error: new Error(data.error || data.msg || 'Erro ao atualizar usuário') };
          return { data: { user: data }, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
      async resetPasswordForEmail(email) {
        try {
          const res = await fetch(`${cleanUrl}/api/auth/v1/recover`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ email }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return { error: new Error(data.error || data.msg || 'Erro ao solicitar recuperação de senha') };
          }
          return { error: null };
        } catch (error) {
          return { error };
        }
      },
    },
    storage: {
      from(bucket) {
        return {
          async upload(path, file) {
            try {
              const reader = new FileReader();
              const dataUrl = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
              this._lastDataUrl = dataUrl;
              return { data: { path }, error: null };
            } catch (error) {
              return { data: null, error };
            }
          },
          getPublicUrl(path) {
            return { data: { publicUrl: this._lastDataUrl || `/storage/${bucket}/${path}` } };
          },
        };
      },
    },
    functions: {
      async invoke(fnName, { body } = {}) {
        try {
          const res = await fetch(`${cleanUrl}/api/v1/jobs/${fnName}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: body ? JSON.stringify(body) : undefined,
          });
          const data = await res.json().catch(() => null);
          return { data, error: res.ok ? null : new Error(`Function ${fnName} error`) };
        } catch (error) {
          return { data: null, error };
        }
      },
    },
  };
}

export const databaseClient = isDatabaseConfigured
  ? createNativeDatabaseClient(databaseUrl)
  : null;

// ─── Auth helpers ─────────────────────────────────────────────────────────────
export const authService = {
  async signUp(emailOrOpts, passwordArg, nomeArg, roleArg = 'independente') {
    const opts =
      typeof emailOrOpts === 'object' && emailOrOpts !== null
        ? emailOrOpts
        : { email: emailOrOpts, password: passwordArg, nome: nomeArg, role: roleArg };
    const { data, error } = await databaseClient.auth.signUp({
      email: opts.email,
      password: opts.password,
      options: { data: { nome: opts.nome, role: opts.role || 'independente' } },
    });
    return { data, error };
  },

  async signIn(emailOrOpts, passwordArg) {
    const opts =
      typeof emailOrOpts === 'object' && emailOrOpts !== null
        ? emailOrOpts
        : { email: emailOrOpts, password: passwordArg };
    const { data, error } = await databaseClient.auth.signInWithPassword({
      email: opts.email,
      password: opts.password,
    });
    return { data, error };
  },

  async signOut() {
    const { error } = await databaseClient.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data } = await databaseClient.auth.getSession();
    return data.session;
  },

  async getProfile(userId) {
    const { data, error } = await databaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data;
  },

  async getProfileRole(userId) {
    const prof = await this.getProfile(userId);
    return prof?.role || 'independente';
  },

  async updateRole(userId, role) {
    const { error } = await databaseClient.from('profiles').update({ role }).eq('id', userId);
    const { error: authError } = await databaseClient.auth.updateUser({ data: { role } });
    return !error && !authError;
  },

  async resetPassword(email) {
    const { error } = await databaseClient.auth.resetPasswordForEmail(email);
    return { error };
  },
};

// ─── Medicamentos ─────────────────────────────────────────────────────────────
export const medicationService = {
  async list(userId) {
    const { data, error } = await databaseClient
      .from('medicamentos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async create(med) {
    const { data, error } = await databaseClient
      .from('medicamentos')
      .insert(med)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async add(med) {
    return this.create(med);
  },

  async update(id, fields) {
    const { data, error } = await databaseClient
      .from('medicamentos')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await databaseClient
      .from('medicamentos')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    return this.remove(id);
  },
};

// ─── Histórico de doses ───────────────────────────────────────────────────────
export const historyService = {
  async list(userId, limit = 100) {
    const { data, error } = await databaseClient
      .from('historico_doses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async add(entry) {
    const { data, error } = await databaseClient
      .from('historico_doses')
      .insert(entry)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await databaseClient
      .from('historico_doses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    return this.remove(id);
  },
};

// ─── Cuidadores ───────────────────────────────────────────────────────────────
export const caregiverRelationshipService = {
  async listForPatient(pacienteId) {
    const { data, error } = await databaseClient
      .from('caregiver_relationships')
      .select('*')
      .eq('patient_id', pacienteId)
      .eq('status', 'active');
    if (error) return [];
    return (data || []).map((r) => ({ ...r, cuidador_id: r.caregiver_id || r.cuidador_id }));
  },

  async list(pacienteId) {
    return this.listForPatient(pacienteId);
  },

  async invite({ pacienteId, email }) {
    const { data, error } = await databaseClient
      .from('caregiver_relationships')
      .insert({ patient_id: pacienteId, invite_email: email, status: 'pending' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await databaseClient.from('caregiver_relationships').delete().eq('id', id);
    if (error) throw error;
  },
};

// ─── Web Push Subscriptions ───────────────────────────────────────────────────
export const pushSubscriptionService = {
  async saveSubscription(userId, sub) {
    if (!databaseClient || !sub?.endpoint) return;
    const keys = sub.toJSON?.()?.keys || sub.keys || {};
    await databaseClient.from('push_subscriptions').upsert({
      user_id:    userId,
      endpoint:   sub.endpoint,
      p256dh:     keys.p256dh || '',
      auth:       keys.auth   || '',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : '',
      timezone:   Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
      updated_at: new Date().toISOString(),
    });
  },

  async removeSubscription(endpoint) {
    if (!databaseClient || !endpoint) return;
    await databaseClient.from('push_subscriptions').delete().eq('endpoint', endpoint);
  },
};
