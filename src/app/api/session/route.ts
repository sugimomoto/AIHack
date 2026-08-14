import { NextResponse } from "next/server";
import { clearSession, readSession } from "@/lib/session";
import { asCaseId, asPartyId } from "@/domain/case/types";
import { loadPartyAuthUid } from "@/infra-adapters/firestore/repositories/caseRepository";

export const dynamic = "force-dynamic";

/**
 * 現在のセッション
 *
 * ★★ どのアドレスで入っているかを返す。
 *
 *   打ち間違えたアドレスで入ると、**新しい空のケースが作られる。**
 *   サインアップ必須にしたことで、これが起きやすくなった。
 *   「データが消えた」ように見えるが、実際は**別人として入っている。**
 *
 *   ★どのアドレスで入っているかが見えないと、本人にも気づけない。
 *
 * ★メールアドレスは Firestore に持たない。
 *   **その都度 Firebase Auth から引く。**保存はしない。
 */
export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ signedIn: false });

  return NextResponse.json({ signedIn: true, ...s, email: await emailOf(s) });
}

/** ★引けなければ null。**表示できないだけで、動作は変えない** */
async function emailOf(s: { caseId: string; partyId: string }): Promise<string | null> {
  try {
    const uid = await loadPartyAuthUid(asCaseId(s.caseId), asPartyId(s.partyId));
    if (!uid) return null;
    const { getAuth } = await import("firebase-admin/auth");
    return (await getAuth().getUser(uid)).email ?? null;
  } catch {
    return null;
  }
}

/** ログアウト */
export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
