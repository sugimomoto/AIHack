/**
 * S4 の疎通確認
 *
 * ★完了条件は「感情的な入力が拒否されず受け止められる」である。
 *   これは実機で確かめるしかない。
 */
import { respondTo } from "../src/services/dialogue";
import { assertNoForbiddenWords } from "../src/domain/dialogue/vocabulary";

const CASE_ID = "case_verify_s4";

const CASES = [
  {
    label: "★強い感情のみ",
    text: "また勝手に予定変えやがって。こっちの都合なんかどうでもいいんだろ。もう限界だ。",
  },
  {
    label: "★感情 かつ 要求",
    text: "また勝手に土曜に決めやがって、こっちの都合も考えろ。来週は日曜にしてくれ。",
  },
  {
    label: "淡々とした要求",
    text: "来週の受け渡しですが、10時ではなく11時にできませんか。",
  },
];

const REFUSAL = ["お答えできません", "回答できません", "不適切", "お控えください", "応じられません"];

async function main() {
  for (const c of CASES) {
    console.log(`\n${"─".repeat(60)}\n${c.label}`);
    console.log(`入力: ${c.text}`);

    const r = await respondTo({ caseId: CASE_ID, consultationId: "cons_verify", text: c.text });

    console.log(`\n分類: [${r.intents.join(", ")}] / topic=${r.topic}`);
    console.log(`応答: ${r.reply}`);
    console.log(`選択肢: ${r.choices.map((x) => x.label).join(" ／ ") || "なし"}`);

    const refused = REFUSAL.filter((w) => r.reply.includes(w));
    console.log(`\n★拒否されていない : ${refused.length === 0 ? "✓" : `✗ (${refused.join(",")})`}`);
    try {
      assertNoForbiddenWords(r.reply);
      console.log(`★使ってはいけない語なし: ✓`);
    } catch (e) {
      console.log(`★使ってはいけない語なし: ✗ ${(e as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
