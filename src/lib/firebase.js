'use client';
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.messagingSenderId
);

// Singleton app
let app = null;
let messaging = null;

export function getFirebaseApp() {
  if (!isConfigured || typeof window === 'undefined') return null;
  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
}

export async function getFirebaseMessaging() {
  if (!isConfigured || typeof window === 'undefined') return null;
  if (messaging) return messaging;
  try {
    const supported = await isSupported();
    if (!supported) return null;
    const firebaseApp = getFirebaseApp();
    if (!firebaseApp) return null;
    messaging = getMessaging(firebaseApp);
    return messaging;
  } catch {
    return null;
  }
}

// ─── Request permission + get FCM token ───────────────────────────────────────
export async function requestFCMToken() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const msg = await getFirebaseMessaging();
    if (!msg) return null;

    const token = await getToken(msg, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.register('/sw.js'),
    });

    return token || null;
  } catch (err) {
    console.error('FCM token error:', err);
    return null;
  }
}

// ─── Foreground message listener ─────────────────────────────────────────────
export async function onForegroundMessage(callback) {
  const msg = await getFirebaseMessaging();
  if (!msg) return () => {};
  return onMessage(msg, callback);
}

// ─── Send local notification (no server needed) ───────────────────────────────
export async function sendLocalNotification(dose, delayMs = 0) {
  if (typeof window === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  await new Promise((r) => setTimeout(r, delayMs));

  const sw = await navigator.serviceWorker.ready;
  await sw.showNotification(`💊 ${dose.nome}`, {
    body:             `${dose.dosagem} · ${dose.hora}`,
    icon:             '/icon-192.png',
    badge:            '/icon-96.png',
    vibrate:          [200, 100, 200],
    tag:              `dose-${dose.med_id}-${dose.hora}`,
    renotify:         true,
    requireInteraction: true,
    data: {
      doseId: dose.id,
      medId:  dose.med_id,
      hora:   dose.hora,
    },
    actions: [
      { action: 'confirm', title: '✓ Tomei agora' },
      { action: 'snooze',  title: '⏰ 15 minutos' },
    ],
  });
}

export const isFCMEnabled = isConfigured;
