'use client';
import { useEffect, useRef, useCallback } from 'react';
import { minutesTill } from '@/lib/doseUtils';
import { sendLocalNotification } from '@/lib/firebase';
import { SupaFCM } from '@/lib/supabase';

const SNOOZE_DELAYS = [0, 15 * 60000, 30 * 60000, 60 * 60000]; // initial, +15, +30, +60 min

export function useNotifications(doses, userId) {
  const timers = useRef({});
  const snoozeCount = useRef({});

  const clearAll = useCallback(() => {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
  }, []);

  // Request permission and register SW
  const setup = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'denied') return false;

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return false;

    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch {}
    }
    return true;
  }, []);

  // Save FCM token for server-side push
  const saveFCMToken = useCallback(async () => {
    if (!userId) return;
    try {
      const { requestFCMToken } = await import('@/lib/firebase');
      const token = await requestFCMToken();
      if (token) await SupaFCM.saveToken(userId, token);
    } catch {}
  }, [userId]);

  // Schedule reminder chain for a single dose
  const scheduleDose = useCallback((dose) => {
    const key = `${dose.med_id}-${dose.hora}`;
    if (timers.current[key]) clearTimeout(timers.current[key]);

    const diff = minutesTill(dose.hora); // minutes until dose time
    const msUntilDose = diff * 60000;

    // Don't schedule if already passed by > 2h or already confirmed
    if (diff < -120 || dose.status === 'confirmed' || dose.status === 'missed') return;

    const snooze = snoozeCount.current[key] || 0;
    const extraDelay = snooze < SNOOZE_DELAYS.length ? SNOOZE_DELAYS[snooze] : null;
    if (extraDelay === null) return; // max reminders reached

    const fireAfterMs = Math.max(0, msUntilDose) + (snooze > 0 ? extraDelay : 0);

    timers.current[key] = setTimeout(async () => {
      // Re-check status hasn't been confirmed meanwhile
      if (dose.status === 'confirmed') return;
      await sendLocalNotification(dose);
    }, fireAfterMs);
  }, []);

  // Listen for SW messages (snooze action)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const handler = (event) => {
      if (event.data?.action === 'snooze' && event.data?.doseId) {
        const key = event.data.doseId;
        snoozeCount.current[key] = (snoozeCount.current[key] || 0) + 1;
        // Re-schedule with next snooze delay
        const dose = doses.find((d) => d.id === key);
        if (dose) scheduleDose(dose);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [doses, scheduleDose]);

  // Main effect: setup + schedule all active doses
  useEffect(() => {
    if (!doses?.length) return;

    (async () => {
      const granted = await setup();
      if (!granted) return;

      clearAll();
      doses
        .filter((d) => !['confirmed', 'missed'].includes(d.status))
        .forEach(scheduleDose);

      // Try to save FCM token (non-blocking)
      saveFCMToken().catch(() => {});
    })();

    return clearAll;
  }, [doses, setup, clearAll, scheduleDose, saveFCMToken]);

  return { setup };
}
