import React, {useEffect, useRef} from 'react';
import {useAuth} from '../context/AuthContext';
import {useInventory} from '../context/InventoryContext';
import {useToast} from '../context/ToastContext';
import {
  registerFcmServiceWorker,
  showDeviceNotification,
  subscribeForegroundFcmMessages,
} from '../lib/fcm';

const SESSION_NOTIFIED_KEY = 'inventario_ia_notified_alerts_v1';

function getNotifiedSet(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(SESSION_NOTIFIED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveNotifiedSet(set: Set<string>) {
  try {
    window.sessionStorage.setItem(SESSION_NOTIFIED_KEY, JSON.stringify(Array.from(set).slice(-80)));
  } catch {
    // Ignorar errores de almacenamiento
  }
}

export const PushNotificationMonitor: React.FC = () => {
  const {user} = useAuth();
  const {alerts, notificationPrefs, loadingData} = useInventory();
  const {showToast} = useToast();
  const initializedRef = useRef(false);

  // Registra Service Worker de FCM y escucha mensajes entrantes en primer plano
  useEffect(() => {
    if (!user) return;
    void registerFcmServiceWorker();

    let unsubscribe: () => void = () => {};
    void subscribeForegroundFcmMessages((payload) => {
      const title = payload.notification?.title || 'Alerta de inventario';
      const body =
        payload.notification?.body ||
        'Revisa tus prendas con bajo stock o próximas a caducar.';
      showToast(`${title}: ${body}`, 'info');
      void showDeviceNotification({
        title,
        body,
        tag: payload.messageId || 'fcm-foreground',
        url: '/alertas',
      });
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      unsubscribe();
    };
  }, [user, showToast]);

  // Monitorea alertas en tiempo real y dispara notificación en el dispositivo para nuevas alertas
  useEffect(() => {
    if (!user || loadingData || !notificationPrefs.pushEnabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const notified = getNotifiedSet();
    const relevant = alerts.filter((a) => {
      const isExpiryAlert = a.severity === 'caducada' || a.severity === 'proxima_a_caducar';
      if (isExpiryAlert && !notificationPrefs.expiringEnabled) return false;
      if (!isExpiryAlert && !notificationPrefs.lowStockEnabled) return false;
      return true;
    });

    // En la primera carga tras abrir la app, solo notifica las 2 más urgentes no vistas aún
    const toDispatch = relevant
      .filter((a) => !notified.has(`${a.product.id}:${a.severity}:${a.product.quantity}`))
      .slice(0, initializedRef.current ? 3 : 1);

    initializedRef.current = true;

    if (toDispatch.length === 0) return;

    for (const item of toDispatch) {
      notified.add(`${item.product.id}:${item.severity}:${item.product.quantity}`);
      const isExpiry = item.severity === 'caducada' || item.severity === 'proxima_a_caducar';
      const title = isExpiry
        ? item.severity === 'caducada'
          ? `Prenda caducada: ${item.product.name}`
          : `Próxima a caducar: ${item.product.name}`
        : item.severity === 'agotado'
          ? `Agotado: ${item.product.name}`
          : `Stock bajo: ${item.product.name}`;

      const body = isExpiry
        ? `${item.contextText} (${item.spaceName}).`
        : `Quedan ${item.product.quantity} uds en ${item.spaceName} (mínimo ${item.product.minStock}).`;

      void showDeviceNotification({
        title,
        body,
        tag: `alerta-${item.product.id}`,
        url: '/alertas',
      });
    }

    saveNotifiedSet(notified);
  }, [user, loadingData, alerts, notificationPrefs]);

  return null;
};
