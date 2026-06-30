'use client';
import { useEffect, useCallback, useRef } from 'react';
import { SupaFCM } from '@/lib/supabase';

const SCHEDULE_KEY = 'mc_notif_schedule';

function minutesTill(hora) {
  const [h, m] = hora.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  return Math.round((target - now) / 60000);
}

function buildSchedule(doses) {
  const now = Date.now();
  const items = [];
  doses
    .filter(d => !['confirmed', 'missed'].includes(d.status))
    .forEach(dose => {
      const diff = minutesTill(dose.hora);
      [0, 15, 30].forEach((extra, i) => {
        const fireAt = now + (diff + extra) * 60000;
        if (fireAt > now + 30000) {
          items.push({
            id:     `${dose.med_id}-${dose.hora}-r${i}`,
            fireAt,
            title:  `💊 ${dose.nome}`,
            body:   `${dose.dosagem} · ${dose.hora}`,
            tag:    `dose-${dose.med_id}-${dose.hora}`,
            doseId: dose.id,
            medId:  dose.med_id,
            hora:   dose.hora,
          });
        }
      });
    });
  return items;
}

export function useNotifications(doses, userId) {
  const tokenSaved = useRef(false);

  // 1. Registra SW + bridge GET_SCHEDULE → SCHEDULE_DATA
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});

    const handler = async (event) => {
      if (event.data?.type !== 'GET_SCHEDULE') return;
      try {
        const raw = localStorage.getItem(SCHEDULE_KEY);
        const schedule = raw ? JSON.parse(raw) : [];
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({ type: 'SCHEDULE_DATA', schedule });
      } catch {}
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  // 2. Salva token FCM no Supabase (somente uma vez por sessão)
  const saveFCMToken = useCallback(async () => {
    if (!userId || tokenSaved.current) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const { requestFCMToken } = await import('@/lib/firebase');
      const token = await requestFCMToken();
      if (token) {
        await SupaFCM.saveToken(userId, token);
        tokenSaved.current = true;
      }
    } catch {}
  }, [userId]);

  // 3. Persiste schedule no localStorage + envia ao SW (fallback local)
  const syncSchedule = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!doses?.length) return;

    const schedule = buildSchedule(doses);
    try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule)); } catch {}

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({ type: 'SCHEDULE_DATA', schedule });
      } catch {}
    }
  }, [doses]);

  useEffect(() => {
    if (!doses?.length) return;
    syncSchedule();
    saveFCMToken();
  }, [doses, syncSchedule, saveFCMToken]);

  // 4. Pede permissão + salva token FCM
  const setup = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'denied') return false;
    if (Notification.permission === 'default') {
      const r = await Notification.requestPermission();
      if (r !== 'granted') return false;
    }
    await saveFCMToken();
    return true;
  }, [saveFCMToken]);

  return { setup };
}
