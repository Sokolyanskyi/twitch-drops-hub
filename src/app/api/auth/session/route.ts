import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { clearSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: session.userId,
      login: session.login,
      displayName: session.displayName,
      avatarUrl: session.avatarUrl,
    },
  });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
