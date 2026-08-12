import { describe, expect, it } from "vitest";
import {
  SITUATIONS,
  needsInvitation,
  needsTermsInput,
  nextStepFor,
  topicsFor,
} from "@/domain/case/situation";

/**
 * ★入口の分岐
 *
 *   「もう離婚して取り決めもある人」と「まだ相手と話していない人」が
 *   同じ画面から始まっていた。**状況の違いを吸収していなかった。**
 *
 * ★軸は2つ。離婚したか、取り決めがあるか。
 *
 * ★このテストは実装より先に書かれた
 */

describe("★状況の分類", () => {
  it("4つある", () => {
    expect(SITUATIONS).toEqual([
      "DIVORCED_WITH_TERMS",
      "DIVORCED_NO_TERMS",
      "PREDIVORCE_NEGOTIATING",
      "PREDIVORCE_CONSIDERING",
    ]);
  });

  it("★取り決めがある人は、入力から始まる", () => {
    expect(needsTermsInput("DIVORCED_WITH_TERMS")).toBe(true);
    expect(needsTermsInput("DIVORCED_NO_TERMS")).toBe(false);
  });

  it("★まだ相手と話していない人には、招待を求めない", () => {
    expect(needsInvitation("PREDIVORCE_CONSIDERING")).toBe(false);
  });

  it("条件を整理する人には招待が要る", () => {
    expect(needsInvitation("DIVORCED_NO_TERMS")).toBe(true);
    expect(needsInvitation("PREDIVORCE_NEGOTIATING")).toBe(true);
  });

  it("★取り決めがある人にも招待は要る（相手と運用するため）", () => {
    expect(needsInvitation("DIVORCED_WITH_TERMS")).toBe(true);
  });
});

describe("★次に進む先", () => {
  it.each([
    ["DIVORCED_WITH_TERMS", "/onboarding/terms"],
    ["DIVORCED_NO_TERMS", "/onboarding/invite"],
    ["PREDIVORCE_NEGOTIATING", "/onboarding/invite"],
    ["PREDIVORCE_CONSIDERING", "/app"],
  ])("%s → %s", (s, path) => {
    expect(nextStepFor(s as never)).toBe(path);
  });
});

describe("★論点の出し分け", () => {
  it("離婚後は、養育費と面会交流", () => {
    const t = topicsFor("DIVORCED_NO_TERMS");
    expect(t).toContain("CHILD_SUPPORT");
    expect(t).toContain("VISITATION");
  });

  it("★離婚前でも、婚姻費用は出さない（対象外・算定表が未検証）", () => {
    expect(topicsFor("PREDIVORCE_NEGOTIATING")).not.toContain("MARITAL_EXPENSES");
  });

  it("★財産分与・慰謝料も出さない（扱える設計になっていない）", () => {
    for (const s of SITUATIONS) {
      expect(topicsFor(s)).not.toContain("PROPERTY_DIVISION");
      expect(topicsFor(s)).not.toContain("CONSOLATION_MONEY");
    }
  });
});
