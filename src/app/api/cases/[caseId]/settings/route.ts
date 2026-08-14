import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";
import { asCaseId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import {
  loadForLlm,
  loadViewerSettings,
  saveViewerSettings,
} from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * 画面の設定
 *
 * ★「お相手の呼び方」は見ている本人の画面だけのもの。相手には渡さない。
 */
const MAX_ALIAS = 20;

export async function GET(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const snap = await loadForLlm(asCaseId(caseId));
    assertOwnParty(snap, partyId);
    // ★★ お相手が参加しているかを返す。
    //
    //   「つながっているのか分からない」という状態を残さない。
    //   ★状態だけ。**お相手のアドレスも識別子も返さない**（C1）。
    const other = snap.parties.find((p) => p.id !== partyId);
    return NextResponse.json({
      ...(await loadViewerSettings(asCaseId(caseId), partyId)),
      partnerJoined: other?.state === "ACTIVE",
    });
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

    const body = (await req.json().catch(() => ({}))) as {
      partnerAlias?: string;
      notifyBody?: boolean;
    };

    const alias =
      body.partnerAlias === undefined ? undefined : body.partnerAlias.trim().slice(0, MAX_ALIAS);

    await saveViewerSettings(asCaseId(caseId), partyId, {
      ...(alias === undefined ? {} : { partnerAlias: alias }),
      ...(typeof body.notifyBody === "boolean" ? { notifyBody: body.notifyBody } : {}),
    });
    // ★★ お相手が参加しているかを返す。
    //
    //   「つながっているのか分からない」という状態を残さない。
    //   ★状態だけ。**お相手のアドレスも識別子も返さない**（C1）。
    const other = snap.parties.find((p) => p.id !== partyId);
    return NextResponse.json({
      ...(await loadViewerSettings(asCaseId(caseId), partyId)),
      partnerJoined: other?.state === "ACTIVE",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
