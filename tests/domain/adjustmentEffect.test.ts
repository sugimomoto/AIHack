import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_EFFECTS,
  outcomeOf,
  validateAdjustment,
} from "@/domain/adjustment/effect";

/**
 * ★C3 の中核。
 * ONE_TIME で合意が変わってしまうと、法的文書の基準が
 * 一時的な融通のたびに書き換わることになる。
 */
describe("調整の効果種別", () => {
  describe("★ONE_TIME は合意を変えない", () => {
    const o = outcomeOf("ONE_TIME");

    it("合意を改訂しない", () => expect(o.revisesAgreement).toBe(false));
    it("改訂履歴を作らない", () => expect(o.appendsRevision).toBe(false));
    it("該当回にのみ例外を適用する", () => expect(o.appliesException).toBe(true));
    it("以降の義務を再生成しない", () => expect(o.regeneratesObligations).toBe(false));
  });

  describe("PERMANENT は合意を改訂する", () => {
    const o = outcomeOf("PERMANENT");

    it("合意を改訂する", () => expect(o.revisesAgreement).toBe(true));
    it("★履歴を上書きせず追記する", () => expect(o.appendsRevision).toBe(true));
    it("個別の例外は適用しない", () => expect(o.appliesException).toBe(false));
    it("以降の義務を再生成する", () => expect(o.regeneratesObligations).toBe(true));
  });

  it("2つの効果は排他である（同じ結果にならない）", () => {
    expect(outcomeOf("ONE_TIME")).not.toEqual(outcomeOf("PERMANENT"));
  });

  it("すべての効果種別が定義されている", () => {
    for (const e of ADJUSTMENT_EFFECTS) expect(outcomeOf(e)).toBeDefined();
  });

  describe("入力の検証", () => {
    it("ONE_TIME には対象日が必要", () => {
      expect(validateAdjustment({ effect: "ONE_TIME" }).ok).toBe(false);
      expect(validateAdjustment({ effect: "ONE_TIME", targetDate: "2026-09-13" }).ok).toBe(true);
    });

    it("PERMANENT に対象日は指定できない", () => {
      expect(validateAdjustment({ effect: "PERMANENT" }).ok).toBe(true);
      expect(validateAdjustment({ effect: "PERMANENT", targetDate: "2026-09-13" }).ok).toBe(false);
    });
  });
});
