import { NextResponse } from "next/server";
import { startCase } from "@/services/caseStart";
import { writeSession } from "@/lib/session";
import { SITUATIONS, type Situation } from "@/domain/case/situation";

/**
 * ケースを開始する。
 *
 * ★認証を要求しない。最初の当事者は、まだ誰でもない。
 *   ケースを作った時点でセッションが発行され、以降はその人のものになる。
 */
export async function POST(req: Request) {
  const { role, situation } = (await req.json().catch(() => ({}))) as {
    role?: string;
    situation?: string;
  };
  const r = role === "NON_CUSTODIAL" ? "NON_CUSTODIAL" : "CUSTODIAL";

  const s = (SITUATIONS as readonly string[]).includes(situation ?? "")
    ? (situation as Situation)
    : "DIVORCED_NO_TERMS"; // ★分からなければ、最も多い層に寄せる

  const { caseId, partyId } = await startCase({ role: r, situation: s });
  await writeSession({ partyId, caseId });
  return NextResponse.json({ caseId });
}
