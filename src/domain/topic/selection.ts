/**
 * 相談トピックの選択
 *
 * ★選択を必須にしてはならない。
 *   強制すると、**感情の受け止めが選択画面の後ろに隠れる。**
 *   このプロダクトは、まず受け止めるためにある。
 *
 * @see docs/functional-design.md §4.2
 */

export type Scenario = {
  id: string;
  title: string;
  kind: string;
  /** ★4つの分類。相談の開始で束ねるために使う（設計 #4） */
  categoryId?: string | null;
  linkedTopic: string | null;
  promptHint?: string;
  /**
   * ★当事者に見せる書き出しの案内。
   *   promptHint（LLMへの指示）とは別物。**混ぜない。**
   *   AIに毎回作らせない：毎回同じ文になり、勝手な数字も作られない。
   */
  opening?: string;
  examples?: string[];
  sortOrder?: number;
};

/**
 * ★常にスキップできる。
 *   引数を取らないのは、**条件つきにしないため**である。
 *   条件を足せる形にすると、いつか「この場合は必須」が生まれる。
 */
export function isSkippable(): boolean {
  return true;
}

export function scenariosFor(scenarios: readonly Scenario[], topic: string): Scenario[] {
  return scenarios
    .filter((s) => s.linkedTopic === topic)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/**
 * 自由入力から始めた相談に、後からシナリオを紐づける。
 *
 * ★既に紐づいているものは上書きしない。
 *   途中で話題が移っても、最初に始めた文脈を消さない。
 */
export function linkScenario<T extends { scenarioId: string | null; topic: string | null }>(
  consultation: T,
  link: { scenarioId: string; topic: string | null },
): T {
  if (consultation.scenarioId) return consultation;
  return { ...consultation, scenarioId: link.scenarioId, topic: link.topic };
}
