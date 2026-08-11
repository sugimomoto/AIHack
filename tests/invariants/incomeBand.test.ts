import { describe, expect, it } from "vitest";
import { INCOME_BAND_NOTE, toIncomeBand, parseBand } from "@/domain/income/band";

/**
 * ★INV-2a｜精密な年収は越えない。越えるのは算定表の帯のみ
 *
 * 算定表はもともと年収の帯で区切られており、精密な額は算定に不要である。
 * 帯であれば勤務先や生活水準の推測が困難になる。
 *
 * ★このテストは実装より先に書かれた（→ docs/development-guidelines.md §5.0）
 */

describe("年収の帯変換", () => {
  describe("★帯には精密な額が含まれない", () => {
    it.each([
      4_380_000, 2_100_000, 3_333_333, 7_777_777, 1_234_567,
    ])("%i 円 → 帯に元の数値が現れない", (income) => {
      const band = toIncomeBand(income);
      expect(band).not.toContain(String(income));
      expect(band).not.toContain(String(Math.floor(income / 10_000)));
    });

    it("★同じ帯に入る2つの額は、同じ帯になる（額を復元できない）", () => {
      expect(toIncomeBand(4_010_000)).toBe(toIncomeBand(4_240_000));
    });

    it("帯からは範囲しか分からない", () => {
      const b = parseBand(toIncomeBand(4_380_000));
      expect(b).not.toBeNull();
      expect(b!.maxManYen - b!.minManYen).toBeGreaterThan(0);
    });
  });

  describe("区分", () => {
    it("400万円台前半は 400-425 の帯", () => {
      expect(toIncomeBand(4_000_000)).toBe("400-425");
      expect(toIncomeBand(4_240_000)).toBe("400-425");
    });

    it("境界値は上の帯に入る", () => {
      expect(toIncomeBand(4_250_000)).toBe("425-450");
    });

    it("0円も帯を持つ", () => {
      expect(toIncomeBand(0)).toBe("0-25");
    });

    it("★区分は単調である（収入が増えれば帯も進む）", () => {
      let prev = -1;
      for (let man = 0; man <= 2000; man += 5) {
        const b = parseBand(toIncomeBand(man * 10_000));
        expect(b).not.toBeNull();
        expect(b!.minManYen).toBeGreaterThanOrEqual(prev);
        prev = b!.minManYen;
      }
    });

    it("上限を超える収入も帯に収まる", () => {
      expect(toIncomeBand(50_000_000)).toBeTruthy();
    });
  });

  describe("不正な入力", () => {
    it("負の値は拒否される", () => {
      expect(() => toIncomeBand(-1)).toThrow();
    });

    it("整数でない値は拒否される", () => {
      expect(() => toIncomeBand(1.5)).toThrow();
    });
  });

  it("★区分が未確定であることが記録されている（C-01）", () => {
    expect(INCOME_BAND_NOTE).toMatch(/要確認|未確定/);
  });
});
