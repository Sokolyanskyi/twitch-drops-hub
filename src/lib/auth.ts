import { readSession, writeSession, type Session } from "./session";
import { refreshAccessToken } from "./twitch";

/**
 * Returns the current session, refreshing the access token when needed.
 */
export async function getSession(): Promise<Session | null> {
  const session = await readSession();
  if (!session) return null;
  if (session.expiresAt > Date.now() + 30_000) return session;
  if (!session.refreshToken) return session;

  const refreshed = await refreshAccessToken(session.refreshToken);
  if (!refreshed) return session;

  const next: Session = {
    ...session,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? session.refreshToken,
    expiresAt: refreshed.expiresAt,
  };
  await writeSession(next);
  return next;
}
