// Service Worker for Web Push notifications in the backoffice

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: event.data.text() };
  }

  const title = payload.title ?? "Backoffice";
  const options = {
    body: payload.body ?? "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: payload.tag ?? "default",
    renotify: true,
    data: { url: payload.url ?? "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.registration.scope) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      }),
  );
});
