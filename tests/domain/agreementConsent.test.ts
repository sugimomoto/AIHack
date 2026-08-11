import { describe, expect, it } from "vitest";
import { consentStateOf, canFinalize } from "@/domain/agreement/consent";

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
