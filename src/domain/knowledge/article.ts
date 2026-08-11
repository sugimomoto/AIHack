/**
 * ナレッジ（一般情報）
 *
 * ★非弁対策の構造である。
 *   「一般情報」と「個別助言」を**画面レベルで分離する。**
 *
 *   弁護士法72条。離婚協議には事件性が認められる。
 *   「あなたのケースでは月5万円にすべきです」は個別助言であり、
 *   **記事という形であっても書いてはならない。**
 *
 * ★記事は人が書く。LLMに書かせない。
 *   毎回変わる法制度の説明に意味はなく、誤りの責任も所在しなくなる。
 *
 * @see docs/functional-design.md §5.10
 */

export const GENERAL_INFO_NOTICE =
  "これは制度の一般的な説明です。個別のご事情にお答えするものではありません。具体的なご相談は、弁護士などの専門家にご確認ください。";

/**
 * ★個別助言らしい表現の検出
 *
 *   「あなたの」＋「〜すべき」の組み合わせが典型である。
 *   完全な判定はできないが、**明らかなものを機械的に止める。**
 */
const ADVICE_PATTERNS: RegExp[] = [
  /あなた(の|は)[^。]{0,40}(すべき|しましょう|してください)/,
  /ご自身のケースでは/,
  /あなたの場合[はも]/,
];

export function isIndividualAdvice(text: string): boolean {
  return ADVICE_PATTERNS.some((re) => re.test(text));
}

export class IndividualAdviceError extends Error {
  constructor(readonly excerpt: string) {
    super(`個別助言にあたる表現が含まれています: ${excerpt}`);
    this.name = "IndividualAdviceError";
  }
}

export function assertGeneralInfo(text: string): void {
  if (isIndividualAdvice(text)) {
    const m = ADVICE_PATTERNS.map((re) => text.match(re)).find(Boolean);
    throw new IndividualAdviceError(m?.[0] ?? "");
  }
}

export type KnowledgeArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  topics: string[];
  /** ★監修者。未監修なら null（その旨を画面に出す） */
  supervisedBy: string | null;
  updatedAt: string;
};
