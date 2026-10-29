/**
 * profileDb.js
 *
 * Serviço de perfil de saúde, alergias, condições médicas e contatos de emergência.
 * Utiliza databaseClient para persistência remota e localStorage para modo local.
 */

import { databaseClient, isDatabaseConfigured } from './databaseClient';

function getLocal(key, fallback = []) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal(key, val) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(val));
  }
}

function renderSquareAvatarToDataUrl(source, width, height, rotateDeg = 0) {
  const MAX_SIZE = 512;
  const side = Math.min(width, height);
  const sx = Math.max(0, (width - side) / 2);
  const sy = Math.max(0, (height - side) / 2);
  const outSize = Math.min(MAX_SIZE, side || MAX_SIZE);

  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.save();
  ctx.translate(outSize / 2, outSize / 2);
  if (rotateDeg) {
    ctx.rotate((rotateDeg * Math.PI) / 180);
  }
  ctx.drawImage(source, sx, sy, side, side, -outSize / 2, -outSize / 2, outSize, outSize);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.85);
}

async function processAvatarFile(file, rotateDeg = 0) {
  if (typeof window === 'undefined' || !file) return null;

  // Prefer createImageBitmap with imageOrientation: 'from-image' so EXIF orientation is respected
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const dataUrl = renderSquareAvatarToDataUrl(bitmap, bitmap.width, bitmap.height, rotateDeg);
      if (typeof bitmap.close === 'function') bitmap.close();
      if (dataUrl) return dataUrl;
    } catch {
      // Fallback to HTMLImageElement below
    }
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const dataUrl = renderSquareAvatarToDataUrl(img, img.naturalWidth || img.width, img.naturalHeight || img.height, rotateDeg);
        resolve(dataUrl || reader.result);
      };
      img.onerror = () => resolve(reader.result);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function rotateDataUrlImage(srcUrl, rotateDeg = 90) {
  if (typeof window === 'undefined' || !srcUrl) return null;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || img.width || 512;
      const h = img.naturalHeight || img.height || 512;
      const dataUrl = renderSquareAvatarToDataUrl(img, w, h, rotateDeg);
      resolve(dataUrl || srcUrl);
    };
    img.onerror = () => resolve(null);
    img.src = srcUrl;
  });
}

export const ProfileDB = {
  async getProfile(userId) {
    if (!isDatabaseConfigured || !databaseClient) {
      const stored = getLocal('mc_local_profile_' + userId, null);
      if (stored) return stored;
      let userObj = null;
      if (typeof window !== 'undefined') {
        try { userObj = JSON.parse(localStorage.getItem('mc_local_user') || 'null'); } catch (e) {}
      }
      const initialProfile = {
        id: userId,
        nome: userObj?.nome || '',
        email: userObj?.email || '',
        tipo_sanguineo: '',
        role: userObj?.role || 'independente',
        emergency_settings: { onboarding_completed: false },
      };
      setLocal('mc_local_profile_' + userId, initialProfile);
      return initialProfile;
    }
    const { data } = await databaseClient.from('profiles').select('*').eq('id', userId).single();
    if (data && (!data.emergency_settings || data.emergency_settings.onboarding_completed === undefined)) {
      // Garantir flag de onboarding no objeto retornado
      data.emergency_settings = { ...(data.emergency_settings || {}), onboarding_completed: false };
    }
    return data;
  },
  async updateProfile(userId, payload) {
    if (!isDatabaseConfigured || !databaseClient) {
      const current = await this.getProfile(userId);
      const updated = { ...current, ...payload };
      setLocal('mc_local_profile_' + userId, updated);
      return true;
    }
    const { error } = await databaseClient.from('profiles').update(payload).eq('id', userId);
    if (error) console.error('updateProfile error:', error);
    return !error;
  },
  async uploadAvatar(userId, file) {
    const processedDataUrl = await processAvatarFile(file, 0);
    if (!processedDataUrl) return null;

    if (!isDatabaseConfigured || !databaseClient) {
      return processedDataUrl;
    }

    const filePath = `${userId}/avatar-${Date.now()}.jpg`;
    try {
      await databaseClient.storage
        .from('avatars')
        .upload(filePath, processedDataUrl, { upsert: true });
    } catch (e) {
      console.warn('uploadAvatar storage fallback:', e);
    }

    return processedDataUrl;
  },
  async rotateAvatar(userId, currentFotoUrl, rotateDeg = 90) {
    const rotatedDataUrl = await rotateDataUrlImage(currentFotoUrl, rotateDeg);
    if (!rotatedDataUrl) return null;
    await this.updateProfile(userId, { foto_url: rotatedDataUrl });
    return rotatedDataUrl;
  },
  async listAllergies(userId) {
    if (!isDatabaseConfigured || !databaseClient) return getLocal('mc_local_allergies_' + userId, []);
    const { data } = await databaseClient.from('allergies').select('*').eq('user_id', userId).order('created_at');
    return data || [];
  },
  async addAllergy(userId, name) {
    if (!isDatabaseConfigured || !databaseClient) {
      const list = getLocal('mc_local_allergies_' + userId, []);
      const item = { id: 'allergy-' + Date.now(), user_id: userId, name, created_at: new Date().toISOString() };
      list.push(item);
      setLocal('mc_local_allergies_' + userId, list);
      return item;
    }
    const { data, error } = await databaseClient.from('allergies').insert({ user_id: userId, name }).select().single();
    if (error) console.error('addAllergy error:', error);
    return data;
  },
  async deleteAllergy(id) {
    if (!isDatabaseConfigured || !databaseClient) {
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('mc_local_allergies_')) {
            const list = getLocal(k, []).filter(item => item.id !== id);
            setLocal(k, list);
          }
        }
      }
      return;
    }
    await databaseClient.from('allergies').delete().eq('id', id);
  },
  async listConditions(userId) {
    if (!isDatabaseConfigured || !databaseClient) return getLocal('mc_local_conditions_' + userId, []);
    const { data } = await databaseClient.from('health_conditions').select('*').eq('user_id', userId).order('created_at');
    return data || [];
  },
  async addCondition(userId, payload) {
    if (!isDatabaseConfigured || !databaseClient) {
      const list = getLocal('mc_local_conditions_' + userId, []);
      const item = { id: 'cond-' + Date.now(), ...payload, user_id: userId, created_at: new Date().toISOString() };
      list.push(item);
      setLocal('mc_local_conditions_' + userId, list);
      return item;
    }
    const { data, error } = await databaseClient.from('health_conditions').insert({ ...payload, user_id: userId }).select().single();
    if (error) console.error('addCondition error:', error);
    return data;
  },
  async deleteCondition(id) {
    if (!isDatabaseConfigured || !databaseClient) {
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('mc_local_conditions_')) {
            const list = getLocal(k, []).filter(item => item.id !== id);
            setLocal(k, list);
          }
        }
      }
      return;
    }
    await databaseClient.from('health_conditions').delete().eq('id', id);
  },
  async listEmergencyContacts(userId) {
    if (!isDatabaseConfigured || !databaseClient) return getLocal('mc_local_emergency_contacts_' + userId, []);
    const { data } = await databaseClient.from('emergency_contacts').select('*').eq('user_id', userId).order('priority');
    return data || [];
  },
  async addEmergencyContact(userId, payload) {
    const rel = payload.relationship || payload.relation || '';
    const normalized = { ...payload, relation: rel, relationship: rel };
    if (!isDatabaseConfigured || !databaseClient) {
      const list = getLocal('mc_local_emergency_contacts_' + userId, []);
      const item = { id: 'emg-' + Date.now(), ...normalized, user_id: userId, created_at: new Date().toISOString() };
      list.push(item);
      setLocal('mc_local_emergency_contacts_' + userId, list);
      return item;
    }
    const { data, error } = await databaseClient.from('emergency_contacts').insert({ ...normalized, user_id: userId }).select().single();
    if (error) console.error('addEmergencyContact error:', error);
    return data;
  },
  async updateEmergencyContact(id, payload) {
    const rel = payload.relationship ?? payload.relation;
    const normalized = rel !== undefined ? { ...payload, relation: rel, relationship: rel } : payload;
    if (!isDatabaseConfigured || !databaseClient) {
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('mc_local_emergency_contacts_')) {
            const list = getLocal(k, []).map(item => item.id === id ? { ...item, ...normalized } : item);
            setLocal(k, list);
          }
        }
      }
      return true;
    }
    const { error } = await databaseClient.from('emergency_contacts').update(normalized).eq('id', id);
    return !error;
  },
  async deleteEmergencyContact(id) {
    if (!isDatabaseConfigured || !databaseClient) {
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('mc_local_emergency_contacts_')) {
            const list = getLocal(k, []).filter(item => item.id !== id);
            setLocal(k, list);
          }
        }
      }
      return;
    }
    await databaseClient.from('emergency_contacts').delete().eq('id', id);
  },
  async listProfessionals(userId) {
    if (!isDatabaseConfigured || !databaseClient) return getLocal('mc_local_professionals_' + userId, []);
    const { data } = await databaseClient.from('healthcare_professionals').select('*').eq('user_id', userId).order('created_at');
    return data || [];
  },
  async addProfessional(userId, payload) {
    if (!isDatabaseConfigured || !databaseClient) {
      const list = getLocal('mc_local_professionals_' + userId, []);
      const item = { id: 'prof-' + Date.now(), ...payload, user_id: userId, created_at: new Date().toISOString() };
      list.push(item);
      setLocal('mc_local_professionals_' + userId, list);
      return item;
    }
    const { data, error } = await databaseClient.from('healthcare_professionals').insert({ ...payload, user_id: userId }).select().single();
    if (error) console.error('addProfessional error:', error);
    return data;
  },
  async updateProfessional(id, payload) {
    if (!isDatabaseConfigured || !databaseClient) {
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('mc_local_professionals_')) {
            const list = getLocal(k, []).map(item => item.id === id ? { ...item, ...payload } : item);
            setLocal(k, list);
          }
        }
      }
      return true;
    }
    const { error } = await databaseClient.from('healthcare_professionals').update(payload).eq('id', id);
    return !error;
  },
  async deleteProfessional(id) {
    if (!isDatabaseConfigured || !databaseClient) {
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('mc_local_professionals_')) {
            const list = getLocal(k, []).filter(item => item.id !== id);
            setLocal(k, list);
          }
        }
      }
      return;
    }
    await databaseClient.from('healthcare_professionals').delete().eq('id', id);
  }
};

export const profileService = ProfileDB;
