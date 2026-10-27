import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { clearSession } from "@/lib/session";
import { fetchCampaigns } from "@/lib/drops";
import { collectDiagnostics } from "@/lib/diagnostics";
import { TwitchError } from "@/lib/twitch";
import type { CampaignsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.DROPS_MOCK === "1") {
    const { mockPayload } = await import("@/lib/mock");
    return NextResponse.json(mockPayload());
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const campaigns = await fetchCampaigns(session.accessToken, session.userId);
    const payload: CampaignsResponse = {
      user: {
        id: session.userId,
        login: session.login,
        displayName: session.displayName,
        avatarUrl: session.avatarUrl,
      },
      campaigns,
      fetchedAt: new Date().toISOString(),
    };
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof TwitchError && error.status === 401) {
      await clearSession();
      return NextResponse.json(
        { error: "session_expired", message: "Токен Twitch больше не действует — войдите заново." },
        { status: 401 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Не удалось получить список кампаний";

    let summary = "";
    try {
      summary = (await collectDiagnostics(session.accessToken)).summary;
    } catch {
      summary = "";
    }

    return NextResponse.json(
      { error: "twitch_error", message: summary ? `${message} | ${summary}` : message },
      { status: 502 },
    );
  }
}
