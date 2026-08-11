/**
 * 開発用のケースを投入する
 *
 *   pnpm exec tsx scripts/seed-dev-case.ts
 *
 * ★S2 は「二人が既にいる状態」を前提とする。
 *   招待でどう二人になるかは S15 で扱う。
 *
 * ★架空データのみ。実在を想起させない。
 */
import { getDb } from "../src/infra-adapters/firestore/client";

const CASE = "case_dev_001";
const A = "party_dev_a"; // 非監護親
const B = "party_dev_b"; // 監護親

async function main() {
  const db = getDb();
  const root = db.collection("cases").doc(CASE);
  const batch = db.batch();

  batch.set(root, {
    separationDate: "2026-03-01",
    stage: "NEGOTIATION",
    custodyType: "UNDECIDED",
  });

  batch.set(root.collection("parties").doc(A), {
    authUid: "dev-uid-a", role: "NON_CUSTODIAL",
    displayNameForOther: "お相手", incomeBand: "400-425", state: "ACTIVE",
  });
  batch.set(root.collection("parties").doc(B), {
    authUid: "dev-uid-b", role: "CUSTODIAL",
    displayNameForOther: "お相手", incomeBand: "200-225", state: "ACTIVE",
  });

  // ★非開示情報はケース配下に置かない（architecture.md §3.2）
  batch.set(db.collection("contactInfo").doc(A), {
    address: "架空県架空市1-2-3", phone: "090-0000-0000",
    employer: "架空商事", annualIncome: 4_380_000,
  });
  batch.set(db.collection("contactInfo").doc(B), {
    address: "架空県別市4-5-6", phone: "090-1111-1111",
    employer: "架空製作所", annualIncome: 2_100_000,
  });

  batch.set(root.collection("children").doc("child_dev_1"), { birthDate: "2018-05-01" });

  batch.set(root.collection("agreementItems").doc("ai_dev_1"), {
    topic: "VISITATION", status: "AGREED", payloadSchemaId: "ps_visitation_v1",
    payload: { frequency: "MONTHLY_1", dayOfWeek: "SAT", weekOfMonth: 2,
               timeRange: { from: "10:00", to: "17:00" }, handoverPlace: "○○駅" },
    version: 1, agreedAt: "2026-07-01T00:00:00Z",
  });

  const cons = root.collection("consultations").doc("cons_dev_1");
  batch.set(cons, { scenarioId: "sc_007", initiatedByPartyId: B, status: "OPEN" });

  // ★双方の原文。互いに見えないことを確認するための材料
  batch.set(cons.collection("messages").doc("m_dev_1"), {
    partyId: A, role: "USER",
    content: "また勝手に土曜に決めやがって", createdAt: "2026-08-11T00:00:00Z",
  });
  batch.set(cons.collection("messages").doc("m_dev_2"), {
    partyId: B, role: "USER",
    content: "何度言っても聞いてもらえない", createdAt: "2026-08-11T00:01:00Z",
  });

  batch.set(root.collection("mediationEvents").doc("me_dev_1"), {
    toPartyId: A,
    content: "土曜の日程について、別案のご相談が来ています。",
  });

  await batch.commit();
  console.log(`✓ 開発用ケースを投入しました: ${CASE}`);
  console.log(`  非監護親: ${A} (dev-uid-a)`);
  console.log(`  監護親:   ${B} (dev-uid-b)`);
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
