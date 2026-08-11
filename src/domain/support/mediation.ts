import { formatRange, type SupportRange } from "./table";

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
  "- 「〜すべきです」という法的助言",
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

export function buildMediationInput(input: {
  topicLabel: string;
  range: SupportRange;
  proposals: { partyLabel: string; payload: Record<string, unknown> }[];
}): string {
  return [
    `論点: ${input.topicLabel}`,
    "",
    "おふたりの提案:",
    ...input.proposals.map((p) => `  ${p.partyLabel}: ${JSON.stringify(p.payload)}`),
    "",
    "算定表から取得済みの目安（★この数値以外を出さないこと）:",
    `  ${formatRange(input.range)}`,
  ].join("\n");
}
