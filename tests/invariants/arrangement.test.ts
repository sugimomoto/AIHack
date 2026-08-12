import { describe, expect, it } from "vitest";
import { arrangementFrom, isAccepted, resolveDate } from "@/domain/obligation/arrangement";

/**
 * ★「8月22日でOKです」と了承しても、どこにも残らなかった。
 *   L2 の行き先である「これから」が、お金の義務しか受け取っていなかった。
 */
describe("★了承があって、はじめて約束になる", () => {
  it("提案だけでは作らない", () => {
    expect(isAccepted(["PROPOSAL"])).toBe(false);
    expect(
      arrangementFrom({ payload: { date: "8月22日" }, intents: ["PROPOSAL"], today: "2026-08-12" }),
    ).toBeNull();
  });

  it("了承があれば作る", () => {
    expect(
      arrangementFrom({
        payload: { date: "8月22日", subject: "送迎" },
        intents: ["ACCEPT"],
        today: "2026-08-12",
      }),
    ).toEqual({ date: "2026-08-22", label: "送迎" });
  });

  // ★いつの約束か分からないものを予定にしない
  it("★日付が無ければ作らない", () => {
    expect(
      arrangementFrom({ payload: { subject: "送迎" }, intents: ["ACCEPT"], today: "2026-08-12" }),
    ).toBeNull();
    expect(arrangementFrom({ payload: null, intents: ["ACCEPT"], today: "2026-08-12" })).toBeNull();
  });

  it("時刻と場所があれば添える", () => {
    expect(
      arrangementFrom({
        payload: { date: "8月22日", time: "10時", place: "○○駅", subject: "受け渡し" },
        intents: ["ACCEPT"],
        today: "2026-08-12",
      }),
    ).toEqual({ date: "2026-08-22", label: "10時 ○○駅 受け渡し" });
  });
});

describe("★年は補わない／基準日から決める", () => {
  it("これから来る月日は今年", () => {
    expect(resolveDate("8月22日", "2026-08-12")).toBe("2026-08-22");
  });

  // ★「1月20日」を8月に言えば、来年のこと
  it("★過ぎている月日は翌年", () => {
    expect(resolveDate("1月20日", "2026-08-12")).toBe("2027-01-20");
  });

  it("年が書かれていればそれを使う", () => {
    expect(resolveDate("2027-03-01", "2026-08-12")).toBe("2027-03-01");
  });

  it("★存在しない日付は作らない", () => {
    expect(resolveDate("2月31日", "2026-08-12")).toBeNull();
    expect(resolveDate("13月1日", "2026-08-12")).toBeNull();
  });

  it("★読み取れないものは作らない", () => {
    expect(resolveDate("来週の土曜", "2026-08-12")).toBeNull();
    expect(resolveDate("20260822", "2026-08-12")).toBeNull();
    expect(resolveDate(null, "2026-08-12")).toBeNull();
  });
});
