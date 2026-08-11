import { NextResponse } from "next/server";
import { clearSession, readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** 現在のセッション。★partyId と caseId のみ */
export async function GET() {
  const s = await readSession();
  return NextResponse.json(s ? { signedIn: true, ...s } : { signedIn: false });
}

/** ログアウト */
export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
