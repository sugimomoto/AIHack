import { formatRange, type SupportRange } from "./table";
import { FORBIDDEN_WORDS } from "@/domain/dialogue/vocabulary";

/**
 * 調停案の生成
 *
 * ★LLM は取得済みのレンジを**説明する文章だけ**を生成する。
 *   金額そのものは生成しない（P3）。
 *
 * ★入力に原文を渡さない（INV-1）。渡すのは payload とレンジのみ。
 */

export const MEDIATION_SYSTEM_PROMPT = [
  "おふたりの提案と、算定表から取得済みの目安をもとに、双方に同じ説明文を作ってください。",
  "",
  "# ★守ること",
  "- **あなたは金額を作らない。**与えられた数値以外の金額を文中に出さないでください",
  "- 新しい金額を出さない。中間の金額も、あなたが決めてはいけません",
  "- 出典（表番号）を必ず併記してください",
  "- 注記が与えられている場合は、そのまま含めてください",
  "",
  "# ★してはいけないこと",
  "- 「〜すべきです」「〜しましょう」という助言",
  "- 「未払い」「違反」「滞納」「遅延」という語",
  "- どちらが正しいかの判断",
  "- 一方に有利な書き方",
  "- 相手の人格や事情への評価",
  "",
  "# 書き方",
  "- おふたりの提案の差がどこにあるかを、事実として示す",
  "- 算定表の目安との関係を示す",
  "- 次に何を決めればよいかを1つだけ挙げる",
  "- 5〜6文程度",
].join("\n");

/**
 * ★閲覧者に依存しない入力にする。
 *
 *   「あなた」「お相手」を入れると、生成文が閲覧者視点になる。
 *   キャッシュを共有した二人目には、立場が入れ替わって見える
 *   （レビューで検出）。**誰の案かは構造化表示が担う。**
 */
export function buildMediationInput(input: {
  topicLabel: string;
  range: SupportRange;
  proposals: { payload: Record<string, unknown> }[];
}): string {
  return [
    `論点: ${input.topicLabel}`,
    "",
    "おふたりの提案（どちらがどなたのものかは書かないでください）:",
    ...input.proposals.map((p) => `  ・${JSON.stringify(p.payload)}`),
    "",
    "算定表から取得済みの目安（★この数値以外を出さないこと）:",
    `  ${formatRange(input.range)}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------

/**
 * ★生成後の検査
 *
 * プロンプトで指示するだけでは漏れる。**生成後に検査する。**
 * 調停案は双方に見える唯一の LLM 長文であり、しかもキャッシュされる。
 * 一度通せば恒久的に残る（レビューで検出）。
 */
export type MediationVerdict =
  | { ok: true }
  | { ok: false; reason: "UNKNOWN_AMOUNT" | "FORBIDDEN_WORD" | "ADVICE"; detail: string };

const ADVICE_RE = /(すべき|しましょう|してください|お勧めします|望ましいでしょう)/;

export function verifyMediationText(
  text: string,
  allowed: { amounts: number[]; rangeText: string },
): MediationVerdict {
  for (const f of FORBIDDEN_WORDS) {
    if (text.includes(f.word)) return { ok: false, reason: "FORBIDDEN_WORD", detail: f.word };
  }
  const m = text.match(ADVICE_RE);
  if (m) return { ok: false, reason: "ADVICE", detail: m[0] };

  // ★許される数値：提案の値、算定表の提示文に現れる値、桁区切りの表記
  const ok = new Set<string>();
  for (const a of allowed.amounts) {
    ok.add(String(a));
    ok.add(a.toLocaleString("ja-JP"));
    ok.add(String(Math.round(a / 10000)));
  }
  for (const n of allowed.rangeText.match(/\d[\d,]*/g) ?? []) ok.add(n);

  for (const n of text.match(/\d[\d,]*/g) ?? []) {
    if (!ok.has(n)) return { ok: false, reason: "UNKNOWN_AMOUNT", detail: n };
  }
  return { ok: true };
}
