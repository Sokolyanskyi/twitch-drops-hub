"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mockPayload } from "./mock";
import { normalizeSnapshot } from "./normalize";
import type { Campaign } from "./types";

/**
 * Bridge between the Drops Hub browser extension and the dashboard.
 *
 * The extension opens twitch.tv with the user's own session, captures the
 * `ViewerDropsDashboard` response of that page and stores it in
 * chrome.storage.local. On this domain the extension posts the captured payload
 * into the page, and the dashboard normalizes it. No tokens leave the browser.
 */

const CACHE_KEY = "dropshub:snapshot:v1";
const REQUEST_MESSAGE = { source: "drops-hub-app" };

export type BridgeSource = "extension" | "cache" | "mock" | null;

export type BridgeState = {
  status: "waiting" | "ready";
  campaigns: Campaign[];
  capturedAt: string | null;
  source: BridgeSource;
};

function readCache(): { campaigns: Campaign[]; capturedAt: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { campaigns?: unknown; capturedAt?: unknown };
    if (!Array.isArray(parsed.campaigns)) return null;
    return {
      campaigns: parsed.campaigns as Campaign[],
      capturedAt: String(parsed.capturedAt ?? ""),
    };
  } catch {
    return null;
  }
}

function writeCache(campaigns: Campaign[], capturedAt: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ campaigns, capturedAt }));
  } catch {
    /* storage can be full or blocked — ignore */
  }
}

export function useDropsBridge(mock = false) {
  const [state, setState] = useState<BridgeState>(() =>
    mock
      ? {
          status: "ready",
          campaigns: mockPayload().campaigns,
          capturedAt: new Date().toISOString(),
          source: "mock",
        }
      : { status: "waiting", campaigns: [], capturedAt: null, source: null },
  );
  const [requestCount, setRequestCount] = useState(0);
  const received = useRef(false);

  useEffect(() => {
    if (mock) return;

    const cached = readCache();
    if (cached) {
      setState({
        status: "ready",
        campaigns: cached.campaigns,
        capturedAt: cached.capturedAt,
        source: "cache",
      });
    }

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as
        | { source?: string; snapshot?: unknown; capturedAt?: number }
        | null
        | undefined;
      if (!data || data.source !== "drops-hub-extension" || !data.snapshot) return;

      const { campaigns } = normalizeSnapshot(data.snapshot);
      if (campaigns.length === 0) return;

      const capturedAt = data.capturedAt
        ? new Date(data.capturedAt).toISOString()
        : new Date().toISOString();

      received.current = true;
      setState({ status: "ready", campaigns, capturedAt, source: "extension" });
      writeCache(campaigns, capturedAt);
    };

    window.addEventListener("message", onMessage);

    const ask = () => window.postMessage(REQUEST_MESSAGE, "*");
    ask();
    const interval = window.setInterval(ask, 1500);
    const stop = window.setTimeout(() => window.clearInterval(interval), 20_000);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(interval);
      window.clearTimeout(stop);
    };
  }, [mock, requestCount]);

  const refresh = useCallback(() => {
    window.postMessage(REQUEST_MESSAGE, "*");
    setRequestCount((count) => count + 1);
  }, []);

  return { state, refresh };
}
