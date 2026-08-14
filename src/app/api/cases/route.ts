import { NextResponse } from "next/server";
import { startCase } from "@/services/caseStart";
import { writeSession } from "@/lib/session";
import { parseSituation } from "@/domain/case/situation";

/**
 * ★★ この経路は閉じた。
 *
 *   以前は**認証を要求せず**、誰でもケースを始められた。
 *   セッションの Cookie だけが手がかりで、**失えば二度と辿れなかった。**
 *   実測：70ケース中30ケースが、誰も登録していない状態だった。
 *
 *   → ケースは `POST /api/auth/signup` で、**本人確認が済んでから**作る。
 *
 * ★画面から呼ばれなくなっただけでなく、**API としても閉じる。**
 *   開いたままだと、匿名のケースが増え続ける。
 */
export async function POST(_req: Request) {
  return NextResponse.json(
    { error: "この経路は使えません。メールアドレスのご登録からお始めください" },
    { status: 410 },
  );
}

/** ★旧：匿名でケースを始める。呼ばない */
async function _startAnonymously(req: Request) {
  const { situation } = (await req.json().catch(() => ({}))) as { situation?: string };

  // ★分からなければ、最も多い層に寄せる
  const s = parseSituation(situation) ?? "DIVORCED_NO_TERMS";

  const { caseId, partyId } = await startCase({ situation: s });
  await writeSession({ partyId, caseId });
  return NextResponse.json({ caseId });
}
