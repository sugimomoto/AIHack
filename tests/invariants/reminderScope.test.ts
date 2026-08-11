import { describe, expect, it } from "vitest";
import { remindersFor } from "@/domain/obligation/reminder";

/**
 * ★リマインダーは自分にだけ
 *
 * 相手に送ると**催促**になる（U-5 急かさない）。
 * 予定を思い出すのは、義務を負う本人の仕事である。
 *
 * ★招待に再送APIを作らなかったのと同じ判断である。
 *   作れてしまうと、いずれ使われる。
 *
 * ★このテストは実装より先に書かれた
 */

const OBLIGATIONS = [
  { topic: "CHILD_SUPPORT", dueDate: "2026-03-25", amountYen: 30000, obligorPartyId: "payer" },
  { topic: "CHILD_SUPPORT", dueDate: "2026-04-25", amountYen: 30000, obligorPartyId: "payer" },
];

describe("★リマインダーの宛先", () => {
  it("義務を負う本人には届く", () => {
    const r = remindersFor(OBLIGATIONS, { partyId: "payer", today: "2026-03-22" });
    expect(r).toHaveLength(1);
    expect(r[0].dueDate).toBe("2026-03-25");
  });

  it("★相手には一切届かない", () => {
    expect(remindersFor(OBLIGATIONS, { partyId: "payee", today: "2026-03-22" })).toEqual([]);
  });

  it("★宛先を指定する引数が無い（誰かに送る、ができない）", () => {
    // 第2引数は「見る人」であって「送る先」ではない
    expect(remindersFor.length).toBe(2);
  });

  it("期日が遠ければ出ない", () => {
    expect(remindersFor(OBLIGATIONS, { partyId: "payer", today: "2026-03-01" })).toEqual([]);
  });

  it("★期日を過ぎたものは出さない（催促にならないように）", () => {
    expect(remindersFor(OBLIGATIONS, { partyId: "payer", today: "2026-03-26" })).toHaveLength(0);
  });

  it("当日は出る", () => {
    expect(remindersFor(OBLIGATIONS, { partyId: "payer", today: "2026-03-25" })).toHaveLength(1);
  });
});
