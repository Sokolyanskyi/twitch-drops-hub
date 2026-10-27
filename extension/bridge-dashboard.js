/**
 * Runs on the Drops Hub dashboard. The app asks for the latest snapshot with a
 * postMessage request, and the extension answers with whatever is stored locally.
 *
 * Works in Chromium (chrome.*) and Firefox / Zen (browser.*): both expose a
 * promise-based storage.local in MV3.
 */
(() => {
  "use strict";

  const api = typeof browser !== "undefined" ? browser : chrome;
  const SOURCE = "drops-hub-extension";
  const REQUEST = "drops-hub-app";
  const KEY_SNAPSHOT = "dropshub:snapshot";
  const KEY_CAPTURED_AT = "dropshub:capturedAt";

  async function send() {
    try {
      const data = await api.storage.local.get([KEY_SNAPSHOT, KEY_CAPTURED_AT]);
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
    } catch (error) {
      /* ignore storage failures */
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== REQUEST) return;
    void send();
  });

  void send();
  window.addEventListener("load", () => void send(), { once: true });
})();
