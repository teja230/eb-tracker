export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => registration.unregister());
      });

      if ("caches" in window) {
        caches.keys().then(keys => {
          keys
            .filter(key => key.startsWith("eb-tracker-"))
            .forEach(key => caches.delete(key));
        });
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(error => {
      console.warn("Service worker registration failed", error);
    });
  });
}
