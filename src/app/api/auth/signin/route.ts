import { NextResponse } from "next/server";
import { writeSession } from "@/lib/session";
import { verifyIdToken } from "@/lib/verifyIdToken";
import { resolvePartyForUid } from "@/domain/session/authLink";
import { findPartiesByAuthUid } from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * 別の端末から戻る。
 *
 * ★未登録の識別子ではセッションを発行しない。
 *   勝手にケースを作らない。**招待かケース作成を経ていない人は入れない。**
 */
export async function POST(req: Request) {
  const { idToken } = (await req.json()) as { idToken?: string };
  const v = await verifyIdToken(idToken ?? "");
  if (!v) return NextResponse.json({ error: "確認できませんでした" }, { status: 401 });

  const parties = await findPartiesByAuthUid(v.uid);
  const hit = resolvePartyForUid(parties, v.uid);
  if (!hit) {
    // ★理由を細かく返さない。登録の有無を探る手がかりにさせない
    return NextResponse.json({ error: "このアカウントに紐づくご利用がありません" }, { status: 404 });
  }

  await writeSession({ partyId: hit.partyId, caseId: hit.caseId });
  return NextResponse.json({ ok: true });
}
