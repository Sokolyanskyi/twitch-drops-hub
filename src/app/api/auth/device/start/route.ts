import { NextResponse } from "next/server";
import { startDeviceFlow } from "@/lib/twitch";
import { writeDeviceState } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const device = await startDeviceFlow();
    await writeDeviceState({
      deviceCode: device.deviceCode,
      interval: device.interval,
      expiresAt: Date.now() + device.expiresIn * 1000,
      scopes: device.scopes,
    });

    return NextResponse.json({
      userCode: device.userCode,
      verificationUri: device.verificationUri,
      expiresIn: device.expiresIn,
      interval: device.interval,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось начать вход";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
