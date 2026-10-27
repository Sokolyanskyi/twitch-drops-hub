/**
 * Runs in the extension context on twitch.tv. Receives the payload captured from
 * the page and stores the latest snapshot locally.
 */
(() => {
  "use strict";

  const SOURCE = "drops-hub-capture";
  const KEY_SNAPSHOT = "dropshub:snapshot";
  const KEY_CAPTURED_AT = "dropshub:capturedAt";

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== SOURCE || !data.payload) return;

    try {
      chrome.storage.local.set({
        [KEY_SNAPSHOT]: data.payload,
        [KEY_CAPTURED_AT]: data.capturedAt || Date.now(),
      });
    } catch (error) {
      /* ignore storage failures */
    }
  });
})();
