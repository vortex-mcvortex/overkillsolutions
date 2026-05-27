export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
  });
}

export function isRunningStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}
