'use client';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

// Converte a chave pública VAPID (base64 URL-safe) para Uint8Array,
// formato exigido pela PushManager API do navegador.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  Boolean(VAPID_PUBLIC_KEY);

/**
 * Pede permissão de notificação (se necessário) e inscreve o dispositivo
 * atual no Web Push. Retorna a subscription em formato JSON simples
 * ({ endpoint, keys: { p256dh, auth } }) pronta para salvar no Supabase,
 * ou null se não suportado / permissão negada.
 */
export async function subscribeToPush() {
  if (!isPushSupported()) return null;
  if (Notification.permission === 'denied') return null;

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    return sub.toJSON();
  } catch (err) {
    console.error('Erro ao inscrever no Web Push:', err);
    return null;
  }
}

/** Cancela a inscrição de push do dispositivo atual (ex: ao fazer logout). */
export async function unsubscribeFromPush() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      return endpoint;
    }
  } catch {}
  return null;
}
