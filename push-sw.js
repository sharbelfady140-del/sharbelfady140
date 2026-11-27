self.addEventListener('push', (event) => {
  let payload = {
    title: 'مصروفي',
    body: 'عندك تنبيه جديد بخصوص ميزانيتك أو فواتيرك.',
    url: '/',
    tag: 'masrofy-alert',
    actions: [],
    captureId: null,
    token: null,
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag,
    dir: 'rtl',
    lang: 'ar',
    data: {
      url: payload.url || '/',
      captureId: payload.captureId || null,
      token: payload.token || null,
    },
  };

  if (Array.isArray(payload.actions) && payload.actions.length > 0) {
    options.actions = payload.actions;
  }

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  const notifData = event.notification.data || {};
  const action = event.action || '';
  event.notification.close();

  if (action === 'confirm-capture' && notifData.captureId) {
    event.waitUntil(
      (async () => {
        try {
          await fetch('/api/capture/ack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: notifData.captureId,
              token: notifData.token || '',
              status: 'confirmed',
            }),
          });
        } catch {
          // Will retry when app opens
        }
        const clientList = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of clientList) {
          client.postMessage({
            type: 'MASROFY_CAPTURE_CONFIRMED',
            captureId: notifData.captureId,
          });
        }
      })()
    );
    return;
  }

  let targetUrl = notifData.url || '/';
  if (action === 'widget-add') {
    targetUrl = '/?action=add-expense';
  } else if (action === 'edit-capture' && notifData.captureId) {
    targetUrl = `/?edit_capture=${encodeURIComponent(notifData.captureId)}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (action && 'navigate' in client) {
            void client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});

