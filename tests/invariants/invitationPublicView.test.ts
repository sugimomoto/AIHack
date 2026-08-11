import { describe, expect, it } from "vitest";
import { toPublicView } from "@/domain/invitation/publicView";
import type { InvitationRecord } from "@/domain/invitation/types";

/**
 * ★A-6｜招待の公開APIは未認証で呼ばれる
 *
 * 返す情報を最小化し、revealSenderName を必ず尊重する。
 * トークンさえ知っていれば誰でも叩けるため、ここから当事者の情報が漏れてはならない。
 *
 * ★このテストは実装より先に書かれた
 */

const BASE: InvitationRecord = {
  id: "inv_1",
  caseId: "case_1",
  createdByPartyId: "party_a",
  token: "x".repeat(43),
  method: "EMAIL",
  recipientEmail: "someone@example.test",
  senderName: "架空 太郎",
  revealSenderName: false,
  status: "PENDING",
  expiresAt: "2099-01-01T00:00:00Z",
  createdAt: "2026-08-11T00:00:00Z",
};

describe("A-6｜招待の公開ビュー", () => {
  it("★送信者名を出さない設定では、名前がどこにも現れない", () => {
    const v = toPublicView(BASE, new Date("2026-08-12"));
    expect(JSON.stringify(v)).not.toContain("架空 太郎");
  });

  it("送信者名を出す設定では、名前が含まれる", () => {
    const v = toPublicView({ ...BASE, revealSenderName: true }, new Date("2026-08-12"));
    expect(JSON.stringify(v)).toContain("架空 太郎");
  });

  it("★内部の識別子が漏れない（caseId・partyId・token）", () => {
    const s = JSON.stringify(toPublicView(BASE, new Date("2026-08-12")));
    expect(s).not.toContain("case_1");
    expect(s).not.toContain("party_a");
    expect(s).not.toContain(BASE.token);
  });

  it("★宛先メールアドレスが漏れない", () => {
    const s = JSON.stringify(toPublicView(BASE, new Date("2026-08-12")));
    expect(s).not.toContain("someone@example.test");
  });

  it("★返すキーが限定されている（名前を出さない設定では state のみ）", () => {
    const v = toPublicView(BASE, new Date("2026-08-12"));
    expect(Object.keys(v)).toEqual(["state"]);
  });

  it("★返すキーが限定されている（名前を出す設定でも2つだけ）", () => {
    const v = toPublicView({ ...BASE, revealSenderName: true }, new Date("2026-08-12"));
    expect(Object.keys(v).sort()).toEqual(["senderName", "state"]);
  });

  describe("状態", () => {
    it("期限内かつPENDINGなら OPEN", () => {
      expect(toPublicView(BASE, new Date("2026-08-12")).state).toBe("OPEN");
    });

    it("★期限切れは EXPIRED（PENDINGのままでも）", () => {
      const v = toPublicView({ ...BASE, expiresAt: "2026-08-01T00:00:00Z" }, new Date("2026-08-12"));
      expect(v.state).toBe("EXPIRED");
    });

    it("受諾済みは USED", () => {
      expect(toPublicView({ ...BASE, status: "ACCEPTED" }, new Date("2026-08-12")).state).toBe("USED");
    });

    it("★辞退済みも USED（辞退したことを相手に知らせない）", () => {
      expect(toPublicView({ ...BASE, status: "DECLINED" }, new Date("2026-08-12")).state).toBe("USED");
    });
  });
});
