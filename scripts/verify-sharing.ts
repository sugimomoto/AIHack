/**
 * 仮案と共有の検証
 *
 * ★下書きが、相手側の view に**一切現れないこと**を実データで確かめる。
 *   テストは domain の純関数を固定している。ここは経路全体を通す。
 */
import { loadAgreementView } from "../src/services/agreement";
import { asCaseId, asPartyId } from "../src/domain/case/types";
import { loadForLlm } from "../src/infra-adapters/firestore/repositories/caseRepository";
import { screenStateOf } from "../src/domain/agreement/screen";

const CASE = process.env.VERIFY_CASE_ID ?? "case_dev_001";
const TOPIC = process.env.VERIFY_TOPIC ?? "PROPERTY_DIVISION";

async function main() {
  const snap = await loadForLlm(asCaseId(CASE));
  const parties = snap.parties.map((p) => p.id);
  console.log(`ケース ${CASE} / 論点 ${TOPIC}`);
  console.log(`当事者: ${parties.join(", ")}\n`);

  for (const id of parties) {
    const v = await loadAgreementView({
      caseId: CASE,
      partyId: asPartyId(id),
      topic: TOPIC,
    });
    const state = screenStateOf({
      agreed: v.agreement !== null,
      ownPayload: v.ownPayload,
      otherPayload: v.otherPayload,
      sharing: v.sharing,
    });
    console.log(`── ${id} から見た画面`);
    console.log(`   状態          : ${state}`);
    console.log(`   共有          : ${v.sharing}`);
    console.log(`   自分の案      : ${JSON.stringify(v.ownPayload)}`);
    console.log(`   お相手の案    : ${JSON.stringify(v.otherPayload)}`);
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
