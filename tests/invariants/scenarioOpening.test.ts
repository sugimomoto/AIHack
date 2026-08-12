import { describe, expect, it } from "vitest";
import scenarios from "../../firestore/seeds/scenarios.json";

/**
 * ★トピックを選んでも、空の入力欄に向かうだけだった。
 *   何をどう書けばよいか分からないまま書かせない。
 *
 * ★AIに毎回作らせない。
 *   毎回同じ文になり、勝手な数字も作られず、費用もかからない。
 */
type Scenario = {
  id: string;
  title: string;
  kind: string;
  promptHint?: string;
  opening?: string;
  examples?: string[];
};
const list = scenarios as Scenario[];

describe("★書き出しの案内", () => {
  it("すべてのシナリオにある", () => {
    for (const s of list) {
      expect(s.opening, `opening が無い: ${s.id}`).toBeTruthy();
      expect((s.examples ?? []).length, `examples が無い: ${s.id}`).toBeGreaterThan(0);
    }
  });

  // ★promptHint は LLM への指示。当事者に見せるものではない
  it("★LLMへの指示をそのまま流用していない", () => {
    for (const s of list) {
      expect(s.opening).not.toBe(s.promptHint);
    }
  });

  // ★勝手な数字を作らない。例は穴あきにする
  it("★例に具体的な金額・日付を埋めない", () => {
    for (const s of list) {
      for (const e of s.examples ?? []) {
        expect(e, `${s.id}: ${e}`).not.toMatch(/[0-9]{3,}円/);
        expect(e, `${s.id}: ${e}`).not.toMatch(/20[0-9]{2}年/);
      }
    }
  });

  it("★詰問にしない（〜してください と指示しない）", () => {
    for (const s of list) {
      expect(s.opening).not.toMatch(/入力してください|記入してください|必ず/);
    }
  });

  // ★「テンプレート」「定型文」は使ってはいけない語
  it("★禁止語を使わない", () => {
    for (const s of list) {
      const all = `${s.opening}${(s.examples ?? []).join("")}`;
      for (const w of ["テンプレート", "定型文", "元夫", "元妻", "未払い", "滞納"]) {
        expect(all, `${s.id}`).not.toContain(w);
      }
    }
  });
});
