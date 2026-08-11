import { describe, expect, it } from "vitest";
import {
  DEVIATION_LABELS,
  assessEnforceability,
  detectDeviations,
  PRIORITY_CLAIM_CAVEAT,
} from "@/domain/obligation/deviation";
import { FORBIDDEN_WORDS } from "@/domain/dialogue/vocabulary";

/**
 * ★逸脱検知と法的状態
 *
 * ★アプリは入金を観測できない（S8 と同じ）。
 *   検知するのは「**記録が無いまま期日を過ぎた**」ことであって、
 *   「支払われていない」ことではない。
 *
 * ★このテストは実装より先に書かれた
 */

const OB = (dueDate: string) => ({
  key: `CHILD_SUPPORT_${dueDate}`,
  dueDate,
  amountYen: 30000,
  obligorPartyId: "payer",
});

describe("★逸脱の検知", () => {
  it("★期日を過ぎ、記録が無ければ検知する", () => {
    const d = detectDeviations([OB("2026-03-25")], {}, { today: "2026-04-01" });
    expect(d).toHaveLength(1);
    expect(d[0].daysPast).toBe(7);
  });

  it("★期日当日は検知しない", () => {
    expect(detectDeviations([OB("2026-03-25")], {}, { today: "2026-03-25" })).toHaveLength(0);
  });

  it("★猶予のうちは検知しない（振込の反映遅れがありうる）", () => {
    expect(detectDeviations([OB("2026-03-25")], {}, { today: "2026-03-27" })).toHaveLength(0);
  });

  it("★どちらか一方でも記録があれば検知しない", () => {
    const f = { "CHILD_SUPPORT_2026-03-25": { paidBy: "payer" } };
    expect(detectDeviations([OB("2026-03-25")], f, { today: "2026-04-01" })).toHaveLength(0);
  });

  it("期日前は検知しない", () => {
    expect(detectDeviations([OB("2026-04-25")], {}, { today: "2026-04-01" })).toHaveLength(0);
  });
});

describe("★逸脱の文言", () => {
  it("★責める語彙が出ない", () => {
    for (const t of Object.values(DEVIATION_LABELS)) {
      for (const f of FORBIDDEN_WORDS) expect(t).not.toContain(f.word);
      for (const w of ["滞納", "遅延", "怠", "支払われていません"]) expect(t).not.toContain(w);
    }
  });

  it("★「確認できていない」であって「支払われていない」ではない", () => {
    expect(DEVIATION_LABELS.NOTICE).toContain("確認できて");
  });
});

describe("★先取特権の範囲判定", () => {
  const table = { perChildYen: 80000, verified: false, sourceNote: "未検証" };

  it("範囲内なら超過が0", () => {
    const r = assessEnforceability({ monthlyAmountYen: 60000, childCount: 1 }, table);
    expect(r.withinPriorityClaim).toBe(true);
    expect(r.excessYen).toBe(0);
  });

  it("★上限は子の人数に比例する", () => {
    expect(assessEnforceability({ monthlyAmountYen: 150000, childCount: 2 }, table).withinPriorityClaim).toBe(true);
    expect(assessEnforceability({ monthlyAmountYen: 150000, childCount: 1 }, table).withinPriorityClaim).toBe(false);
  });

  it("超過分が算出される", () => {
    const r = assessEnforceability({ monthlyAmountYen: 100000, childCount: 1 }, table);
    expect(r.excessYen).toBe(20000);
  });

  it("★未検証の閾値では注記が必ず付く（算定表と同じ扱い）", () => {
    const r = assessEnforceability({ monthlyAmountYen: 60000, childCount: 1 }, table);
    expect(r.caveat).toBe(PRIORITY_CLAIM_CAVEAT);
  });

  it("検証済みなら注記が付かない", () => {
    const r = assessEnforceability({ monthlyAmountYen: 60000, childCount: 1 }, { ...table, verified: true });
    expect(r.caveat).toBeUndefined();
  });

  it("★子の人数が0なら判定しない（推測しない）", () => {
    expect(assessEnforceability({ monthlyAmountYen: 60000, childCount: 0 }, table)).toBeNull();
  });

  it("★『差押えをすべき』とは言わない", () => {
    const r = assessEnforceability({ monthlyAmountYen: 60000, childCount: 1 }, table)!;
    expect(r.explanation).not.toContain("すべき");
    expect(r.explanation).not.toContain("してください");
  });
});
