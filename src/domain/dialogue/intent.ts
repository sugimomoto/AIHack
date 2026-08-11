/**
 * 意図分類
 *
 * ★1メッセージが複数の intent を持つことを許容する。
 *
 *   「また勝手に土曜に決めやがって、こっちの都合も考えろ」
 *     → EMOTIONAL_EXPRESSION かつ REQUEST
 *
 *   **感情は受け止めて捨て、要求だけを構造化して渡す。**
 *   これが C1 の実装そのものである。単一 intent にすると表現できない。
 *
 * @see docs/functional-design.md §5.1
 */

export const INTENTS = [
  "REQUEST",
  "PROPOSAL",
  "ACCEPT",
  "REJECT",
  "EMOTIONAL_EXPRESSION",
  "INFO_QUERY",
  "REVISION_REQUEST",
  "OUT_OF_SCOPE",
] as const;

export type Intent = (typeof INTENTS)[number];

/**
 * 分類結果を正規化する。
 *
 * ★未知の値は捨てる。空でも落とさない。
 *   分類は補助であり、**分類できないことは話を聞かない理由にならない。**
 */
export function normalizeIntents(raw: readonly string[] | undefined | null): Intent[] {
  if (!raw) return [];
  const known = raw.filter((v): v is Intent => (INTENTS as readonly string[]).includes(v));
  return [...new Set(known)];
}

export function isEmotional(intents: readonly Intent[]): boolean {
  return intents.includes("EMOTIONAL_EXPRESSION");
}

/**
 * 取次ぎを起こすべきか。
 *
 * ★感情表現だけでは起こさない。**受け止めて終わる。**
 *   ここが true になると、感情が相手へ向かう経路が開く。
 */
const RELAY_INTENTS: readonly Intent[] = ["REQUEST", "PROPOSAL", "ACCEPT", "REJECT", "REVISION_REQUEST"];

export function needsRelay(intents: readonly Intent[]): boolean {
  return intents.some((i) => RELAY_INTENTS.includes(i));
}

/** 構造化出力のスキーマ */
export const INTENT_SCHEMA: { name: string; schema: Record<string, unknown> } = {
  name: "intent_classification",
  schema: {
    type: "object",
    properties: {
      intents: { type: "array", items: { type: "string", enum: [...INTENTS] } },
      topic: {
        type: "string",
        enum: ["CHILD_SUPPORT", "VISITATION", "SCHEDULE", "DAILY_CONTACT", "OTHER"],
      },
    },
    required: ["intents", "topic"],
    // ★余計な値を返させない
    additionalProperties: false,
  },
};
