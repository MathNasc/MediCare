'use client';

import { useEffect, useCallback, useRef } from 'react';
import { SupaPush } from '@/lib/supabase';
import { subscribeToPush } from '@/lib/webPush';

/**
 * Hook de notificações — versão Web Push (VAPID).
 *
 * Toda a lógica de "agendar" lembretes é feita no servidor. Quem decide quando
 * notificar é a Edge Function `send-medication-reminders`, disparada a cada
 * minuto via pg_cron no servidor (Supabase).
 * 
 * Este hook cuida apenas de: registrar o SW, garantir que existe uma
 * inscrição de push válida para este dispositivo, e mantê-la salva no
 * Supabase (tabela push_subscriptions).
 */
export function useNotifications(_doses, userId) {
  const subscribed = useRef(false);

  const ensureSubscription = useCallback(async () => {
    if (!userId || subscribed.current) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    
    // Só tenta silenciosamente se a permissão já foi concedida antes;
    // pedir permissão "do nada" sem gesto do usuário é ignorado pelo navegador.
    if (Notification.permission !== 'granted') return;
    
    const subscription = await subscribeToPush();
    if (subscription) {
      await SupaPush.saveSubscription(userId, subscription);
      subscribed.current = true;
    }
  }, [userId]);

  useEffect(() => {
    ensureSubscription();
  }, [ensureSubscription]);

  /** Pede permissão (se necessário) e garante a inscrição — chamado pela UI (ex: ProfileScreen). */
  const setup = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    
    if (Notification.permission === 'denied') return false;
    
    const subscription = await subscribeToPush();
    if (!subscription) return false;
    
    await SupaPush.saveSubscription(userId, subscription);
    subscribed.current = true;
    return true;
  }, [userId]);

  return { setup };
}
