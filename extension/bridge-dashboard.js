/**
 * Runs on the Drops Hub dashboard. The app asks for the latest snapshot with a
 * postMessage request, and the extension answers with whatever is stored locally.
 */
(() => {
  "use strict";

  const SOURCE = "drops-hub-extension";
  const REQUEST = "drops-hub-app";
  const KEY_SNAPSHOT = "dropshub:snapshot";
  const KEY_CAPTURED_AT = "dropshub:capturedAt";

  function send() {
    try {
      chrome.storage.local.get([KEY_SNAPSHOT, KEY_CAPTURED_AT], (data) => {
        const snapshot = data && data[KEY_SNAPSHOT];
        if (!snapshot) return;
        window.postMessage(
          {
            source: SOURCE,
            snapshot,
            capturedAt: data[KEY_CAPTURED_AT] || null,
          },
          "*",
        );
      });
    } catch (error) {
      /* ignore storage failures */
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== REQUEST) return;
    send();
  });

  send();
  window.addEventListener("load", send, { once: true });
})();
