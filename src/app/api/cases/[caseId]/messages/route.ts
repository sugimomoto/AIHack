import { NextResponse } from "next/server";
import { postMessage } from "@/services/consultation";
import { resolveParty } from "@/lib/resolveParty";
import { UnauthenticatedError } from "@/lib/auth";
import { ScopeViolationError } from "@/domain/case/scope";

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const partyId = await resolveParty(req);
    const { text, effect, scenarioId, title } = (await req.json()) as {
      text?: string;
      effect?: string;
      scenarioId?: string;
      title?: string;
    };
    if (!text?.trim()) return NextResponse.json({ error: "内容を入力してください" }, { status: 400 });

    return NextResponse.json(
      await postMessage({ caseId, partyId, text, effect, scenarioId, title }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}

/** ★エラーの詳細をユーザーに返さない（G-F） */
export function errorResponse(e: unknown) {
  if (e instanceof UnauthenticatedError) return NextResponse.json({ error: e.message }, { status: 401 });
  if (e instanceof ScopeViolationError) return NextResponse.json({ error: e.message }, { status: 403 });
  console.error("[api] 処理に失敗しました", e);
  return NextResponse.json({ error: "うまく処理できませんでした。少し待ってからお試しください。" }, { status: 500 });
}
