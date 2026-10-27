import { gqlClientId, twitchClientId, WEB_GQL_CLIENT_ID } from "./config";

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 7.1; Smart Box C1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MINIMAL_QUERY = "query Debug { currentUser { id login } }";

export type Probe = { status: number; body: string };

export type GqlCheck = Probe & { auth: string | null };

async function probe(url: string, init: RequestInit): Promise<Probe> {
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 600) };
  } catch (error) {
    return { status: 0, body: error instanceof Error ? error.message : String(error) };
  }
}

function classify(probe: Probe): string {
  if (probe.status === 401) return "401";
  if (probe.status === 0) return "network";
  try {
    const parsed = JSON.parse(probe.body) as {
      data?: { currentUser?: { id?: string } | null };
      errors?: unknown[];
    };
    if (parsed?.data?.currentUser && parsed.data.currentUser.id) return "ok";
    if (parsed?.data && "currentUser" in parsed.data) return "null";
    if (parsed?.errors) return "graphql-error";
  } catch {
    return "parse-error";
  }
  return `http-${probe.status}`;
}

async function gqlCheck(token: string, clientId: string, scheme: "OAuth" | "Bearer"): Promise<GqlCheck> {
  const result = await probe("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      "Client-Id": clientId,
      Authorization: `${scheme} ${token}`,
      "Content-Type": "text/plain;charset=UTF-8",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ operationName: "Debug", query: MINIMAL_QUERY }),
  });
  return { ...result, auth: classify(result) };
}

/**
 * Checks what Twitch thinks about the current token: OAuth validation, Helix access
 * and GraphQL auth under both client ids. Used by /api/debug and by the campaign error path.
 */
export async function collectDiagnostics(token: string) {
  const primary = gqlClientId();
  const web = WEB_GQL_CLIENT_ID;

  const [validate, helix, primaryOAuth, primaryBearer, webOAuth, webBearer] = await Promise.all([
    probe("https://id.twitch.tv/oauth2/validate", {
      headers: { Authorization: `OAuth ${token}` },
    }),
    probe("https://api.twitch.tv/helix/users", {
      headers: { "Client-Id": twitchClientId(), Authorization: `Bearer ${token}` },
    }),
    gqlCheck(token, primary, "OAuth"),
    gqlCheck(token, primary, "Bearer"),
    gqlCheck(token, web, "OAuth"),
    gqlCheck(token, web, "Bearer"),
  ]);

  let validateInfo: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(validate.body) as Record<string, unknown>;
    validateInfo = {
      status: validate.status,
      clientId: parsed.client_id,
      login: parsed.login,
      scopes: parsed.scopes,
      expiresInDays: parsed.expires_in ? Math.round(Number(parsed.expires_in) / 86400) : undefined,
    };
  } catch {
    validateInfo = { status: validate.status, raw: validate.body };
  }

  const summary = [
    `token:${validate.status}${validateInfo.clientId ? `(${String(validateInfo.clientId)})` : ""}`,
    `helix:${helix.status}`,
    `gql[${primary.slice(0, 6)}/OAuth]=${primaryOAuth.auth}`,
    `gql[${web.slice(0, 6)}/OAuth]=${webOAuth.auth}`,
  ].join(" ");

  return {
    summary,
    token: token.length,
    validate: validateInfo,
    helix: { status: helix.status },
    gql: {
      primaryOAuth: { auth: primaryOAuth.auth, status: primaryOAuth.status, body: primaryOAuth.body },
      primaryBearer: { auth: primaryBearer.auth, status: primaryBearer.status, body: primaryBearer.body },
      webOAuth: { auth: webOAuth.auth, status: webOAuth.status, body: webOAuth.body },
      webBearer: { auth: webBearer.auth, status: webBearer.status, body: webBearer.body },
    },
  };
}
