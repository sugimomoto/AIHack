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
  console.log(`\nAIの説明:\n  ${d.explanation.split("\n").join("\n  ")}`);

  console.log("\n② 検証");
  const check = (l: string, ok: boolean) => console.log(`   ${l}: ${ok ? "✓" : "✗"}`);
  check("★検証済みの表では注記が付かない", !(d.rangeText ?? "").includes("未検証") && !d.unverified);
  check("★説明が空でない              ", d.explanation.trim().length > 20);
  check("★出典（表番号）が併記される    ", (d.rangeText ?? "").includes("表1"));
  check("★レンジが算定表由来           ", d.range !== null);

  // ★LLM が算定表以外の金額を作っていないか。
  //   許される数値は「提案の値」と「算定表の提示文に現れる値」のみ。
  //   表番号の「0〜14歳」も提示文に含まれるため、ここから拾う。
  const allowed = new Set([
    "30000", "40000", "3", "4",
    ...((d.rangeText ?? "").match(/\d+/g) ?? []),
  ]);
  const nums = (d.explanation.match(/\d[\d,]*/g) ?? []).map((s) => s.replace(/,/g, ""));
  const unknown = nums.filter((n) => !allowed.has(n));
  check(`★説明に未知の数値が無い       `, unknown.length === 0);
  if (unknown.length > 0) console.log(`      → ${unknown.join(", ")}`);

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
  console.log(`   ${n.explanation}`);
  check("★レンジが引けないとき LLM を呼ばない", n.range === null);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
