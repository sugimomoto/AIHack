import { NextResponse } from "next/server";
import { startCase } from "@/services/caseStart";
import { writeSession } from "@/lib/session";

/**
 * ケースを開始する。
 *
 * ★認証を要求しない。最初の当事者は、まだ誰でもない。
 *   ケースを作った時点でセッションが発行され、以降はその人のものになる。
 */
export async function POST(req: Request) {
  const { role } = (await req.json().catch(() => ({}))) as { role?: string };
  const r = role === "NON_CUSTODIAL" ? "NON_CUSTODIAL" : "CUSTODIAL";

  const { caseId, partyId } = await startCase({ role: r });
  await writeSession({ partyId, caseId });
  return NextResponse.json({ caseId });
}
