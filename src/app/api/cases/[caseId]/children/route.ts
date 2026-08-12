import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";
import { asCaseId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import { loadForLlm, saveChildren } from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * お子さんの登録
 *
 * ★算定表は「人数」と「15歳以上かどうか」で表を選ぶ。
 *   これが無いと、目安を出せない。
 *
 * ★名前は任意。**入れなくても算定表は引ける。**
 */
const BIRTH = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const snap = await loadForLlm(asCaseId(caseId));
    assertOwnParty(snap, partyId);

    const { children } = (await req.json()) as { children?: { birthDate?: string; name?: string }[] };
    const rows = (children ?? []).filter((c) => c.birthDate && BIRTH.test(c.birthDate));

    // ★公表されている算定表は3人まで
    if (rows.length === 0 || rows.length > 3) {
      return NextResponse.json({ error: "お子さんは1〜3人でご登録ください" }, { status: 400 });
    }
    await saveChildren(asCaseId(caseId), rows.map((c) => ({ birthDate: c.birthDate!, name: c.name })));
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (e) {
    return errorResponse(e);
  }
}
