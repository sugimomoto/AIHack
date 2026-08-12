import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";
import { asCaseId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import {
  appendProposal,
  loadForLlm,
  setConsent,
} from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * すでにある取り決めの入力
 *
 * ★お相手の確認は求めない。負担になる。
 *
 *   代わりに、**記録すること自体をその人の意思表示とみなす。**
 *     Aが入力      → Aの記録として残る（Aは承諾済みとみなす）
 *     Bも同じ内容  → 自動で合意になる（ボタン不要）
 *     Bが違う内容  → 「内容が異なっています」と示すだけ。迫らない
 *
 *   「双方が承諾し、かつ一致したときのみ合意」という不変条件を壊さない。
 *
 * ★AIを通さない。当事者が書いた数字をそのまま記録する（P3）。
 */
export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const snap = await loadForLlm(asCaseId(caseId));
    assertOwnParty(snap, partyId);

    const { topic, payload } = (await req.json()) as {
      topic?: string;
      payload?: Record<string, unknown>;
    };
    if (topic !== "CHILD_SUPPORT" && topic !== "VISITATION") {
      return NextResponse.json({ error: "扱えない論点です" }, { status: 400 });
    }
    if (!payload || Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "内容が空です" }, { status: 400 });
    }

    await appendProposal(asCaseId(caseId), {
      byPartyId: partyId,
      topic,
      payload,
      context: "",
      contextCategories: [],
      status: "PENDING",
      // ★既にある取り決めの記録であり、今回だけの融通ではない
      effect: "PERMANENT",
    });
    // ★記録＝その人の意思表示。確認を求めない
    await setConsent(asCaseId(caseId), topic, partyId, "ACCEPTED");

    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
