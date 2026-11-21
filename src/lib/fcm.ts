import {doc, getDoc, serverTimestamp, setDoc} from 'firebase/firestore';
import {getMessaging, getToken, isSupported, onMessage, type MessagePayload} from 'firebase/messaging';
import {auth, db, firebaseApp, handleFirestoreError, OperationType} from './firebase';

export interface PushEnableResult {
  permission: NotificationPermission;
  fcmToken: string | null;
  vapidConfigured: boolean;
  mode: 'fcm' | 'local-sw';
}

function getDeviceId(): string {
  const key = 'inventario_ia_device_id';
  try {
    const existing = window.localStorage.getItem(key);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return existing;
    }
    const generated = `dev_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    window.localStorage.setItem(key, generated);
    return generated;
  } catch {
    return `dev_${Date.now()}`;
  }
}

export function detectPlatform(): 'ios' | 'android' | 'web' {
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'web';
}

export function isIOSBrowserNotStandalone(): boolean {
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as {standalone?: boolean}).standalone === true;
  return isIOS && !isStandalone;
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    });
    return reg;
  } catch {
    return null;
  }
}

export async function enableDevicePushNotifications(userId: string): Promise<PushEnableResult> {
  if (!isBrowserNotificationSupported()) {
    throw new Error('Este navegador no admite notificaciones del dispositivo.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      permission,
      fcmToken: null,
      vapidConfigured: Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY),
      mode: 'local-sw',
    };
  }

  const swReg = await registerFcmServiceWorker();
  const vapidKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();
  const fcmSupported = await isSupported().catch(() => false);

  let fcmToken: string | null = null;
  if (fcmSupported && swReg && vapidKey) {
    try {
      const messaging = getMessaging(firebaseApp);
      fcmToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: swReg,
      });
    } catch {
      fcmToken = null;
    }
  }

  if (fcmToken && auth.currentUser?.uid === userId) {
    const deviceId = getDeviceId();
    const tokenPath = `users/${userId}/fcmTokens/${deviceId}`;
    const tokenRef = doc(db, tokenPath);
    try {
      const existingSnap = await getDoc(tokenRef);
      await setDoc(tokenRef, {
        userId,
        token: fcmToken,
        platform: detectPlatform(),
        deviceLabel: `${detectPlatform().toUpperCase()} · ${navigator.platform || 'Dispositivo'}`.slice(
          0,
          100,
        ),
        enabled: true,
        createdAt: existingSnap.exists()
          ? existingSnap.data().createdAt
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, tokenPath);
    }
  }

  return {
    permission,
    fcmToken,
    vapidConfigured: Boolean(vapidKey),
    mode: fcmToken ? 'fcm' : 'local-sw',
  };
}

export async function subscribeForegroundFcmMessages(
  onMessageReceived: (payload: MessagePayload) => void,
): Promise<() => void> {
  const supported = await isSupported().catch(() => false);
  if (!supported) return () => undefined;
  const messaging = getMessaging(firebaseApp);
  return onMessage(messaging, onMessageReceived);
}

export async function showDeviceNotification(options: {
  title: string;
  body: string;
  tag: string;
  url?: string;
}): Promise<boolean> {
  if (!isBrowserNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const notifOptions: NotificationOptions = {
    body: options.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: options.tag,
    data: {url: options.url || '/alertas'},
  };

  try {
    const reg =
      (await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope')) ||
      (await navigator.serviceWorker.getRegistration('/')) ||
      (await navigator.serviceWorker.ready.catch(() => undefined));

    if (reg && 'showNotification' in reg) {
      await reg.showNotification(options.title, notifOptions);
      return true;
    }
  } catch {
    // Respaldo a Notification API estándar
  }

  try {
    new Notification(options.title, notifOptions);
    return true;
  } catch {
    return false;
  }
}
