import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";
import { asCaseId } from "@/domain/case/types";
import { assertOwnParty, scopedInbound } from "@/domain/case/scope";
import { DEFAULT_TITLE } from "@/domain/consultation/identity";
import {
  listConsultations,
  loadForLlm,
} from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * K-1 相談の一覧
 *
 * ★自分の相談だけ。**未読の印も件数バッジも持たない。**
 * ★どれから話しても順番は無い。並びは更新の新しい順。
 */
export async function GET(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const snap = await loadForLlm(asCaseId(caseId));
    assertOwnParty(snap, partyId);

    const rows = await listConsultations(asCaseId(caseId), partyId);
    return NextResponse.json({
      items: rows.map((r) => ({
        ...r,
        title: r.title ?? DEFAULT_TITLE,
        // ★シナリオID から復元できるようにしておく（題は立てたときだけ書く）
      })),
      // ★届いているご相談。相手の言葉ではない
      inbound: scopedInbound(snap, partyId),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
