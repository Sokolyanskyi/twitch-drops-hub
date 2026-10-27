/**
 * Application configuration.
 *
 * TWITCH_CLIENT_ID — Twitch application client id.
 * By default a public client id of the Twitch Smart TV client is used: it supports
 * the Device Code Flow, so sign-in works right after deployment without registering
 * an application. A custom client id can be created at
 * https://dev.twitch.tv/console/apps
 */
const DEFAULT_CLIENT_ID = "ue6666qo983tsx6so1t0vnawi233wa";

export function twitchClientId(): string {
  return process.env.TWITCH_CLIENT_ID?.trim() || DEFAULT_CLIENT_ID;
}

export function twitchClientSecret(): string | null {
  const value = process.env.TWITCH_CLIENT_SECRET?.trim();
  return value ? value : null;
}

/**
 * Client id used for requests to gql.twitch.tv.
 * If GraphQL rejects the token of the primary client id, the public web client id
 * of Twitch is used instead.
 */
export const WEB_GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

export function gqlClientId(): string {
  return process.env.TWITCH_GQL_CLIENT_ID?.trim() || twitchClientId();
}

/**
 * Key used to encrypt the token cookie.
 * When SESSION_SECRET is not set, a predictable development key is used — no user
 * data is stored on the server anyway, but setting a secret is still recommended
 * (see README).
 */
export function sessionSecret(): string {
  const value = process.env.SESSION_SECRET?.trim();
  if (value && value.length >= 16) return value;
  return "drops-hub-dev-secret-do-not-use-in-production";
}

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days
