import { twitchClientId, twitchClientSecret } from "./config";

const OAUTH_BASE = "https://id.twitch.tv/oauth2";
const GQL_URL = "https://gql.twitch.tv/gql";
const HELIX_URL = "https://api.twitch.tv/helix";

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 7.1; Smart Box C1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export class TwitchError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = "TwitchError";
    this.status = status;
    this.code = code;
  }
}

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
};

export type DeviceStart = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
  scopes: string;
};

export type DevicePoll =
  | { status: "pending" }
  | { status: "slow_down" }
  | { status: "expired" }
  | { status: "denied" }
  | { status: "ok"; token: TokenSet };

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text.slice(0, 300) };
  }
}

async function tokenRequest(params: Record<string, string>): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const url = new URL(`${OAUTH_BASE}/token`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  return { ok: res.ok, status: res.status, data: await readJson(res) };
}

export function toTokenSet(data: Record<string, unknown>): TokenSet {
  const expiresIn = Number(data.expires_in ?? 0) || 0;
  return {
    accessToken: String(data.access_token ?? ""),
    refreshToken: data.refresh_token ? String(data.refresh_token) : null,
    expiresAt: Date.now() + expiresIn * 1000 - 60_000,
  };
}

/**
 * Starts the Device Code Flow: the user enters a short code at twitch.tv/activate.
 * The Twitch password is never sent to this application and never stored anywhere.
 */
export async function startDeviceFlow(): Promise<DeviceStart> {
  const scopeCandidates = ["", "user:read:email"];
  let last: TwitchError | null = null;

  for (const scopes of scopeCandidates) {
    const url = new URL(`${OAUTH_BASE}/device`);
    url.searchParams.set("client_id", twitchClientId());
    url.searchParams.set("scopes", scopes);

    const res = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    const data = await readJson(res);

    if (res.ok && typeof data.device_code === "string") {
      return {
        deviceCode: data.device_code,
        userCode: String(data.user_code ?? ""),
        verificationUri: String(data.verification_uri ?? "https://www.twitch.tv/activate"),
        expiresIn: Number(data.expires_in ?? 1800),
        interval: Number(data.interval ?? 5),
        scopes,
      };
    }

    last = new TwitchError(
      String(data.message ?? "Twitch отклонил запрос на вход"),
      res.status,
    );
  }

  throw last ?? new TwitchError("Не удалось начать вход через Twitch");
}

export async function pollDeviceFlow(deviceCode: string, scopes: string): Promise<DevicePoll> {
  const { ok, status, data } = await tokenRequest({
    client_id: twitchClientId(),
    scopes,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });

  if (ok && typeof data.access_token === "string") {
    return { status: "ok", token: toTokenSet(data) };
  }

  const message = String(data.message ?? "");
  if (message === "authorization_pending" || status === 400) {
    if (message === "slow_down") return { status: "slow_down" };
    if (message === "expired_token") return { status: "expired" };
    if (message === "access_denied") return { status: "denied" };
    return { status: "pending" };
  }
  if (message === "expired_token") return { status: "expired" };

  return { status: "pending" };
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenSet | null> {
  const params: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: twitchClientId(),
  };
  const secret = twitchClientSecret();
  if (secret) params.client_secret = secret;

  const { ok, data } = await tokenRequest(params);
  if (!ok || typeof data.access_token !== "string") return null;

  const next = toTokenSet(data);
  if (!next.refreshToken) next.refreshToken = refreshToken;
  return next;
}

export type TwitchUser = {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string;
};

export async function fetchTwitchUser(accessToken: string): Promise<TwitchUser> {
  const res = await fetch(`${HELIX_URL}/users`, {
    headers: {
      "Client-Id": twitchClientId(),
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = await readJson(res);
  const users = (data.data as Array<Record<string, unknown>> | undefined) ?? [];
  const user = users[0];
  if (!res.ok || !user) {
    throw new TwitchError("Не удалось получить профиль Twitch", res.status);
  }
  return {
    id: String(user.id),
    login: String(user.login),
    displayName: String(user.display_name ?? user.login),
    avatarUrl: String(user.profile_image_url ?? ""),
  };
}

/** Request to the internal Twitch GraphQL API (the same one twitch.tv uses). */
export async function gqlRequest<T = Record<string, unknown>>(
  body: unknown,
  accessToken: string,
  clientId: string = twitchClientId(),
): Promise<T> {
  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: {
      "Client-Id": clientId,
      Authorization: `OAuth ${accessToken}`,
      "Content-Type": "text/plain;charset=UTF-8",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const data = await readJson(res);
  if (!res.ok) {
    throw new TwitchError(
      String(data.message ?? `Twitch ответил кодом ${res.status}`),
      res.status,
    );
  }
  return data as T;
}
