import { NextResponse } from "next/server";
import { authenticate, UnauthenticatedError } from "@/lib/auth";
import { planProfileWrite } from "@/domain/preparation/profile";
import { INCOME_BAND_NOTE } from "@/domain/income/band";

/**
 * 前提情報の登録
 *
 * ★planProfileWrite が「どこに何を書くか」を決める。
 *   ここで直接 Party へ書くと INV-2a が破れるため、必ず経由させる。
 */
export async function POST(req: Request) {
  let party;
  try {
    party = await authenticate(req);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body = (await req.json()) as { annualIncomeYen?: number };
  const plan = planProfileWrite({ partyId: party.id, annualIncomeYen: body.annualIncomeYen });

  const { saveOwnContactInfo, patchParty } = await import(
    "@/infra-adapters/firestore/repositories/caseRepository"
  );
  await saveOwnContactInfo(party.id, plan.contactInfo);
  await patchParty(party.caseId, party.id, plan.partyPatch);

  // ★確認のため、相手に越える値だけを返す
  return NextResponse.json({ incomeBand: plan.partyPatch.incomeBand ?? null, note: INCOME_BAND_NOTE });
}
