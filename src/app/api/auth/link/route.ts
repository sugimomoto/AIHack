import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { verifyIdToken } from "@/lib/verifyIdToken";
import { canLinkAuthUid } from "@/domain/session/authLink";
import { verifyEmailLink } from "@/domain/session/emailLinkToken";
import { asCaseId, asPartyId } from "@/domain/case/types";
import { linkAuthUid, loadPartyAuthUid } from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * いまの当事者に、Firebase の識別子を結びつける。
 *
 * ★セッションが要る。**誰の当事者かは、こちらが既に知っている。**
 *   Firebase は「この人が誰か」を確かめるだけである。
 */
export async function POST(req: Request) {
  const { idToken, linkToken } = (await req.json()) as {
    idToken?: string;
    linkToken?: string;
  };

  // ★本人であることは、必ず Firebase で確かめる。**ここは省略できない**
  const v = await verifyIdToken(idToken ?? "");
  if (!v) return NextResponse.json({ error: "確認できませんでした" }, { status: 401 });

  // ★★ 誰の当事者かは、セッションか、リンクに載せた短命トークンで決める。
  //
  //   セッションだけに頼ると、**リンクを別のブラウザで開いた人が結びつけられない。**
  //   実機で起きた（リンクを踏んでも入口に戻され、登録が完了しなかった）。
  //
  //   ★トークン単体では何もできない。**oobCode と揃って初めて結びつく。**
  const s = await readSession();
  const fromToken = linkToken
    ? verifyEmailLink(linkToken, { key: process.env.SESSION_SECRET ?? "", now: Date.now() })
    : null;
  const who = s ?? fromToken;
  if (!who) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const caseId = asCaseId(who.caseId);
  const partyId = asPartyId(who.partyId);
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
