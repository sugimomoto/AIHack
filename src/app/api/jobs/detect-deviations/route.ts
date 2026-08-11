import { NextResponse } from "next/server";
import { todayJst } from "@/lib/today";

/**
 * 逸脱の日次検知
 *
 * ★Cloud Scheduler から呼ばれる。OIDC で認証する。
 *
 * ★現状は検知のみで、通知は行わない。
 *   通知は S10 の設計（相手に何をどう伝えるか）が決まってからにする。
 *   **決めていないことを、動かしてしまわない。**
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // ★Scheduler 以外から叩かれないようにする
  const expected = process.env.JOB_TOKEN;
  if (!expected || req.headers.get("x-job-token") !== expected) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { listCaseIds } = await import("@/infra-adapters/firestore/repositories/caseRepository");
  const { loadSchedule } = await import("@/services/schedule");
  const { asPartyId } = await import("@/domain/case/types");
  const { loadForLlm } = await import("@/infra-adapters/firestore/repositories/caseRepository");
  const { asCaseId } = await import("@/domain/case/types");

  const today = todayJst();
  const caseIds = await listCaseIds();
  let detected = 0;

  for (const caseId of caseIds) {
    try {
      const snap = await loadForLlm(asCaseId(caseId));
      // ★退会者を選ぶと assertOwnParty で弾かれ、そのケースの逸脱が
      //   恒久的に検知されなくなる（レビューで検出）
      const anyParty = snap.parties.find((p) => p.state !== "WITHDRAWN");
      if (!anyParty) continue;
      const r = await loadSchedule({ caseId, partyId: asPartyId(anyParty.id), today });
      detected += r.deviations.length;
    } catch (e) {
      // ★1件の失敗で全体を止めない
      console.warn("[job] ケースの検知に失敗しました", e);
    }
  }

  return NextResponse.json({ cases: caseIds.length, deviations: detected });
}
