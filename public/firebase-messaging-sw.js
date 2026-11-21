/* eslint-disable no-undef */
importScripts('/firebase-sw-config.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

if (self.__FIREBASE_CONFIG__ && self.firebase) {
  self.firebase.initializeApp(self.__FIREBASE_CONFIG__);
  const messaging = self.firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || 'Alerta de Inventario Fácil IA';
    const body =
      payload?.notification?.body ||
      'Tienes prendas con bajo stock o próximas a caducar.';
    const rawUrl = payload?.data?.url;
    const targetUrl =
      typeof rawUrl === 'string' && rawUrl.startsWith('/') && !rawUrl.startsWith('//')
        ? rawUrl
        : '/alertas';

    return self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload?.data?.tag || 'inventario-alerta',
      data: {url: targetUrl},
    });
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data && event.notification.data.url;
  const targetUrl =
    typeof rawUrl === 'string' && rawUrl.startsWith('/') && !rawUrl.startsWith('//')
      ? rawUrl
      : '/alertas';

  event.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            void client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
