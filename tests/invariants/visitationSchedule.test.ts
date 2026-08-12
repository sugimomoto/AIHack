import { describe, expect, it } from "vitest";
import { nthWeekdayOf, visitationDatesOf } from "@/domain/obligation/visitation";
import { generateObligations } from "@/domain/obligation/schedule";

/**
 * ★「面会交流に『期日と金額』は無い」と書いて、予定を作らなかった。
 *   **期日が無いというのは誤りだった。**
 *
 *   結果として、お金の義務だけが毎月並び、会う日は一度も並ばなかった。
 *   片方だけを並べる仕組みは、それ自体が立場を作る（→ Issue #5）。
 */

describe("第n週の曜日", () => {
  // 2026年8月1日は土曜日
  it("第1土曜・第2土曜", () => {
    expect(nthWeekdayOf(2026, 8, "SAT", 1)).toBe("2026-08-01");
    expect(nthWeekdayOf(2026, 8, "SAT", 2)).toBe("2026-08-08");
  });

  it("月をまたいだ曜日も正しい", () => {
    // 2026年9月1日は火曜日 → 第1日曜は 9/6
    expect(nthWeekdayOf(2026, 9, "SUN", 1)).toBe("2026-09-06");
  });

  // ★第5土曜が無い月がある
  it("★その月に無い週は作らない", () => {
    expect(nthWeekdayOf(2026, 9, "SUN", 5)).toBeNull();
  });

  it("★未知の曜日・範囲外の週では作らない", () => {
    expect(nthWeekdayOf(2026, 8, "XXX", 1)).toBeNull();
    expect(nthWeekdayOf(2026, 8, "SAT", 0)).toBeNull();
    expect(nthWeekdayOf(2026, 8, "SAT", 6)).toBeNull();
  });
});

describe("★面会交流の予定", () => {
  it("月1回・第2土曜が、毎月並ぶ", () => {
    const d = visitationDatesOf({
      payload: { frequency: "MONTHLY_1", dayOfWeek: "SAT", weekOfMonth: 2 },
      fromYear: 2026,
      fromMonth: 8,
      months: 3,
    });
    expect(d).toEqual(["2026-08-08", "2026-09-12", "2026-10-10"]);
  });

  it("週1回なら、その月のすべての該当曜日", () => {
    const d = visitationDatesOf({
      payload: { frequency: "WEEKLY_1", dayOfWeek: "SAT" },
      fromYear: 2026,
      fromMonth: 8,
      months: 1,
    });
    expect(d).toEqual(["2026-08-01", "2026-08-08", "2026-08-15", "2026-08-22", "2026-08-29"]);
  });

  it("月2回で週の指定が無ければ、第1・第2週に置く", () => {
    const d = visitationDatesOf({
      payload: { frequency: "MONTHLY_2", dayOfWeek: "SUN" },
      fromYear: 2026,
      fromMonth: 9,
      months: 1,
    });
    expect(d).toEqual(["2026-09-06", "2026-09-13"]);
  });

  // ★決まっていないものを、こちらで決めない
  it("★曜日が決まっていなければ、日付を作らない", () => {
    expect(
      visitationDatesOf({
        payload: { frequency: "MONTHLY_1" },
        fromYear: 2026,
        fromMonth: 8,
        months: 3,
      }),
    ).toEqual([]);
  });

  it("★未知の頻度では作らない", () => {
    expect(
      visitationDatesOf({
        payload: { frequency: "OTHER", dayOfWeek: "SAT" },
        fromYear: 2026,
        fromMonth: 8,
        months: 3,
      }),
    ).toEqual([]);
  });

  it("合意が無ければ何も作らない", () => {
    expect(visitationDatesOf({ payload: null, fromYear: 2026, fromMonth: 8, months: 3 })).toEqual(
      [],
    );
  });
});

describe("★合意から予定が出る（面会交流も）", () => {
  const base = { from: "2026-08-01", months: 3, obligorPartyId: "party_a" };

  it("面会交流の合意から、会う日が並ぶ", () => {
    const o = generateObligations({
      ...base,
      items: [
        {
          topic: "VISITATION",
          status: "AGREED",
          payload: { frequency: "MONTHLY_1", dayOfWeek: "SAT", weekOfMonth: 2 },
          agreedAt: "2026-08-01T00:00:00Z",
        },
      ],
    });
    expect(o.map((x) => x.dueDate)).toEqual(["2026-08-08", "2026-09-12", "2026-10-10"]);
  });

  // ★無いものを 0 と書かない
  it("★面会交流には金額を付けない", () => {
    const o = generateObligations({
      ...base,
      items: [
        {
          topic: "VISITATION",
          status: "AGREED",
          payload: { frequency: "MONTHLY_1", dayOfWeek: "SAT", weekOfMonth: 2 },
          agreedAt: "2026-08-01T00:00:00Z",
        },
      ],
    });
    expect(o.every((x) => x.amountYen === null)).toBe(true);
  });

  it("★合意より前の日は入れない", () => {
    const o = generateObligations({
      ...base,
      items: [
        {
          topic: "VISITATION",
          status: "AGREED",
          payload: { frequency: "MONTHLY_1", dayOfWeek: "SAT", weekOfMonth: 2 },
          agreedAt: "2026-09-01T00:00:00Z",
        },
      ],
    });
    expect(o.map((x) => x.dueDate)).toEqual(["2026-09-12", "2026-10-10"]);
  });

  it("養育費と面会交流が同時に並ぶ", () => {
    const o = generateObligations({
      ...base,
      months: 1,
      items: [
        {
          topic: "CHILD_SUPPORT",
          status: "AGREED",
          payload: { monthlyAmount: 50000, payDay: "LAST_DAY" },
          agreedAt: "2026-08-01T00:00:00Z",
        },
        {
          topic: "VISITATION",
          status: "AGREED",
          payload: { frequency: "MONTHLY_1", dayOfWeek: "SAT", weekOfMonth: 2 },
          agreedAt: "2026-08-01T00:00:00Z",
        },
      ],
    });
    expect(o.map((x) => x.topic).sort()).toEqual(["CHILD_SUPPORT", "VISITATION"]);
  });
});
