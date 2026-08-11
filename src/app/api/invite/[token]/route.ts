import { NextResponse } from "next/server";
import { isWellFormedToken } from "@/domain/invitation/token";
import { toPublicView } from "@/domain/invitation/publicView";
import { findByToken } from "@/infra-adapters/firestore/repositories/invitationRepository";

/**
 * 招待の照会（★未認証で呼ばれる）
 *
 * ★A-6。返す情報は toPublicView が決める。
 *   ここで record をそのまま返すと、トークンを知っている第三者に
 *   caseId・partyId・宛先が渡る。
 *
 * ★存在しないトークンと期限切れを区別しない。
 *   区別すると、有効なトークンの探索に使える。
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!isWellFormedToken(token)) return NextResponse.json({ state: "EXPIRED" });

  const inv = await findByToken(token);
  if (!inv) return NextResponse.json({ state: "EXPIRED" });

  return NextResponse.json(toPublicView(inv, new Date()));
}
