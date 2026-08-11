import { randomBytes } from "node:crypto";
import { newCaseSeed } from "@/domain/case/start";
import { createCase } from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * ケースを開始する。
 *
 * ★IDは推測できない値にする。
 *   連番だと、他人のケースIDを推測できてしまう。
 *   スコープ規約で弾かれるが、**推測できること自体を残さない。**
 */
export async function startCase(input: { role: "CUSTODIAL" | "NON_CUSTODIAL" }) {
  const id = () => randomBytes(12).toString("base64url");
  const caseId = `case_${id()}`;
  const ownPartyId = `party_${id()}`;
  const otherPartyId = `party_${id()}`;

  const seed = newCaseSeed({ caseId, ownPartyId, otherPartyId, role: input.role });
  await createCase(seed);

  return { caseId, partyId: ownPartyId };
}
