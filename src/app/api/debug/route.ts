import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { collectDiagnostics } from "@/lib/diagnostics";
import { gqlClientId, twitchClientId, WEB_GQL_CLIENT_ID } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Diagnostics for the current session: what Twitch thinks about the token.
 * Available only to an authenticated user; the token itself is never returned.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const diagnostics = await collectDiagnostics(session.accessToken);

  return NextResponse.json({
    session: {
      login: session.login,
      userId: session.userId,
      expiresAt: new Date(session.expiresAt).toISOString(),
      hasRefreshToken: Boolean(session.refreshToken),
    },
    config: {
      clientId: twitchClientId(),
      gqlClientId: gqlClientId(),
      webGqlClientId: WEB_GQL_CLIENT_ID,
    },
    ...diagnostics,
  });
}
