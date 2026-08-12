import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";
import { parseRevisionAction } from "@/domain/adjustment/revision";
import { pendingRevisionFor, requestRevision, respondToRevision } from "@/services/revision";

/**
 * K-6 変更申請
 *
 * ★申し出た本人には、承諾のボタンを出さない。
 *   自分の申し出に自分で同意できると、双方の一致という前提が崩れる。
 */
export async function GET(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const topic = new URL(req.url).searchParams.get("topic") ?? "CHILD_SUPPORT";
    const v = await pendingRevisionFor({ caseId, partyId, topic });
    return NextResponse.json(v ?? { pending: false });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const body = (await req.json().catch(() => ({}))) as {
      topic?: string;
      action?: string;
      change?: Record<string, unknown>;
      reasonCode?: string;
    };
    const topic = body.topic ?? "CHILD_SUPPORT";

    // 申し出に答える
    const action = parseRevisionAction(body.action);
    if (action) {
      const r = await respondToRevision({ caseId, partyId, topic, action });
      return NextResponse.json(r);
    }

    // 変更を申し出る
    if (!body.change || Object.keys(body.change).length === 0) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    const d = await requestRevision({
      caseId,
      partyId,
      topic,
      change: body.change,
      reasonCode: body.reasonCode ?? null,
    });
    return NextResponse.json({ ok: true, description: d });
  } catch (e) {
    return errorResponse(e);
  }
}
