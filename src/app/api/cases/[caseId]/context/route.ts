import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";
import { asCaseId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import { buildContext } from "@/domain/context/builders";
import { loadForLlm } from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * ★LLM に渡しているものを、そのまま見せる
 *
 * この設計の要点は「防ぐ」ではなく「持っていない」である。
 * **見せられること自体が、その証明になる。**
 *
 * ★buildContext の戻り値をそのまま返す。
 *   ここで加工すると、見せているものと渡しているものがずれる。
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const snap = await loadForLlm(asCaseId(caseId));
    assertOwnParty(snap, partyId);
    return NextResponse.json({ context: buildContext(snap, partyId) });
  } catch (e) {
    return errorResponse(e);
  }
}
