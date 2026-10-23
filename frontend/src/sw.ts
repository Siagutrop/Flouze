/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string })[];
};

// Précache des assets générés par le build (injectés par vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);

// SPA : fallback navigation, sauf les appels API
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//],
  }),
);

// Notifications push : rappels d'inactivité envoyés par le backend
self.addEventListener('push', (event) => {
  const data = (event.data?.json() ?? {}) as {
    title?: string;
    body?: string;
    url?: string;
  };
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Flouze', {
      body: data.body ?? '',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: data.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c) as WindowClient | undefined;
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
