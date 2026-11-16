self.addEventListener("push", (event) => {
  let payload = { title: "Aayam", body: "", tag: "aayam-notice" };
  try {
    const parsed = event.data?.json();
    if (parsed && typeof parsed === "object") payload = { ...payload, ...parsed };
  } catch {
    const text = event.data?.text();
    if (text) payload.body = text;
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Aayam", {
      body: payload.body || "",
      tag: payload.tag || "aayam-notice",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow("/");
    }),
  );
});
