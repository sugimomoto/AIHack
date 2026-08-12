import { NextResponse } from "next/server";
import { startCase } from "@/services/caseStart";
import { writeSession } from "@/lib/session";
import { parseSituation } from "@/domain/case/situation";

/**
 * ケースを開始する。
 *
 * ★認証を要求しない。最初の当事者は、まだ誰でもない。
 *   ケースを作った時点でセッションが発行され、以降はその人のものになる。
 *
 * ★役割はここでは決まらない。同居をうかがう I-2 で決まる。
 *   それまでは仮置きで、`roleConfirmed` は立たない。
 */
export async function POST(req: Request) {
  const { situation } = (await req.json().catch(() => ({}))) as { situation?: string };

  // ★分からなければ、最も多い層に寄せる
  const s = parseSituation(situation) ?? "DIVORCED_NO_TERMS";

  const { caseId, partyId } = await startCase({ situation: s });
  await writeSession({ partyId, caseId });
  return NextResponse.json({ caseId });
}
