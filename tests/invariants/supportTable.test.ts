import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  childrenKeyOf,
  formatRange,
  lookupChildSupport,
  type SupportTableMaster,
} from "@/domain/support/table";

/**
 * ★算定表の参照
 *
 * **LLMに金額を計算させない。**表参照で決定的に取得する。
 *
 * ★データは裁判所公表の令和元年改定標準算定表を、帯グラフから機械的に
 *   抽出したものである（scripts/extract-support-tables.py）。
 *   抽出は次の3つで検証している：
 *     1. 両端からの独立計数が全セルで一致すること
 *     2. 義務者年収↑で帯が下がらず、権利者年収↑で帯が上がらないこと
 *     3. 図中の最上段ラベル（目視）と帯数が一致すること
 *   通らなかった表は**含めていない**。含めなければ参照は null を返す。
 *
 * ★このテストは実装より先に書かれた（実データ形式に合わせて更新）
 */

const SEED = JSON.parse(readFileSync("firestore/seeds/supportTables.json", "utf8")) as SupportTableMaster[];
const t1 = SEED.find((t) => t.childrenKey === "1:0")!;

describe("★実データ（令和元年改定標準算定表）", () => {
  it("検証を通った表のみが含まれる", () => {
    expect(SEED.length).toBe(8);
    for (const t of SEED) expect(t.verified).toBe(true);
  });

  it("★出典が記録されている", () => {
    for (const t of SEED) {
      expect(t.sourceNote).toContain("courts.go.jp");
      expect(t.sourceNote).toContain("令和元年");
    }
  });

  it("★未検証だった表8（子3人・第1子及び第2子15歳以上）は含まれない", () => {
    expect(SEED.find((t) => t.childrenKey === "3:110")).toBeUndefined();
  });

  it("グリッドの寸法が宣言と一致する", () => {
    for (const t of SEED) {
      expect(t.grid.length).toBe(t.payerMaxMan / t.payerStepMan + 1);
      expect(t.grid[0].length).toBe((t.payeeMaxMan / t.payeeStepMan + 1) * 2);
    }
  });
});

describe("★表1（子1人・0〜14歳）の参照", () => {
  const at = (payer: number, payee: number) => lookupChildSupport(t1, { payerMan: payer, payeeMan: payee });

  /**
   * ★一次資料の図から目視で読み取った値との照合。
   *   図中に印字された帯ラベルの位置がそのまま検証点になる。
   */
  it.each([
    [50, 100, 0, 1],
    [175, 100, 1, 2],
    [300, 100, 2, 4],
    [475, 100, 4, 6],
    [650, 100, 6, 8],
    [825, 100, 8, 10],
    [1000, 100, 10, 12],
  ])("義務者%i万・権利者%i万 → %i〜%i万円", (payer, payee, lo, hi) => {
    const r = at(payer, payee)!;
    expect([r.minYen, r.maxYen]).toEqual([lo * 10000, hi * 10000]);
  });

  it("★義務者の年収が0なら 0〜1万円", () => {
    expect(at(0, 0)!.maxYen).toBe(10000);
  });

  it("★出典（表番号）が必ず併記される", () => {
    expect(at(500, 0)!.tableRef).toContain("表1");
  });

  it("★検証済みの表では注記が付かない", () => {
    expect(at(500, 0)!.caveat).toBeUndefined();
  });

  it("★同じ入力に必ず同じ結果を返す（決定的）", () => {
    expect(at(500, 200)).toEqual(at(500, 200));
  });
});

describe("★表の範囲外", () => {
  it("★年収が表の上限を超えたら null（外挿しない）", () => {
    expect(lookupChildSupport(t1, { payerMan: 2500, payeeMan: 0 })).toBeNull();
    expect(lookupChildSupport(t1, { payerMan: 500, payeeMan: 1500 })).toBeNull();
  });

  it("★負の年収は null", () => {
    expect(lookupChildSupport(t1, { payerMan: -100, payeeMan: 0 })).toBeNull();
  });

  it("★刻みの途中は切り捨てず、直近の下の行を使う", () => {
    // 25万円刻み。510万は500万の行を使う（表の読み方に合わせる）
    expect(lookupChildSupport(t1, { payerMan: 510, payeeMan: 0 })).toEqual(
      lookupChildSupport(t1, { payerMan: 500, payeeMan: 0 }),
    );
  });
});

describe("★未検証の表を使った出力", () => {
  const unverified: SupportTableMaster = { ...t1, verified: false, sourceNote: "未検証" };
  const r = lookupChildSupport(unverified, { payerMan: 500, payeeMan: 0 })!;

  it("★参照結果そのものに注記が含まれる（呼び出し側に任せない）", () => {
    expect(r.caveat).toContain("未検証");
  });

  it("★整形した文言に、必ず注記が現れる", () => {
    expect(formatRange(r)).toContain("未検証");
  });

  it("★注記だけを外した文言を作れない（引数を1つしか取らない）", () => {
    expect(formatRange.length).toBe(1);
  });
});

describe("★子の構成から表を選ぶ", () => {
  it.each([
    [[5], "1:0"],
    [[16], "1:1"],
    [[3, 7], "2:00"],
    [[16, 7], "2:10"],
    [[15, 18], "2:11"],
    [[1, 3, 5], "3:000"],
    [[16, 3, 5], "3:100"],
    [[16, 17, 18], "3:111"],
  ])("年齢%j → %s", (ages, key) => {
    expect(childrenKeyOf(ages as number[])).toBe(key);
  });

  it("★年齢の並び順に依存しない", () => {
    expect(childrenKeyOf([7, 16])).toBe(childrenKeyOf([16, 7]));
  });

  it("★4人以上は表が無い（null）", () => {
    expect(childrenKeyOf([1, 2, 3, 4])).toBeNull();
    expect(childrenKeyOf([])).toBeNull();
  });
});
