import { describe, expect, it } from "vitest";
import { lookupChildSupport, formatRange, type SupportTableMaster } from "@/domain/support/table";

/**
 * ★算定表の参照
 *
 * **LLMに金額を計算させない。**テーブル参照で決定的に取得する。
 *
 * ★そして、一次資料からの正確なデータ化ができていない（R-18）。
 *   それらしい数字を算定表の値として提示すると、
 *   **このプロダクトが防ごうとしている害を、自分で起こす。**
 *   当事者は「裁判所の基準」として受け取る。
 *
 *   → 未検証であることを、出力から外せない形にする。
 *
 * ★このテストは実装より先に書かれた
 */

const VERIFIED: SupportTableMaster = {
  id: "st_test_v1",
  tableRef: "表1（子1人・0〜14歳）",
  verified: true,
  sourceNote: "一次資料と照合済み",
  rows: [
    { payerBand: "400-425", payeeBand: "0-25", minYen: 40000, maxYen: 60000 },
    { payerBand: "425-450", payeeBand: "0-25", minYen: 40000, maxYen: 60000 },
    { payerBand: "425-450", payeeBand: "200-225", minYen: 20000, maxYen: 40000 },
  ],
};

const UNVERIFIED: SupportTableMaster = { ...VERIFIED, verified: false, sourceNote: "未検証のサンプル値" };

describe("★算定表の参照", () => {
  it("該当する行のレンジを返す", () => {
    const r = lookupChildSupport(VERIFIED, { payerBand: "425-450", payeeBand: "200-225" });
    expect(r).not.toBeNull();
    expect(r!.minYen).toBe(20000);
    expect(r!.maxYen).toBe(40000);
  });

  it("★出典（表番号）が必ず併記される", () => {
    const r = lookupChildSupport(VERIFIED, { payerBand: "400-425", payeeBand: "0-25" });
    expect(r!.tableRef).toBe("表1（子1人・0〜14歳）");
  });

  it("★表に無い組み合わせでは null を返す（外挿しない）", () => {
    expect(lookupChildSupport(VERIFIED, { payerBand: "900-925", payeeBand: "0-25" })).toBeNull();
    expect(lookupChildSupport(VERIFIED, { payerBand: "425-450", payeeBand: "999-1000" })).toBeNull();
  });

  it("★同じ入力に必ず同じ結果を返す（決定的）", () => {
    const a = lookupChildSupport(VERIFIED, { payerBand: "425-450", payeeBand: "0-25" });
    const b = lookupChildSupport(VERIFIED, { payerBand: "425-450", payeeBand: "0-25" });
    expect(a).toEqual(b);
  });
});

describe("★未検証の表を使った出力", () => {
  const r = lookupChildSupport(UNVERIFIED, { payerBand: "425-450", payeeBand: "0-25" })!;

  it("★参照結果そのものに注記が含まれる（呼び出し側に任せない）", () => {
    expect(r.caveat).toBeTruthy();
    expect(r.caveat).toContain("未検証");
  });

  it("検証済みの表では注記が無い", () => {
    const v = lookupChildSupport(VERIFIED, { payerBand: "425-450", payeeBand: "0-25" })!;
    expect(v.caveat).toBeUndefined();
  });

  it("★整形した文言に、必ず注記が現れる", () => {
    expect(formatRange(r)).toContain("未検証");
  });

  it("★注記を持つ結果から、注記だけを外した文言を作れない", () => {
    // formatRange は caveat があれば必ず含める。分岐で外せる引数を持たない
    expect(formatRange.length).toBe(1);
  });

  it("整形した文言に金額と出典が入る", () => {
    const s = formatRange(r);
    expect(s).toContain("4万");
    expect(s).toContain("6万");
    expect(s).toContain("表1");
  });
});
