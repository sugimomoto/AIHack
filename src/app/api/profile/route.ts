import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { readSession } from "@/lib/session";
import { UnauthenticatedError } from "@/lib/auth";
import { asCaseId } from "@/domain/case/types";
import { planProfileWrite } from "@/domain/preparation/profile";
import { INCOME_BAND_NOTE } from "@/domain/income/band";

/**
 * 前提情報の登録
 *
 * ★planProfileWrite が「どこに何を書くか」を決める。
 *   ここで直接 Party へ書くと INV-2a が破れるため、必ず経由させる。
 */
export async function POST(req: Request) {
  let partyId, caseId;
  try {
    partyId = await resolveParty(req);
    caseId = (await readSession())?.caseId ?? "";
    if (!caseId) throw new UnauthenticatedError();
  } catch (e) {
    if (e instanceof UnauthenticatedError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body = (await req.json()) as { annualIncomeYen?: number };
  const plan = planProfileWrite({ partyId, annualIncomeYen: body.annualIncomeYen });

  const { saveOwnContactInfo, patchParty } = await import(
    "@/infra-adapters/firestore/repositories/caseRepository"
  );
  await saveOwnContactInfo(partyId, plan.contactInfo);
  await patchParty(asCaseId(caseId), partyId, plan.partyPatch);

  // ★確認のため、相手に越える値だけを返す
  return NextResponse.json({ incomeBand: plan.partyPatch.incomeBand ?? null, note: INCOME_BAND_NOTE });
}
