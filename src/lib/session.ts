import { cookies, headers } from "next/headers";
import { SESSION_TTL_SECONDS } from "./config";
import { seal, unseal } from "./seal";

export const SESSION_COOKIE = "dh_session";
export const DEVICE_COOKIE = "dh_device";

export type Session = {
  userId: string;
  login: string;
  displayName: string;
  avatarUrl: string;
  accessToken: string;
  refreshToken: string | null;
  /** Unix time (ms) when the access token expires. */
  expiresAt: number;
};

export type DeviceState = {
  deviceCode: string;
  interval: number;
  expiresAt: number;
  scopes: string;
};

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

/**
 * On Vercel requests arrive with x-forwarded-proto: https — the cookie is marked Secure then.
 * Locally over http the Secure flag is omitted, otherwise the browser would not send the cookie.
 */
async function cookieBase() {
  const requestHeaders = await headers();
  const proto = requestHeaders.get("x-forwarded-proto") ?? "";
  return { ...COOKIE_BASE, secure: proto.split(",")[0]?.trim() === "https" };
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  return unseal<Session>(jar.get(SESSION_COOKIE)?.value);
}

export async function writeSession(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, seal(session), {
    ...(await cookieBase()),
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...(await cookieBase()), maxAge: 0 });
}

export async function readDeviceState(): Promise<DeviceState | null> {
  const jar = await cookies();
  return unseal<DeviceState>(jar.get(DEVICE_COOKIE)?.value);
}

export async function writeDeviceState(state: DeviceState): Promise<void> {
  const jar = await cookies();
  jar.set(DEVICE_COOKIE, seal(state), {
    ...(await cookieBase()),
    maxAge: Math.max(60, Math.floor((state.expiresAt - Date.now()) / 1000)),
  });
}

export async function clearDeviceState(): Promise<void> {
  const jar = await cookies();
  jar.set(DEVICE_COOKIE, "", { ...(await cookieBase()), maxAge: 0 });
}
