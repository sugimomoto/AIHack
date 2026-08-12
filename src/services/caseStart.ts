import { randomBytes } from "node:crypto";
import { newCaseSeed } from "@/domain/case/start";
import { createCase, saveSituation } from "@/infra-adapters/firestore/repositories/caseRepository";
import { asCaseId } from "@/domain/case/types";

/**
 * ケースを開始する。
 *
 * ★IDは推測できない値にする。
 *   連番だと、他人のケースIDを推測できてしまう。
 *   スコープ規約で弾かれるが、**推測できること自体を残さない。**
 */
export async function startCase(input: { situation: string }) {
  const id = () => randomBytes(12).toString("base64url");
  const caseId = `case_${id()}`;
  const ownPartyId = `party_${id()}`;
  const otherPartyId = `party_${id()}`;

  // ★役割はまだ決まっていない。同居をうかがう I-2 で確定する。
  //   ここで置くのは器であって、判定ではない（roleConfirmed は立てない）。
  const seed = newCaseSeed({ caseId, ownPartyId, otherPartyId, role: "CUSTODIAL" });
  await createCase(seed);
  await saveSituation(asCaseId(caseId), input.situation);

  return { caseId, partyId: ownPartyId };
}
