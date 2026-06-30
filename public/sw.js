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
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: payload.tag ?? "default",
    renotify: true,
    data: { url: payload.url ?? "/" },
  };

  event.waitUntil(
    (async () => {
      // suppressWhenFocused (ex.: chat): se a app estiver VISÍVEL numa janela,
      // não mostra a notificação do sistema — já há toast/badge in-app.
      if (payload.suppressWhenFocused) {
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        const appVisible = clients.some((c) => c.visibilityState === "visible");
        if (appVisible) return;
      }
      await self.registration.showNotification(title, options);
    })(),
  );
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
