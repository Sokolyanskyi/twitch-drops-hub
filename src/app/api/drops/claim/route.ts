import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { claimDrop } from "@/lib/drops";
import { TwitchError } from "@/lib/twitch";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  SUCCESS: "Дропс получен",
  DROP_INSTANCE_NOT_FOUND: "Twitch не нашёл этот дропс — обновите список",
  DROP_INSTANCE_ALREADY_CLAIMED: "Этот дропс уже получен",
  NOT_ELIGIBLE: "Аккаунт не участвует в кампании",
  CAMPAIGN_NOT_FOUND: "Кампания больше не активна",
  UNKNOWN: "Twitch не смог засчитать дропс",
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let claimId = "";
  try {
    const body = (await request.json()) as { claimId?: unknown };
    if (typeof body.claimId === "string") claimId = body.claimId.trim();
  } catch {
    claimId = "";
  }

  if (!claimId || claimId.length > 200) {
    return NextResponse.json({ error: "bad_request", message: "Некорректный идентификатор дропса" }, { status: 400 });
  }

  try {
    const result = await claimDrop(session.accessToken, claimId);
    return NextResponse.json({
      ok: result.ok,
      status: result.status,
      message: MESSAGES[result.status] ?? `Статус: ${result.status}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось забрать дропс";
    const status = error instanceof TwitchError && error.status === 401 ? 401 : 502;
    return NextResponse.json({ error: "claim_failed", message }, { status });
  }
}
