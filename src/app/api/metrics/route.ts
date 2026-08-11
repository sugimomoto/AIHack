import { NextResponse } from "next/server";
import { computeMetrics } from "@/services/metrics";
import { readSession } from "@/lib/session";

/**
 * ★認証を要求する。
 *
 *   応答に caseId も partyId も含まれないが、無認証で叩けると
 *   **inputTokens の差分から「いつ・どれくらいの長さの発言があったか」**が
 *   外から取れる。稼働ケースが少ないうちは、特定の当事者の発話トレースに
 *   等しくなる（レビューで検出）。
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await readSession())) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  return NextResponse.json(await computeMetrics());
}
