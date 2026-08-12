import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";
import { asCaseId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import { parseLiving, roleFor } from "@/domain/case/living";
import { loadForLlm, saveLiving } from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * I-2 同居を記録する。
 *
 * ★役割（受け取る側／支払う側）は、ここでだけ決まる。
 *   決まらない答え（お子さんによって違う）では**書き換えない。**
 */
export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const snap = await loadForLlm(asCaseId(caseId));
    // ★他人のケースは触れない（INV-1）
    assertOwnParty(snap, partyId);

    const { living } = (await req.json().catch(() => ({}))) as { living?: string };
    const l = parseLiving(living);
    if (!l) return NextResponse.json({ error: "bad_request" }, { status: 400 });

    await saveLiving(asCaseId(caseId), { living: l, ownPartyId: partyId, role: roleFor(l) });
    return NextResponse.json({ ok: true, roleConfirmed: roleFor(l) !== null });
  } catch (e) {
    return errorResponse(e);
  }
}
