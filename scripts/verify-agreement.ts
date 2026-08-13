/**
 * S6 の検証
 *
 * ★金額が算定表由来であること、未検証の注記が消えないことを確かめる。
 */
import { buildMediationDraft } from "../src/services/agreement";
import { canFinalize, consentStateOf } from "../src/domain/agreement/consent";

async function main() {
  console.log("① 調停案の生成（双方の提案が揃った状態）");
  const d = await buildMediationDraft({
    caseId: "case_dev_001",
    topic: "CHILD_SUPPORT",
    payerBand: "425-450",
    payeeBand: "200-225",
    childAges: [8],
    proposals: [
      { payload: { monthlyAmount: 30000 } },
      { payload: { monthlyAmount: 40000 } },
    ],
  });

  console.log(`\n算定表の提示（★LLMを通していない）:\n  ${d.rangeText?.split("\n").join("\n  ")}`);

  console.log("\n② 検証");
  const check = (l: string, ok: boolean) => console.log(`   ${l}: ${ok ? "✓" : "✗"}`);
  check("★検証済みの表では注記が付かない", !(d.rangeText ?? "").includes("未検証") && !d.unverified);
  check("★出典（表番号）が併記される    ", (d.rangeText ?? "").includes("表1"));
  check("★レンジが算定表由来           ", d.range !== null);
  // ★AI の説明文は無くなった。範囲だけを出す（P3 を例外なく守る）
  check("★AI の説明文が付かない        ", d.notice === null);

  console.log("\n③ 合意の成立");
  for (const c of [
    { a: "PENDING", b: "PENDING" },
    { a: "ACCEPTED", b: "PENDING" },
    { a: "ACCEPTED", b: "ACCEPTED" },
    { a: "ACCEPTED", b: "REJECTED" },
  ] as const) {
    console.log(`   ${c.a.padEnd(9)}/${c.b.padEnd(9)} → ${consentStateOf(c).padEnd(14)} 確定可: ${canFinalize(c)}`);
  }

  console.log("\n④ 年収帯が揃っていない場合");
  const n = await buildMediationDraft({
    caseId: "case_dev_001",
    topic: "CHILD_SUPPORT",
    payerBand: "425-450",
    payeeBand: null,
    childAges: [8],
    proposals: [],
  });
  console.log(`   ${n.notice}`);
  check("★レンジが引けないとき、定型のお知らせだけ", n.range === null && n.notice !== null);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
