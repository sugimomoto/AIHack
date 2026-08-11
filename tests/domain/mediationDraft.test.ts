import { describe, expect, it } from "vitest";
import { MEDIATION_SYSTEM_PROMPT, buildMediationInput } from "@/domain/support/mediation";

/**
 * ★P3｜数字と条項をLLMに作らせない
 *
 * 調停案では、LLM は**取得済みのレンジを説明する文章だけ**を生成する。
 * 金額そのものは生成しない。
 *
 * ★このテストは実装より先に書かれた
 */

describe("★調停案のプロンプト", () => {
  it("★金額を計算・提案させる指示が無い", () => {
    for (const w of ["計算して", "算出して", "妥当な金額を", "いくらにすべき", "金額を決めて"]) {
      expect(MEDIATION_SYSTEM_PROMPT).not.toContain(w);
    }
  });

  it("★金額を作らないことを明示している", () => {
    expect(MEDIATION_SYSTEM_PROMPT).toMatch(/金額を(作|生成|計算)しない|新しい金額を出さない/);
  });

  it("★法的助言をしないことを明示している", () => {
    expect(MEDIATION_SYSTEM_PROMPT).toMatch(/助言|べきです/);
  });

  it("★出典を併記するよう指示している", () => {
    expect(MEDIATION_SYSTEM_PROMPT).toMatch(/出典|表番号/);
  });
});

describe("★調停案への入力", () => {
  const input = buildMediationInput({
    topicLabel: "養育費",
    range: { minYen: 40000, maxYen: 60000, tableRef: "表1（子1人・0〜14歳）", caveat: "未検証のサンプル値です" },
    proposals: [
      { partyLabel: "Aさん", payload: { monthlyAmount: 30000 } },
      { partyLabel: "Bさん", payload: { monthlyAmount: 40000 } },
    ],
  });

  it("★双方の提案とレンジが渡される", () => {
    expect(input).toContain("30000");
    expect(input).toContain("40000");
    expect(input).toContain("40000");
  });

  it("★注記が入力に含まれる（LLMが無視しても、後段の検査で担保する）", () => {
    expect(input).toContain("未検証");
  });

  it("★原文が渡されない（INV-1）", () => {
    expect(input).not.toContain("必死");
    expect(input).not.toMatch(/こっちだって|ふざけ/);
  });
});
