import { describe, expect, it } from "vitest";
import {
  canFinalize,
  canFinalizeAgreement,
  consentStateOf,
  payloadsAgree,
} from "@/domain/agreement/consent";

/**
 * ★双方の承諾でのみ合意になる
 *
 * 片方の承諾で確定すると、それは合意ではない。
 *
 * ★このテストは実装より先に書かれた
 */

describe("★合意の成立", () => {
  it("双方が承諾したときのみ確定できる", () => {
    expect(canFinalize({ a: "ACCEPTED", b: "ACCEPTED" })).toBe(true);
  });

  it("★片方だけでは確定できない", () => {
    expect(canFinalize({ a: "ACCEPTED", b: "PENDING" })).toBe(false);
    expect(canFinalize({ a: "PENDING", b: "ACCEPTED" })).toBe(false);
  });

  it("★片方が拒否したら確定できない", () => {
    expect(canFinalize({ a: "ACCEPTED", b: "REJECTED" })).toBe(false);
  });

  it("どちらも未回答では確定できない", () => {
    expect(canFinalize({ a: "PENDING", b: "PENDING" })).toBe(false);
  });

  it("状態を説明できる", () => {
    expect(consentStateOf({ a: "ACCEPTED", b: "PENDING" })).toBe("WAITING_OTHER");
    expect(consentStateOf({ a: "PENDING", b: "PENDING" })).toBe("WAITING_BOTH");
    expect(consentStateOf({ a: "ACCEPTED", b: "ACCEPTED" })).toBe("AGREED");
    expect(consentStateOf({ a: "ACCEPTED", b: "REJECTED" })).toBe("REJECTED");
  });
});

/**
 * ★提案が一致していなければ、承諾しても合意にならない
 *
 * 実機で欠陥を検出した。
 *   Aの提案 3万円 ／ Bの提案 4万円
 *   双方が「この内容で進める」を押した
 *   → monthlyAmount: 30000 が合意として記録された
 *
 * **誰も合意していない金額が確定した。**
 *
 * 何に承諾したのかが定まっていなければ、承諾は意味を持たない。
 * そして P3 により、AIが中間の金額を決めることもできない。
 * **一致は当事者が作るしかない。**
 */
describe("★提案の一致", () => {
  it("同じ payload なら合意できる", () => {
    expect(payloadsAgree([{ monthlyAmount: 30000 }, { monthlyAmount: 30000 }])).toBe(true);
  });

  it("★異なる payload では合意できない", () => {
    expect(payloadsAgree([{ monthlyAmount: 30000 }, { monthlyAmount: 40000 }])).toBe(false);
  });

  it("★項目が欠けていても一致とみなさない", () => {
    expect(payloadsAgree([{ monthlyAmount: 30000 }, { monthlyAmount: 30000, payDay: "DAY_25" }])).toBe(false);
  });

  it("キーの順序は影響しない", () => {
    expect(payloadsAgree([{ a: 1, b: 2 }, { b: 2, a: 1 }])).toBe(true);
  });

  it("★提案が揃っていなければ一致しない", () => {
    expect(payloadsAgree([{ monthlyAmount: 30000 }])).toBe(false);
    expect(payloadsAgree([])).toBe(false);
    expect(payloadsAgree([{ monthlyAmount: 30000 }, null])).toBe(false);
  });

  it("★一致していなければ、双方が承諾しても確定できない", () => {
    expect(
      canFinalizeAgreement({ a: "ACCEPTED", b: "ACCEPTED" }, [{ monthlyAmount: 30000 }, { monthlyAmount: 40000 }]),
    ).toBe(false);
  });

  it("一致していて双方が承諾すれば確定できる", () => {
    expect(
      canFinalizeAgreement({ a: "ACCEPTED", b: "ACCEPTED" }, [{ monthlyAmount: 30000 }, { monthlyAmount: 30000 }]),
    ).toBe(true);
  });

  it("状態として区別できる", () => {
    expect(
      consentStateOf({ a: "ACCEPTED", b: "ACCEPTED" }, [{ monthlyAmount: 30000 }, { monthlyAmount: 40000 }]),
    ).toBe("NEEDS_CONVERGENCE");
  });
});
