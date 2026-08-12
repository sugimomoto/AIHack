import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";
import { asCaseId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import { parseThreadId } from "@/domain/consultation/thread";
import { adjustmentStateOf } from "@/domain/adjustment/record";
import {
  listAdjustmentsByThread,
  loadForLlm,
} from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * 調整（ADJUSTMENT の相談の帰結）
 *
 * ★公正証書には載らない。取り決めにも触れない。
 *   だが**どこにも現れないと、話し合った意味が残らない。**
 */
export async function GET(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const snap = await loadForLlm(asCaseId(caseId));
    assertOwnParty(snap, partyId);

    const threadId = parseThreadId(new URL(req.url).searchParams.get("threadId"));
    const entries = await listAdjustmentsByThread(asCaseId(caseId), threadId);
    const parties = snap.parties.map((p) => p.id as string);

    // ★自分が出したものだけ内容を返す。相手の案そのものは返さない（C1）。
    //   揃ったときにだけ、一致した内容を双方が見られる。
    const state = adjustmentStateOf(entries, parties);
    const mine = entries.filter((e) => e.byPartyId === partyId).at(-1) ?? null;

    return NextResponse.json({
      state,
      ownChange: mine?.change ?? null,
      agreedChange: state === "AGREED" ? (mine?.change ?? null) : null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
