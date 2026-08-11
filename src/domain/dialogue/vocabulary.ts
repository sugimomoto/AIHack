/**
 * 使ってはいけない語
 *
 * ★プロンプトで指示するだけでは漏れる。**生成後に検査する。**
 *
 * @see docs/glossary.md §4
 */

export type ForbiddenWord = { word: string; replacement: string; reason: string };

export const FORBIDDEN_WORDS: readonly ForbiddenWord[] = [
  { word: "未払い", replacement: "入金が確認できていません", reason: "断定を避ける（振込の反映遅れ等がありうる）" },
  { word: "違反", replacement: "逸脱", reason: "責める語彙を避ける" },
  { word: "元夫", replacement: "お相手", reason: "関係性を想起させない" },
  { word: "元妻", replacement: "お相手", reason: "関係性を想起させない" },
  // ★責める語彙。各テストが個別に補っていたため、一覧に含める（レビューで検出）
  { word: "滞納", replacement: "入金が確認できていない状態", reason: "責める語彙を避ける" },
  { word: "遅延", replacement: "行き違い", reason: "断定を避ける" },
];

export class ForbiddenWordError extends Error {
  constructor(readonly word: string) {
    super(`使ってはいけない語が含まれています: ${word}`);
    this.name = "ForbiddenWordError";
  }
}

export function assertNoForbiddenWords(text: string): void {
  for (const f of FORBIDDEN_WORDS) {
    if (text.includes(f.word)) throw new ForbiddenWordError(f.word);
  }
}

/**
 * 言い換えて返す。
 *
 * ★生成をやり直さない。
 *   語彙の問題で応答を捨てると、当事者を待たせることになる。
 *   意味が変わらない置換であれば、その場で直すほうがよい。
 *
 * ★置換順序に意味がある。「未払い」を「違反」より先に処理する
 *   （長い語を先に処理しないと、部分一致で壊れうる）。
 */
export function sanitizeReception(text: string): string {
  return FORBIDDEN_WORDS.reduce((s, f) => s.split(f.word).join(f.replacement), text);
}
