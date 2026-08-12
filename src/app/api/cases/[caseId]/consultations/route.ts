import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";
import { asCaseId } from "@/domain/case/types";
import { assertOwnParty, scopedInbound } from "@/domain/case/scope";
import {
  DEFAULT_THREAD_ID,
  DEFAULT_TITLE,
  threadIdOfConsultation,
} from "@/domain/consultation/thread";
import { consultStateOf } from "@/domain/consultation/state";
import {
  listConsultations,
  loadForLlm,
} from "@/infra-adapters/firestore/repositories/caseRepository";
import { listScenarios } from "@/infra-adapters/firestore/repositories/masterRepository";

/**
 * K-1 相談の一覧
 *
 * ★自分の相談だけ。**未読の印も件数バッジも持たない。**
 * ★どれから話しても順番は無い。並びは更新の新しい順。
 * ★各行に**一行の状態**を出す。数ではなく、いまどうなっているか。
 */
export async function GET(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const snap = await loadForLlm(asCaseId(caseId));
    assertOwnParty(snap, partyId);

    const [rows, scenarios] = await Promise.all([
      listConsultations(asCaseId(caseId), partyId),
      listScenarios().catch(() => []),
    ]);

    // ★合意済かどうかは、相談ではなく**論点**の状態で決まる
    const agreed = new Set(
      snap.agreementItems.filter((a) => a.status === "AGREED").map((a) => a.topic),
    );
    // ★「済んだ」と言えるのは、その取り決めを決めるための相談だけ（FORMAL）。
    //   「塾の費用」は養育費に紐づくが、養育費が合意済でも**別件**である。
    //   ここを分けないと、始まってもいない相談が済んだものに沈む。
    const settledOf = new Map(
      scenarios.map((s) => [
        s.id,
        s.kind === "FORMAL" && s.linkedTopic ? s.linkedTopic : null,
      ]),
    );

    // ★自分が最後に書いた時刻（相談ごと）
    const lastOwn = new Map<string, string>();
    for (const m of snap.messages) {
      if (m.partyId !== partyId || m.role !== "USER") continue;
      const cur = lastOwn.get(m.consultationId) ?? "";
      if (m.createdAt > cur) lastOwn.set(m.consultationId, m.createdAt);
    }

    // ★自分宛の取次ぎが最後に届いた時刻（スレッドごと）
    const lastIn = new Map<string, string>();
    for (const e of snap.mediationEvents) {
      if (e.toPartyId !== partyId) continue;
      const th = e.threadId ?? (e.scenarioId ? `th_${e.scenarioId}` : DEFAULT_THREAD_ID);
      const cur = lastIn.get(th) ?? "";
      if ((e.createdAt ?? "") > cur) lastIn.set(th, e.createdAt ?? "");
    }

    const items = rows.map((r) => {
      // ★スレッドを持たない古い相談にも、開くための鍵を与える
      const threadId = r.threadId ?? threadIdOfConsultation(r.id, partyId);
      const topic = r.scenarioId ? settledOf.get(r.scenarioId) : null;
      return {
        ...r,
        threadId,
        title: r.title ?? DEFAULT_TITLE,
        state: consultStateOf({
          lastOwnAt: lastOwn.get(r.id) ?? null,
          lastInboundAt: lastIn.get(threadId) ?? null,
          settled: Boolean(topic && agreed.has(topic)),
        }),
      };
    });

    return NextResponse.json({
      items,
      // ★届いているご相談。相手の言葉ではない
      inbound: scopedInbound(snap, partyId),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
