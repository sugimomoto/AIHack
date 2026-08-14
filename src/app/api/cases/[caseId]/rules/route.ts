import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";
import { asCaseId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import { RULE_KINDS, THRESHOLDS, SHARES, ruleStateOf } from "@/domain/rule/houseRule";
import {
  appendRule,
  findOtherPartyId,
  listRules,
  loadForLlm,
  appendMediationEvent,
} from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * おふたりで決めたこと（House Rule）
 *
 * ★公正証書には入らない。**取り決めとは別の器**である。
 * ★片方が出しただけでは決まらない。**相手が同じ内容を選んだときに揃う。**
 * ★AI を通さない。当事者が選んだ値がそのまま記録される（P3）。
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const snap = await loadForLlm(asCaseId(caseId));
    assertOwnParty(snap, partyId);

    const all = await listRules(asCaseId(caseId));
    const parties = snap.parties.map((p) => p.id as string);

    const items = RULE_KINDS.map((kind) => {
      const entries = all.filter((r) => r.kind === kind);
      const state = ruleStateOf(entries, parties);
      const mine = [...entries].reverse().find((e) => e.byPartyId === partyId) ?? null;
      return {
        kind,
        state,
        // ★自分が出したものは見える。相手の案は、揃ったときだけ
        ownValue: mine?.value ?? null,
        agreedValue: state === "AGREED" ? (mine?.value ?? null) : null,
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const snap = await loadForLlm(asCaseId(caseId));
    assertOwnParty(snap, partyId);

    const body = (await req.json()) as {
      kind?: string;
      thresholdYen?: number;
      share?: string;
    };

    if (!body.kind || !(RULE_KINDS as readonly string[]).includes(body.kind)) {
      return NextResponse.json({ error: "扱えない種類です" }, { status: 400 });
    }
    // ★★ 選択肢だけを受け付ける。自由な値を通さない。
    //   通すと、書いた言葉がそのまま相手に渡ることになる（C1）。
    const okThreshold = THRESHOLDS.some(([v]) => Number(v) === body.thresholdYen);
    const okShare = SHARES.some(([v]) => v === body.share);
    if (!okThreshold || !okShare) {
      return NextResponse.json({ error: "選べる内容ではありません" }, { status: 400 });
    }

    await appendRule(asCaseId(caseId), {
      kind: body.kind,
      byPartyId: partyId,
      value: { thresholdYen: body.thresholdYen, share: body.share },
    });

    // ★相手に届く。状態が変わるだけで誰にも届かないなら、変わっていないのと同じ
    const to = await findOtherPartyId(asCaseId(caseId), partyId);
    if (to) {
      await appendMediationEvent(asCaseId(caseId), {
        fromPartyId: partyId,
        toPartyId: to,
        // ★原文は含まない。何についてかだけ（C1）
        content:
          "お相手が、臨時の費用の分け方についてのお考えを記録されました。ご確認のうえ、ご自身のお考えもお選びください。",
      }).catch((e) => console.error("[rules] お知らせの保存に失敗しました", e));
    }

    const all = await listRules(asCaseId(caseId));
    const parties = snap.parties.map((p) => p.id as string);
    const state = ruleStateOf(all.filter((r) => r.kind === body.kind), parties);

    return NextResponse.json({ ok: true, state });
  } catch (e) {
    return errorResponse(e);
  }
}
