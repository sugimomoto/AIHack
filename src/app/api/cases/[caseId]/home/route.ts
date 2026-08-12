import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";
import { asCaseId } from "@/domain/case/types";
import { assertOwnParty, scopedInbound } from "@/domain/case/scope";
import { IMPLEMENTED_TOPICS, TOPIC_LABEL } from "@/domain/agreement/topics";
import { loadForLlm } from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * ホームに出すもの。
 *
 * ★件数はここでも返すが、**バッジのためではなく文言に埋めるため**である。
 * ★取次ぎの本文はすでに検査を通ったものだけ（C1）。ここで原文は触らない。
 */
export async function GET(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const snap = await loadForLlm(asCaseId(caseId));
    assertOwnParty(snap, partyId);

    const inbound = scopedInbound(snap, partyId);

    // ★扱える論点だけを並べる。**扱えないものを進捗の分母にしない。**
    const byTopic = new Map(snap.agreementItems.map((a) => [a.topic, a.status]));
    const topics = IMPLEMENTED_TOPICS.map((t) => ({
      topic: t,
      label: TOPIC_LABEL[t],
      status: byTopic.get(t) ?? "NOT_STARTED",
    }));

    return NextResponse.json({
      inboundCount: inbound.length,
      latestInbound: inbound.at(-1)?.content ?? null,
      topics,
      decided: topics.filter((t) => t.status === "AGREED").length,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
