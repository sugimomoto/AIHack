import { describe, expect, it } from "vitest";
import {
  SITUATIONS,
  SITUATION_LABEL,
  SITUATION_NOTE,
  needsTermsInput,
  nextStepFor,
  parseSituation,
  topicsFor,
} from "@/domain/case/situation";

/**
 * ★入口の分岐
 *
 *   「もう離婚して取り決めもある人」と「これから話す人」が
 *   同じ画面から始まっていた。**状況の違いを吸収していなかった。**
 *
 * ★第3弾で2点変えた。
 *   1. 「まだ相手と話していない」を独立の問いにしない（招待をオンボーディングから外す）
 *   2. 平たい5択にする（2×2の表として聞くと詰問になる）
 */

describe("★状況の分類", () => {
  it("5つある", () => {
    expect(SITUATIONS).toEqual([
      "PREDIVORCE_NEGOTIATING",
      "PREDIVORCE_WITH_TERMS",
      "DIVORCED_NO_TERMS",
      "DIVORCED_WITH_TERMS",
      "UNSURE",
    ]);
  });

  it("★すべての選択肢に、同じ形の見出しと補足がある（一つだけ小さくしない）", () => {
    for (const s of SITUATIONS) {
      expect(SITUATION_LABEL[s]).toBeTruthy();
      expect(SITUATION_NOTE[s]).toBeTruthy();
    }
  });

  it("★「離婚していますか」と直接問う文言を持たない", () => {
    for (const s of SITUATIONS) {
      const text = `${SITUATION_LABEL[s]}${SITUATION_NOTE[s]}`;
      expect(text).not.toMatch(/ますか|ありますか/);
    }
  });

  it("★取り決めがある人は、入力から始まる", () => {
    expect(needsTermsInput("DIVORCED_WITH_TERMS")).toBe(true);
    expect(needsTermsInput("DIVORCED_NO_TERMS")).toBe(false);
  });

  it("★離婚前で条件が決まっている人には、記録の入力を出さない（まだ確定していない）", () => {
    expect(needsTermsInput("PREDIVORCE_WITH_TERMS")).toBe(false);
  });

  it("★分からない人にも、何も入力させない", () => {
    expect(needsTermsInput("UNSURE")).toBe(false);
  });
});

describe("★次に進む先", () => {
  // ★招待はオンボーディングに含めない。着地はホーム。
  it.each([
    ["PREDIVORCE_NEGOTIATING", "/app"],
    ["PREDIVORCE_WITH_TERMS", "/app"],
    ["DIVORCED_NO_TERMS", "/app"],
    ["DIVORCED_WITH_TERMS", "/onboarding/terms"],
    ["UNSURE", "/app"],
  ])("%s → %s", (s, path) => {
    expect(nextStepFor(s as never)).toBe(path);
  });

  it("★どの状況でも、招待を通らせない", () => {
    for (const s of SITUATIONS) {
      expect(nextStepFor(s)).not.toContain("invite");
    }
  });
});

describe("★保存済みの値", () => {
  it("そのまま読み戻せる", () => {
    for (const s of SITUATIONS) expect(parseSituation(s)).toBe(s);
  });

  // ★選択肢を組み替えても、既に保存された値を落とさない
  it("★やめた選択肢は、最も近いものに寄せる", () => {
    expect(parseSituation("PREDIVORCE_CONSIDERING")).toBe("UNSURE");
  });

  it("知らない値は null", () => {
    expect(parseSituation("WHATEVER")).toBeNull();
    expect(parseSituation(null)).toBeNull();
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
