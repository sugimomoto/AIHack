import { NextResponse } from "next/server";
import { authenticate, UnauthenticatedError } from "@/lib/auth";
import { isWellFormedToken } from "@/domain/invitation/token";
import { transition } from "@/domain/invitation/stateMachine";
import { findByToken, updateStatus } from "@/infra-adapters/firestore/repositories/invitationRepository";

/**
 * 招待の受諾・辞退
 *
 * ★受諾には認証が要る。誰が参加したのかが確定しないと、
 *   以降どちらのセッションに紐づくかが決まらない。
 *
 * ★辞退も明示的に扱う。「返事をしない」以外の選択肢を用意する。
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  let party;
  try {
    party = await authenticate(req);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { token } = await ctx.params;
  const { action } = (await req.json()) as { action?: "ACCEPT" | "DECLINE" };
  if (action !== "ACCEPT" && action !== "DECLINE") {
    return NextResponse.json({ error: "不正な操作です" }, { status: 400 });
  }
  if (!isWellFormedToken(token)) {
    return NextResponse.json({ error: "このリンクは使えません" }, { status: 404 });
  }

  const inv = await findByToken(token);
  // ★存在しないトークンと期限切れを区別しない（探索に使われるため）
  if (!inv) return NextResponse.json({ error: "このリンクは使えません" }, { status: 404 });
  if (new Date(inv.expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: "このリンクは期限が切れています" }, { status: 410 });
  }

  let next;
  try {
    next = transition(inv.status, action);
  } catch {
    return NextResponse.json({ error: "このリンクは使えません" }, { status: 409 });
  }

  await updateStatus(inv.id, {
    status: next,
    ...(action === "ACCEPT" ? { acceptedAt: new Date().toISOString(), acceptedByPartyId: party.id } : {}),
  });

  // ★受諾でケースが ACTIVE になり、準備モードの下書きが提案として提示できる状態になる。
  //   ケース側の更新は S16（対話本体）で経路が繋がってから行う。
  return NextResponse.json({ status: next });
}
