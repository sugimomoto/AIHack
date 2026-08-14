import { NextResponse } from "next/server";

/**
 * 逸脱の日次検知 — ★いまは何もしない
 *
 * ★Cloud Scheduler から呼ばれる。トークンで認証する。
 *   経路は残してあるが、**検知はしない。**（理由は下に）
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // ★Scheduler 以外から叩かれないようにする
  const expected = process.env.JOB_TOKEN;
  if (!expected || req.headers.get("x-job-token") !== expected) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  // ★★ 逸脱の検知をやめた。
  //
  //   毎月「支払いました」「入金を確認しました」を押してもらう前提だったが、
  //   **手間で押されない。**押されないと「確認できていません」と出て、
  //   実際には払っているのに疑いが立つ。
  //
  //   > 記録率が低い台帳は、正しい信号より誤った信号を多く出す。
  //
  //   ★検知のロジック（detectDeviations）は残してある。
  //     Issue #7（証跡と精算）で、**手で押させない形**にして作り直す。
  const { listCaseIds } = await import("@/infra-adapters/firestore/repositories/caseRepository");
  const caseIds = await listCaseIds();

  return NextResponse.json({
    cases: caseIds.length,
    deviations: 0,
    note: "逸脱の検知は行っていません（→ Issue #7）",
  });
}

