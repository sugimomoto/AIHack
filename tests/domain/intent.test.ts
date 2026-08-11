import { describe, expect, it } from "vitest";
import { INTENTS, INTENT_SCHEMA, isEmotional, needsRelay, normalizeIntents } from "@/domain/dialogue/intent";

/**
 * ★意図分類
 *
 * ★1メッセージが複数の intent を持つことを許容する。
 *   「また勝手に土曜に決めやがって、こっちの都合も考えろ」は
 *   EMOTIONAL_EXPRESSION かつ REQUEST である。
 *   **感情は受け止めて捨て、要求だけを構造化して渡す。**
 *   単一 intent にすると、これが表現できない。
 *
 * ★このテストは実装より先に書かれた
 */

describe("意図分類", () => {
  it("★複数の intent を許容する", () => {
    const r = normalizeIntents(["EMOTIONAL_EXPRESSION", "REQUEST"]);
    expect(r).toContain("EMOTIONAL_EXPRESSION");
    expect(r).toContain("REQUEST");
  });

  it("★未知の intent は捨てる（分類の失敗で落とさない）", () => {
    expect(normalizeIntents(["EMOTIONAL_EXPRESSION", "NONSENSE"])).toEqual(["EMOTIONAL_EXPRESSION"]);
  });

  it("★空でも落ちない（分類できないことは、話を聞かない理由にならない）", () => {
    expect(normalizeIntents([])).toEqual([]);
    expect(normalizeIntents(undefined)).toEqual([]);
  });

  it("重複を除く", () => {
    expect(normalizeIntents(["REQUEST", "REQUEST"])).toEqual(["REQUEST"]);
  });

  it("感情表現を判定できる", () => {
    expect(isEmotional(["EMOTIONAL_EXPRESSION", "REQUEST"])).toBe(true);
    expect(isEmotional(["REQUEST"])).toBe(false);
  });

  it("★感情表現だけでは取次ぎを起こさない", () => {
    expect(needsRelay(["EMOTIONAL_EXPRESSION"])).toBe(false);
    expect(needsRelay(["EMOTIONAL_EXPRESSION", "REQUEST"])).toBe(true);
    expect(needsRelay([])).toBe(false);
  });

  describe("構造化出力のスキーマ", () => {
    it("intent の enum が定義と一致する", () => {
      const props = INTENT_SCHEMA.schema.properties as Record<string, { items?: { enum?: string[] } }>;
      expect(props.intents.items?.enum).toEqual([...INTENTS]);
    });

    it("★additionalProperties が false（余計な値を返させない）", () => {
      expect(INTENT_SCHEMA.schema.additionalProperties).toBe(false);
    });
  });
});
