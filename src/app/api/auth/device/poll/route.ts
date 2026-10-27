import { NextResponse } from "next/server";
import { fetchTwitchUser, pollDeviceFlow } from "@/lib/twitch";
import { clearDeviceState, readDeviceState, writeSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const state = await readDeviceState();
  if (!state) {
    return NextResponse.json({ status: "expired" }, { status: 410 });
  }

  if (state.expiresAt <= Date.now()) {
    await clearDeviceState();
    return NextResponse.json({ status: "expired" }, { status: 410 });
  }

  try {
    const result = await pollDeviceFlow(state.deviceCode, state.scopes);

    if (result.status === "ok") {
      const user = await fetchTwitchUser(result.token.accessToken);
      await writeSession({
        userId: user.id,
        login: user.login,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        accessToken: result.token.accessToken,
        refreshToken: result.token.refreshToken,
        expiresAt: result.token.expiresAt,
      });
      await clearDeviceState();
      return NextResponse.json({ status: "ok", user });
    }

    if (result.status === "expired" || result.status === "denied") {
      await clearDeviceState();
      return NextResponse.json({ status: result.status }, { status: 410 });
    }

    return NextResponse.json({ status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка проверки кода";
    return NextResponse.json({ status: "error", error: message }, { status: 502 });
  }
}
