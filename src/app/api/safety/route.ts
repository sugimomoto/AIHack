import { NextResponse } from "next/server";
import { listPendingSafetyEvents } from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * ★運営が読む。当事者には決して返さない。
 *
 *   原文を含むため、**セッションでは開けない。**
 *   当事者のセッションでこれが開けると、
 *   自分以外の記録に到達する経路ができてしまう。
 *
 * ★通告するかどうかは、これを読んだ人が決める。
 *   このAPIに「通告する」操作は無い。**自動化の入口を作らない。**
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || req.headers.get("x-admin-token") !== expected) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  return NextResponse.json({ items: await listPendingSafetyEvents(50) });
}
