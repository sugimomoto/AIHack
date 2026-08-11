import { NextResponse } from "next/server";
import { respondTo } from "@/services/dialogue";

/**
 * 対話への投稿
 *
 * ★S4 の範囲では、相手に何も起きない。
 *   取次ぎの生成は S5。ここでの応答は本人しか読まない。
 *
 * ★認証は S16 で接続する。現時点では検証用のケースIDのみを受け付ける。
 */
const VERIFY_CASE_ID = "case_verify_s4";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { text } = (await req.json()) as { text?: string };

  if (!text?.trim()) {
    return NextResponse.json({ error: "内容を入力してください" }, { status: 400 });
  }

  try {
    const r = await respondTo({ caseId: VERIFY_CASE_ID, consultationId: id, text });
    return NextResponse.json(r);
  } catch (e) {
    // ★詳細をユーザーに返さない（G-F）
    console.error("[dialogue] 応答の生成に失敗しました", e);
    return NextResponse.json({ error: "うまく応答できませんでした。少し待ってからお試しください。" }, { status: 502 });
  }
}
