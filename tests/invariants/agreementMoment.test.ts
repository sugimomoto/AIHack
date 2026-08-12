import { describe, expect, it } from "vitest";
import {
  CELEBRATORY_WORDS,
  MOMENT_CAPTION,
  MOMENT_FOLLOW_UP,
  MOMENT_LEAD,
  momentFooter,
  momentLinesOf,
} from "@/domain/agreement/moment";

/**
 * ★N-1 合意が成立した瞬間
 *
 *   **これは離婚の条件が決まった瞬間である。**
 *   祝われると、失ったものを思い出させる。
 */

describe("★祝わない", () => {
  const ALL = [MOMENT_LEAD, MOMENT_CAPTION, MOMENT_FOLLOW_UP, momentFooter("2026-08-12")].join("");

  it.each(CELEBRATORY_WORDS)("「%s」が本文に無い", (w) => {
    expect(ALL).not.toContain(w);
  });

  it("★感嘆符を使わない", () => {
    expect(ALL).not.toMatch(/[!！]/);
  });
});

describe("★どちらかが譲ったという構図を作らない", () => {
  it("「同じところに来ました」という言い方にする", () => {
    expect(MOMENT_LEAD).toContain("同じところに来ました");
  });

  it("★譲歩・妥協・勝ち負けの語を使わない", () => {
    for (const w of ["譲", "妥協", "折れ", "勝", "負け", "合意できました"]) {
      expect(MOMENT_LEAD).not.toContain(w);
    }
  });

  // ★決まった瞬間に「もう変えられない」と感じさせない
  it("★変えたくなったときのことを、その場で言う", () => {
    expect(MOMENT_FOLLOW_UP).toContain("変えたくなったとき");
  });
});

describe("表示する行", () => {
  it("金額と支払日を読める形で並べる", () => {
    const lines = momentLinesOf({ monthlyAmount: 50000, payDay: "LAST_DAY" });
    expect(lines).toEqual([
      { label: "養育費", value: "月 50,000円" },
      { label: "お支払い", value: "毎月末日" },
    ]);
  });

  // ★G-3b：意味の定まらない値を条項に見せない
  it("★表記の定義が無いコード値は出さない", () => {
    expect(momentLinesOf({ payDay: "DAY_99" })).toEqual([]);
  });

  it("★入れ子をそのまま出さない", () => {
    const lines = momentLinesOf({ payDay: { code: "LAST_DAY" } });
    expect(JSON.stringify(lines)).not.toContain("object");
    expect(lines).toEqual([]);
  });

  it("空の合意では、何も出さない", () => {
    expect(momentLinesOf({})).toEqual([]);
  });
});

describe("日付", () => {
  it("記録に残ることを併記する", () => {
    expect(momentFooter("2026-08-12")).toBe("2026年8月12日 ／ おふたりの記録に残ります");
  });

  it("日付が読めなければ、日付を作らない", () => {
    expect(momentFooter("")).toBe("おふたりの記録に残ります");
  });
});
