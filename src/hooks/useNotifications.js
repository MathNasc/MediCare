'use client';

import { useEffect, useCallback, useRef } from 'react';
import { SupaPush } from '@/lib/supabase';
import { subscribeToPush } from '@/lib/webPush';

/**
 * Hook de notificações.
 *
 * Ele cuida de duas coisas:
 * 1) Garante que existe uma inscrição de push válida para este dispositivo, 
 *    e mantê-la salva no Supabase (tabela push_subscriptions) para que 
 *    a Edge Function (`send-medication-reminders`) notifique mesmo com o app fechado.
 * 2) Funciona como FALLBACK LOCAL: enquanto o app estiver aberto na tela, 
 *    ele verifica a cada minuto se há medicamentos para agora e dispara o alerta
 *    diretamente pelo cliente (navegador).
 */
export function useNotifications(doses, userId) {
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

  // Fallback (Client-Side): Dispara notificações ativamente enquanto o app está aberto.
  // Isso resolve a falha caso o servidor/Supabase ou o Push em background atrase.
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!doses || !Array.isArray(doses) || doses.length === 0) return;

    // Checa a cada minuto se tem alguma dose para AGORA
    const interval = setInterval(() => {
      const now = new Date();
      const currentHour = String(now.getHours()).padStart(2, '0');
      const currentMin = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${currentHour}:${currentMin}`;

      doses.forEach((dose) => {
        // Dispara a notificação apenas no minuto exato e se a dose não tiver sido tomada
        if (dose.status !== 'confirmed' && dose.hora === timeStr) {
          try {
            new Notification(`💊 Hora do Medicamento: ${dose.nome}`, {
              body: `${dose.dosagem || ''} - Não se esqueça de registrar no aplicativo!`,
              icon: '/icons/icon-192x192.png',
              tag: `local-dose-${dose.id}`,
            });
          } catch (err) {
            console.error('Erro na notificação local', err);
          }
        }
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [doses]);

  /** Pede permissão (se necessário) e garante a inscrição — chamado pela UI (ex: ProfileScreen). */
  const setup = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    
    if (permission === 'denied') return false;
    
    const subscription = await subscribeToPush();
    if (!subscription) return false;
    
    await SupaPush.saveSubscription(userId, subscription);
    subscribed.current = true;
    return true;
  }, [userId]);

  return { setup };
}
