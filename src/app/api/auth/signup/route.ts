import { NextResponse } from "next/server";
import { writeSession } from "@/lib/session";
import { verifyIdToken } from "@/lib/verifyIdToken";
import { startCase } from "@/services/caseStart";
import { asCaseId, asPartyId } from "@/domain/case/types";
import {
  findPartiesByAuthUid,
  linkAuthUid,
} from "@/infra-adapters/firestore/repositories/caseRepository";
import { resolvePartyForUid } from "@/domain/session/authLink";

/**
 * はじめる（サインアップ）
 *
 * ★★ ケースは、**本人確認が済んでから**作る。
 *
 *   以前は誰でも `POST /api/cases` を叩けて、匿名でケースが始まった。
 *   セッションの Cookie だけが手がかりで、**失えば二度と辿れなかった。**
 *   実測：70ケース中30ケースが、誰も登録していない状態だった。
 *
 *   ★データが孤児になる形を、構造として無くす。
 *
 * ★すでにケースがあれば、**新しく作らずに戻す。**
 *   同じアドレスで押し直した人に、ケースを増やさせない。
 */
export async function POST(req: Request) {
  const { idToken } = (await req.json()) as { idToken?: string };
  const v = await verifyIdToken(idToken ?? "");
  if (!v) return NextResponse.json({ error: "確認できませんでした" }, { status: 401 });

  // ★もう始めている人は、そこへ戻す
  const existing = resolvePartyForUid(await findPartiesByAuthUid(v.uid), v.uid);
  if (existing) {
    await writeSession(existing);
    return NextResponse.json({ ok: true, resumed: true });
  }

  const { caseId, partyId } = await startCase({ situation: "DIVORCED_NO_TERMS" });
  // ★作った直後に結びつける。**認証済みでないケースを残さない**
  await linkAuthUid(asCaseId(caseId), asPartyId(partyId), v.uid);
  await writeSession({ partyId, caseId });

  return NextResponse.json({ ok: true, resumed: false });
}
