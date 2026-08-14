import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";
import { asCaseId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import {
  discardOwnDrafts,
  loadForLlm,
} from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * ご自身の下書きを消す
 *
 * ★消せるのは、**渡していない自分の仮案だけ。**
 *   お渡ししたものと、合意済みのものには触れない。
 *   **双方が合意したものを、片方が消せてはいけない。**
 *
 * ★お相手には何も起きない。見えていないものを消すだけである。
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const snap = await loadForLlm(asCaseId(caseId));
    assertOwnParty(snap, partyId);

    const removed = await discardOwnDrafts(asCaseId(caseId), partyId);
    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    return errorResponse(e);
  }
}
