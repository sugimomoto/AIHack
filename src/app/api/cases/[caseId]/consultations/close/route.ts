import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../../messages/route";
import { asCaseId, asConsultationId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import { consultationIdOf, parseThreadId } from "@/domain/consultation/thread";
import {
  loadForLlm,
  setConsultationStatus,
} from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * 相談を閉じる／戻す。
 *
 * ★済んだものが残り続けると、対応が要るものが埋もれる。
 * ★消さない。沈めるだけ。**あとから戻せる。**
 */
export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const snap = await loadForLlm(asCaseId(caseId));
    assertOwnParty(snap, partyId);

    const { threadId, status } = (await req.json().catch(() => ({}))) as {
      threadId?: string;
      status?: string;
    };
    const next = status === "OPEN" ? "OPEN" : "CLOSED";
    // ★自分の相談しか閉じられない。IDは自分の当事者IDから組み立てる
    const consultationId = consultationIdOf(partyId, parseThreadId(threadId));

    await setConsultationStatus(asCaseId(caseId), asConsultationId(consultationId), next);
    return NextResponse.json({ ok: true, status: next });
  } catch (e) {
    return errorResponse(e);
  }
}
