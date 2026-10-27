import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { gqlClientId, twitchClientId, WEB_GQL_CLIENT_ID } from "@/lib/config";

export const dynamic = "force-dynamic";

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 7.1; Smart Box C1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MINIMAL_QUERY = "query Debug { currentUser { id login } }";

async function probe(url: string, init: RequestInit) {
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 600) };
  } catch (error) {
    return { status: 0, body: error instanceof Error ? error.message : String(error) };
  }
}

function gqlProbe(token: string, clientId: string, scheme: "OAuth" | "Bearer") {
  return probe("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      "Client-Id": clientId,
      Authorization: `${scheme} ${token}`,
      "Content-Type": "text/plain;charset=UTF-8",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ operationName: "Debug", query: MINIMAL_QUERY }),
  });
}

/**
 * Диагностика входа: показывает, что Twitch думает о текущем токене.
 * Открывается только для авторизованного пользователя.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = session.accessToken;

  const [validate, helix] = await Promise.all([
    probe("https://id.twitch.tv/oauth2/validate", {
      headers: { Authorization: `OAuth ${token}` },
    }),
    probe("https://api.twitch.tv/helix/users", {
      headers: { "Client-Id": twitchClientId(), Authorization: `Bearer ${token}` },
    }),
  ]);

  const [oauthPrimary, bearerPrimary, oauthWeb, bearerWeb] = await Promise.all([
    gqlProbe(token, gqlClientId(), "OAuth"),
    gqlProbe(token, gqlClientId(), "Bearer"),
    gqlProbe(token, WEB_GQL_CLIENT_ID, "OAuth"),
    gqlProbe(token, WEB_GQL_CLIENT_ID, "Bearer"),
  ]);

  return NextResponse.json({
    session: {
      login: session.login,
      userId: session.userId,
      tokenLength: token.length,
      expiresAt: new Date(session.expiresAt).toISOString(),
      hasRefreshToken: Boolean(session.refreshToken),
    },
    config: {
      clientId: twitchClientId(),
      gqlClientId: gqlClientId(),
      webGqlClientId: WEB_GQL_CLIENT_ID,
    },
    validate,
    helix,
    gql: {
      primaryOAuth: oauthPrimary,
      primaryBearer: bearerPrimary,
      webOAuth: oauthWeb,
      webBearer: bearerWeb,
    },
  });
}
