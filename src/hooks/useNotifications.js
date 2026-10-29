'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { pushSubscriptionService } from '@/lib/databaseClient';
import { isPushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/webPush';
import { ProfileDB } from '@/lib/profileDb';

const NOTIF_SYNC_EVENT = 'mc-notifications-changed';

function isManuallyDisabled(userId) {
  if (typeof window === 'undefined') return false;
  try {
    if (userId && localStorage.getItem(`mc_push_disabled_${userId}`) === '1') return true;
    return localStorage.getItem('mc_push_disabled') === '1';
  } catch {
    return false;
  }
}

function setManuallyDisabled(userId, disabled) {
  if (typeof window === 'undefined') return;
  try {
    if (disabled) {
      localStorage.setItem('mc_push_disabled', '1');
      if (userId) localStorage.setItem(`mc_push_disabled_${userId}`, '1');
    } else {
      localStorage.removeItem('mc_push_disabled');
      if (userId) localStorage.removeItem(`mc_push_disabled_${userId}`);
    }
  } catch {}
}

/**
 * Hook de notificações — versão Web Push (VAPID).
 *
 * Cuida de solicitar permissão na abertura do app caso não esteja ativa,
 * registrar o Service Worker e manter a inscrição de push salva no banco.
 */
export function useNotifications(_doses, userId) {
  const subscribed = useRef(false);
  const startupAttempted = useRef(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [checked, setChecked] = useState(false);

  const syncSubscriptionToServer = useCallback(async (uid) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission !== 'granted') return false;

    if (!isPushSupported()) {
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        } catch {}
      }
      subscribed.current = true;
      setIsSubscribed(true);
      return true;
    }

    let subscription = await subscribeToPush();
    if (!subscription) {
      setIsSubscribed(false);
      return false;
    }

    if (uid) {
      try {
        await pushSubscriptionService.saveSubscription(uid, subscription);
      } catch (err) {
        console.warn('[MediCare] Falha ao salvar subscription. Renovando...', err);
        await unsubscribeFromPush();
        subscription = await subscribeToPush();
        if (subscription) {
          await pushSubscriptionService.saveSubscription(uid, subscription);
        } else {
          setIsSubscribed(false);
          return false;
        }
      }
    }

    subscribed.current = true;
    setIsSubscribed(true);
    return true;
  }, []);

  const ensureSubscription = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setChecked(true);
      return;
    }

    setPermission(Notification.permission);

    if (isManuallyDisabled(userId)) {
      setIsSubscribed(false);
      setChecked(true);
      return;
    }

    // Tenta solicitar permissão automaticamente na abertura do app caso ainda seja 'default'
    if (Notification.permission === 'default' && !startupAttempted.current) {
      startupAttempted.current = true;
      try {
        const result = await Notification.requestPermission();
        setPermission(result);
      } catch {}
    }

    if (Notification.permission === 'granted') {
      await syncSubscriptionToServer(userId);
    } else {
      setIsSubscribed(false);
    }

    setChecked(true);
  }, [userId, syncSubscriptionToServer]);

  useEffect(() => {
    ensureSubscription();
  }, [ensureSubscription]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSync = (e) => {
      const detail = e?.detail;
      if (detail) {
        if (typeof detail.isSubscribed === 'boolean') setIsSubscribed(detail.isSubscribed);
        if (detail.permission) setPermission(detail.permission);
      } else if ('Notification' in window) {
        setPermission(Notification.permission);
        setIsSubscribed(Notification.permission === 'granted' && !isManuallyDisabled(userId));
      }
    };
    window.addEventListener(NOTIF_SYNC_EVENT, handleSync);
    return () => window.removeEventListener(NOTIF_SYNC_EVENT, handleSync);
  }, [userId]);

  /** Pede permissão (se necessário) e garante a inscrição — chamado pela UI (modal inicial ou ProfileScreen). */
  const setup = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;

    setManuallyDisabled(userId, false);

    if (Notification.permission === 'default') {
      try {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result !== 'granted') return false;
      } catch {
        return false;
      }
    } else {
      setPermission(Notification.permission);
    }

    if (Notification.permission !== 'granted') return false;

    const ok = await syncSubscriptionToServer(userId);
    if (ok && userId) {
      ProfileDB.updateProfile(userId, { notifications_enabled: true }).catch(() => {});
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(NOTIF_SYNC_EVENT, {
          detail: { isSubscribed: ok, permission: Notification.permission },
        })
      );
    }
    return ok;
  }, [userId, syncSubscriptionToServer]);

  /** Remove a inscrição deste aparelho */
  const disable = useCallback(async () => {
    setManuallyDisabled(userId, true);
    const endpoint = await unsubscribeFromPush();
    if (endpoint) {
      await pushSubscriptionService.removeSubscription(endpoint);
    }
    if (userId) {
      ProfileDB.updateProfile(userId, { notifications_enabled: false }).catch(() => {});
    }
    subscribed.current = false;
    setIsSubscribed(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(NOTIF_SYNC_EVENT, {
          detail: { isSubscribed: false, permission: Notification.permission },
        })
      );
    }
    return true;
  }, [userId]);

  return { setup, disable, isSubscribed, permission, checked };
}
