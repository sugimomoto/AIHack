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

/**
 * ★うまくいかなかったあとの相談
 *
 *   予定どおりに進んでいるあいだ、当事者はアプリを必要としない。
 *   **困るのは、予定どおりにならなかったとき。**
 *   そこは直接連絡したくない相手と話さなければならない場面であり、
 *   **仲介の価値がいちばん高い。**
 *
 * @see .steering/20260812-feedback-pivot/design-upcoming.md §2.5
 */
describe("★うまくいかなかったときの入口がある", () => {
  const all = scenarios as {
    id: string;
    title: string;
    kind: string;
    opening?: string;
    examples?: string[];
  }[];

  const rough = ["会えなかった", "お支払いのことで"];

  it("★会えなかったとき・お支払いのことを相談できる", () => {
    for (const t of rough) {
      expect(all.some((s) => s.title.includes(t)), `入口が無い: ${t}`).toBe(true);
    }
  });

  it("★取り決めを動かさない（ADJUSTMENT）", () => {
    for (const s of all.filter((x) => rough.some((t) => x.title.includes(t)))) {
      expect(s.kind).toBe("ADJUSTMENT");
    }
  });

  it("★責める言い方を、例に置かない", () => {
    // ★書き出しの例は、その人の最初の一文になる。
    //   責める形を置けば、責めるところから始まる。
    const BLAMING = ["なぜ", "どうして", "約束したのに", "守って", "ひどい", "いい加減"];
    for (const s of all.filter((x) => rough.some((t) => x.title.includes(t)))) {
      for (const e of s.examples ?? []) {
        for (const b of BLAMING) {
          expect(e.includes(b), `責める例: ${s.id} ${e}`).toBe(false);
        }
      }
    }
  });
});
