import { describe, expect, it } from "vitest";
import { outcomesOf } from "@/domain/agreement/outcome";

/**
 * ★入力欄だけを出して「何でも書いてください」と言うと、
 *   最終的に何が決まるのかが最後まで分からない。
 */
const CHILD_SUPPORT = {
  required: ["monthlyAmount", "payDay", "until"],
  properties: {
    monthlyAmount: { type: "integer", title: "月額（円）" },
    payDay: { type: "string", title: "支払日" },
    until: { type: "string", title: "終期" },
    payeeAccount: { type: "string", title: "振込先" },
    specialExpenses: { type: "object", title: "特別費用の分担" },
    // ★表示名の無い項目
    internalFlag: { type: "boolean" },
  },
};

describe("★この相談で決まること", () => {
  it("スキーマの title から項目を作る", () => {
    const o = outcomesOf(CHILD_SUPPORT);
    expect(o.map((x) => x.label)).toContain("月額（円）");
    expect(o.map((x) => x.label)).toContain("特別費用の分担");
  });

  // ★キー名をそのまま見せない
  it("★表示名の無い項目は出さない", () => {
    const o = outcomesOf(CHILD_SUPPORT);
    expect(o.map((x) => x.key)).not.toContain("internalFlag");
  });

  it("★必ず決めるものが先に来る", () => {
    const o = outcomesOf(CHILD_SUPPORT);
    expect(o.slice(0, 3).every((x) => x.required)).toBe(true);
    expect(o.slice(3).every((x) => !x.required)).toBe(true);
  });

  it("スキーマが無ければ何も出さない", () => {
    expect(outcomesOf(null)).toEqual([]);
    expect(outcomesOf({})).toEqual([]);
    expect(outcomesOf({ properties: {} })).toEqual([]);
  });

  // ★入れ子の中身まで並べると、決めることが多すぎるように見える
  it("★入れ子は1行にまとめる", () => {
    const o = outcomesOf(CHILD_SUPPORT);
    expect(o.filter((x) => x.key === "specialExpenses")).toHaveLength(1);
    expect(o.map((x) => x.key)).not.toContain("shareRatio");
  });
});
