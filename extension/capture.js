/**
 * Runs in the page context on twitch.tv (MAIN world) and watches the GraphQL
 * traffic the page itself produces. When Twitch loads the Drops dashboard, the
 * payload is forwarded to the bridge script — nothing is modified or injected,
 * the extension only reads a response that the page already requested.
 */
(() => {
  "use strict";

  const SOURCE = "drops-hub-capture";
  const OPERATIONS = ["ViewerDropsDashboard", "Inventory"];
  const originalFetch = window.fetch;

  if (typeof originalFetch !== "function") return;

  function operationName(body) {
    if (typeof body !== "string") return "";
    const match = /"operationName"\s*:\s*"([^"]+)"/.exec(body);
    return match ? match[1] : "";
  }

  function forward(payload, body) {
    try {
      if (!OPERATIONS.includes(operationName(body))) return;
      const campaigns = payload && payload.data && payload.data.currentUser
        ? payload.data.currentUser.dropCampaigns
        : undefined;
      if (campaigns === undefined) return;
      window.postMessage({ source: SOURCE, payload, capturedAt: Date.now() }, "*");
    } catch (error) {
      /* never break the Twitch page */
    }
  }

  window.fetch = function (input, init) {
    const result = originalFetch.apply(this, arguments);

    try {
      const url = typeof input === "string" ? input : input && input.url ? input.url : "";
      if (url.indexOf("gql.twitch.tv") !== -1) {
        const body = init && init.body ? init.body : undefined;
        result
          .then((response) => {
            try {
              response
                .clone()
                .json()
                .then((payload) => forward(payload, body))
                .catch(() => {});
            } catch (error) {
              /* ignore */
            }
          })
          .catch(() => {});
      }
    } catch (error) {
      /* ignore */
    }

    return result;
  };
})();
