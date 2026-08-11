import { describe, expect, it } from "vitest";
import { FORBIDDEN_WORDS, assertNoForbiddenWords, sanitizeReception } from "@/domain/dialogue/vocabulary";
import { RECEPTION_SYSTEM_PROMPT } from "@/domain/dialogue/prompts";

/**
 * ★感情がブロックされないこと
 *
 * 一般的な対話AIは、罵倒や怒りを拒否する。
 * このプロダクトは、**まさにその感情を受け止めるために存在している。**
 * 出せなければ、そもそも「相手に渡さない」という価値が発生しない。
 *
 * ★このテストは実装より先に書かれた
 */

describe("★受け止めのプロンプトが拒否を指示していない", () => {
  const REFUSAL_PATTERNS = [
    "お答えできません",
    "回答できません",
    "不適切",
    "お控えください",
    "拒否",
    "応じられません",
  ];

  it("★拒否を指示する語が含まれない", () => {
    for (const w of REFUSAL_PATTERNS) {
      expect(RECEPTION_SYSTEM_PROMPT).not.toContain(w);
    }
  });

  it("★感情を受け止めるよう明示している", () => {
    expect(RECEPTION_SYSTEM_PROMPT).toMatch(/受け止め|否定しない/);
  });

  it("★相手に渡らないことがプロンプトに書かれている", () => {
    expect(RECEPTION_SYSTEM_PROMPT).toMatch(/届きません|渡りません|共有されません/);
  });
});

/**
 * ★glossary.md §4｜使ってはいけない語
 *
 * プロンプトで指示するだけでは漏れる。**生成後に検査する。**
 */
describe("★使ってはいけない語", () => {
  it("一覧に主要な語が含まれる", () => {
    for (const w of ["違反", "未払い", "元夫", "元妻"]) {
      expect(FORBIDDEN_WORDS.map((f) => f.word)).toContain(w);
    }
  });

  it("★禁止語を含む文字列を検出する", () => {
    expect(() => assertNoForbiddenWords("入金の未払いが続いています")).toThrow(/未払い/);
    expect(() => assertNoForbiddenWords("元夫からのご連絡です")).toThrow(/元夫/);
  });

  it("禁止語を含まない文字列は通る", () => {
    expect(() => assertNoForbiddenWords("入金が確認できていません")).not.toThrow();
  });

  it("★言い換えて返す（生成をやり直さずに救う）", () => {
    expect(sanitizeReception("約束違反です")).toBe("約束逸脱です");
    expect(sanitizeReception("元妻からの連絡")).toBe("お相手からの連絡");
  });

  it("★言い換えた結果に禁止語が残らない", () => {
    const s = sanitizeReception("元夫の違反と未払いについて");
    expect(() => assertNoForbiddenWords(s)).not.toThrow();
  });
});
