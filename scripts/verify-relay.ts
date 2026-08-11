/**
 * S5 の疎通確認 ★C1 の検証
 *
 * ★感情・非難が届かず、背景事実だけが伝聞形式で伝わることを、
 *   実際の LLM 出力に対して確かめる。
 */
import { buildRelay } from "../src/services/relay";
import { hasVerbatimRun, isHearsay, CONTEXT_CATEGORIES } from "../src/domain/relay/guard";

const CASE_ID = "case_verify_s5";

const CASES = [
  {
    label: "★設計書の例（養育費・失職）",
    raw: "月3万が限界。こっちだって仕事切られて必死なんだよ。そっちだって働いてるだろ、少しは考えろ",
    intents: ["EMOTIONAL_EXPRESSION", "PROPOSAL"] as const,
    topic: "CHILD_SUPPORT",
    // ★届いてはならない語
    mustNotLeak: ["必死", "働いてるだろ", "少しは考えろ", "こっちだって"],
  },
  {
    label: "★日程変更（非難つき）",
    raw: "また勝手に土曜に決めやがって、こっちの都合も考えろ。来週は日曜にしてくれ。",
    intents: ["EMOTIONAL_EXPRESSION", "REQUEST"] as const,
    topic: "SCHEDULE",
    mustNotLeak: ["勝手に", "やがって", "考えろ"],
  },
  {
    label: "★感情のみ（取次ぎを起こさない）",
    raw: "もう限界だ。あいつの顔も見たくない。",
    intents: ["EMOTIONAL_EXPRESSION"] as const,
    topic: "OTHER",
    mustNotLeak: [],
  },
  {
    label: "子の状況",
    raw: "子どもが熱出したって連絡くらいしろよ、母親だろ。今後は当日中に知らせてほしい。",
    intents: ["EMOTIONAL_EXPRESSION", "REQUEST"] as const,
    topic: "DAILY_CONTACT",
    mustNotLeak: ["母親だろ", "しろよ"],
  },
];

async function main() {
  for (const c of CASES) {
    console.log(`\n${"─".repeat(64)}\n${c.label}`);
    console.log(`原文: ${c.raw}`);

    const r = await buildRelay({
      caseId: CASE_ID,
      consultationId: "cons_verify",
      raw: c.raw,
      intents: [...c.intents],
      topic: c.topic,
    });

    if (!r) {
      console.log("\n★取次ぎは生成されませんでした（受け止めて終わる）");
      continue;
    }

    console.log(`\n相手に届くもの:\n  ${r.content.split("\n").join("\n  ")}`);
    console.log(`\nカテゴリ: [${r.categories.join(", ")}]`);
    if (r.droppedReason) console.log(`★検査で落ちたため事情を落としました: ${r.droppedReason}`);

    // 検証
    const leaked = c.mustNotLeak.filter((w) => r.content.includes(w));
    console.log(`\n★INV-4a（原文と10文字以上一致しない）: ${!hasVerbatimRun(c.raw, r.content) ? "✓" : "✗"}`);
    console.log(`★INV-4c（ホワイトリスト内）           : ${r.categories.every((x) => (CONTEXT_CATEGORIES as readonly string[]).includes(x)) ? "✓" : "✗"}`);
    console.log(`★R-2（伝聞形式）                      : ${isHearsay(r.context) ? "✓" : "✗"}`);
    console.log(`★非難が届いていない                   : ${leaked.length === 0 ? "✓" : `✗ (${leaked.join(",")})`}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
