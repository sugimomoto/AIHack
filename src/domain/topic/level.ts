/**
 * やりとりの3層
 *
 * ★L3（日常連絡）は合意を求めない。
 *   **ただし C1 の扱いは変わらない。**
 *   合意を求めないだけで、原文は越えないし、事情は伝聞形式で伝わる。
 *
 * @see docs/functional-design.md §5.1a
 */

export const LEVELS = ["L1", "L2", "L3"] as const;
export type Level = (typeof LEVELS)[number];

const TOPIC_LEVEL: Record<string, Level> = {
  CHILD_SUPPORT: "L1", // 合意（法的文書の基礎）
  VISITATION: "L1",
  SCHEDULE: "L2", // 調整（合意を前提にした運用）
  DAILY_CONTACT: "L3", // 連絡（合意を求めない）
};

export function levelOfTopic(topic: string): Level | null {
  return TOPIC_LEVEL[topic] ?? null;
}

/**
 * ★未知の論点では合意を求めない。
 *   分からないものを、勝手に取り決めにしない。
 */
export function requiresAgreement(topic: string): boolean {
  return levelOfTopic(topic) === "L1";
}
