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

/**
 * ★「お相手に伝えてみましょう」を落とす。
 *
 *   このアプリの中心は、**アプリが伝えること**である。
 *   受け止めの応答が本人に伝達を促すと、
 *   「AIが相手と調整してくれない」という体験になり、
 *   **使っている意味そのものが失われる。**
 *
 * ★プロンプトで指示するだけでは漏れる（取次ぎと同じ方針）。
 *   生成後に検査し、該当する文だけを落とす。
 *   応答全体を捨てない。落としても受け止めは成立する。
 */
const SELF_CONVEYANCE =
  /(お相手|相手|ご本人|自分)(に|へ)[^。！？\n]{0,12}(伝え|話し|相談し|連絡し|お伝え)[^。！？\n]{0,16}(ましょう|てください|てみて|てみる|るとよい|るといい|ることが大切|ることをおすすめ|るのがよい)/;

export function stripSelfConveyance(text: string): string {
  const kept = text
    .split(/\n/)
    .map((line) =>
      line
        // ★文単位で落とす。句点を保って読める形に戻す
        .split(/(?<=[。！？])/)
        .filter((sentence) => !SELF_CONVEYANCE.test(sentence))
        .join(""),
    )
    .filter((line) => line.trim() !== "")
    .join("\n")
    .trim();

  // ★全部落ちたときは、受け止めだけを残す
  return kept === "" ? "そのお気持ち、受け止めました。" : kept;
}

export function hasSelfConveyance(text: string): boolean {
  return SELF_CONVEYANCE.test(text);
}
