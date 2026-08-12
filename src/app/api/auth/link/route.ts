import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { verifyIdToken } from "@/lib/verifyIdToken";
import { canLinkAuthUid } from "@/domain/session/authLink";
import { asCaseId, asPartyId } from "@/domain/case/types";
import { linkAuthUid, loadPartyAuthUid } from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * いまの当事者に、Firebase の識別子を結びつける。
 *
 * ★セッションが要る。**誰の当事者かは、こちらが既に知っている。**
 *   Firebase は「この人が誰か」を確かめるだけである。
 */
export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const { idToken } = (await req.json()) as { idToken?: string };
  const v = await verifyIdToken(idToken ?? "");
  if (!v) return NextResponse.json({ error: "確認できませんでした" }, { status: 401 });

  const caseId = asCaseId(s.caseId);
  const partyId = asPartyId(s.partyId);
  const current = await loadPartyAuthUid(caseId, partyId);

  // ★既に別の識別子が紐づいていたら付け替えない。
  //   付け替えを許すと、識別子を奪われた時点でケースごと奪われる。
  const verdict = canLinkAuthUid({ partyAuthUid: current, uid: v.uid });
  if (!verdict.ok) {
    return NextResponse.json({ error: "すでに別のアカウントが登録されています" }, { status: 409 });
  }

  await linkAuthUid(caseId, partyId, v.uid);
  return NextResponse.json({ ok: true, email: v.email });
}
