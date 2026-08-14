import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { signEmailLink } from "@/domain/session/emailLinkToken";

/**
 * ★メールのリンクに載せる、短命のトークンを出す
 *
 *   「リンクを送る」を押した時点ではセッションがある。
 *   だが**リンクを開くときには無いことがある**（別のブラウザ／別の端末）。
 *   そこで、当事者を指すトークンをリンクに載せて運ぶ。
 *
 * ★これ単体では何もできない。**メールの oobCode と揃って初めて結びつく。**
 * ★1時間で切れる。セッションは発行されない。
 */
export async function POST() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const key = process.env.SESSION_SECRET ?? "";
  if (!key) return NextResponse.json({ error: "設定が足りません" }, { status: 500 });

  return NextResponse.json({
    token: signEmailLink({ partyId: s.partyId, caseId: s.caseId }, { key, now: Date.now() }),
  });
}
