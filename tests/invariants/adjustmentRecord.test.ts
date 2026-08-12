import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_NOTE,
  adjustmentStateOf,
} from "@/domain/adjustment/record";
import { assertNegotiable, NotNegotiableError } from "@/domain/consultation/negotiable";

/**
 * ★設計は帰結を kind で3つに分けていた。
 *   実装は topic だけで分岐し、**ADJUSTMENT の行き先が無かった。**
 */
describe("★取り決めを動かす経路を、書き込みの直前で守る", () => {
  it("個別の相談から取り決めを動かそうとしたら落ちる", () => {
    expect(() => assertNegotiable("ADJUSTMENT")).toThrow(NotNegotiableError);
    expect(() => assertNegotiable("NOTIFICATION")).toThrow(NotNegotiableError);
  });

  it("取り決めを決める相談は通る", () => {
    expect(() => assertNegotiable("FORMAL")).not.toThrow();
    expect(() => assertNegotiable(null)).not.toThrow();
  });
});

describe("★調整は、双方が揃ったときだけ", () => {
  const AB = ["a", "b"];

  it("双方が同じ内容を出したら揃う", () => {
    const e = [
      { byPartyId: "a", change: { share: "HALF" } },
      { byPartyId: "b", change: { share: "HALF" } },
    ];
    expect(adjustmentStateOf(e, AB)).toBe("AGREED");
  });

  // ★片方だけで確定させると、相手が同意していないものが記録に残る
  it("★片方だけでは揃わない", () => {
    expect(adjustmentStateOf([{ byPartyId: "a", change: { share: "HALF" } }], AB)).toBe("WAITING");
  });

  it("★内容が違えば揃わない", () => {
    const e = [
      { byPartyId: "a", change: { share: "HALF" } },
      { byPartyId: "b", change: { share: "SIXTY_FORTY" } },
    ];
    expect(adjustmentStateOf(e, AB)).toBe("WAITING");
  });

  it("当事者ごとに最新の1件を見る", () => {
    const e = [
      { byPartyId: "a", change: { share: "SIXTY_FORTY" } },
      { byPartyId: "b", change: { share: "HALF" } },
      { byPartyId: "a", change: { share: "HALF" } },
    ];
    expect(adjustmentStateOf(e, AB)).toBe("AGREED");
  });

  // ★1人しかいないケースで揃ったことにしない
  it("★相手が加わっていなければ揃わない", () => {
    expect(adjustmentStateOf([{ byPartyId: "a", change: { share: "HALF" } }], ["a"])).toBe(
      "WAITING",
    );
  });

  it("★公正証書に載らないことを書く文がある", () => {
    expect(ADJUSTMENT_NOTE).toContain("公正証書の原案には入りません");
    expect(ADJUSTMENT_NOTE).toContain("取り決めも変わりません");
  });
});
