import { describe, expect, it } from "vitest";
import {
  INVITATION_EVENTS,
  INVITATION_STATUSES,
  InvalidInvitationTransitionError,
  canTransition,
  isOpen,
  transition,
} from "@/domain/invitation/stateMachine";
import { buildInvitationMail, SUBJECT_FORBIDDEN_WORDS } from "@/domain/invitation/mail";
import { generateInvitationToken, isWellFormedToken } from "@/domain/invitation/token";

/**
 * 招待
 *
 * ★このテストは実装より先に書かれた（→ docs/development-guidelines.md §5.0）
 */

describe("招待の状態遷移", () => {
  const EXPECTED: [string, string, string][] = [
    ["PENDING", "ACCEPT", "ACCEPTED"],
    ["PENDING", "DECLINE", "DECLINED"],
    ["PENDING", "EXPIRE", "EXPIRED"],
  ];

  it.each(EXPECTED)("%s --%s--> %s", (from, ev, to) => {
    expect(transition(from as never, ev as never)).toBe(to);
  });

  it("★終端からは遷移できない（受諾後に辞退できない）", () => {
    for (const from of ["ACCEPTED", "DECLINED", "EXPIRED"] as const) {
      for (const ev of INVITATION_EVENTS) {
        expect(canTransition(from, ev)).toBe(false);
        expect(() => transition(from, ev)).toThrow(InvalidInvitationTransitionError);
      }
    }
  });

  it("全組み合わせのうち、許可されるのは3つだけ", () => {
    const allowed = INVITATION_STATUSES.flatMap((s) =>
      INVITATION_EVENTS.filter((e) => canTransition(s, e)),
    );
    expect(allowed).toHaveLength(3);
  });

  it("PENDING のみが未確定の状態である", () => {
    expect(INVITATION_STATUSES.filter(isOpen)).toEqual(["PENDING"]);
  });
});

describe("★招待トークン", () => {
  it("十分な長さを持つ", () => {
    expect(generateInvitationToken().length).toBeGreaterThanOrEqual(32);
  });

  it("★1000回生成して衝突しない", () => {
    const s = new Set(Array.from({ length: 1000 }, () => generateInvitationToken()));
    expect(s.size).toBe(1000);
  });

  it("URLに安全な文字のみを使う", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateInvitationToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("短い文字列や連番は不正と判定される", () => {
    expect(isWellFormedToken("12345")).toBe(false);
    expect(isWellFormedToken("")).toBe(false);
    expect(isWellFormedToken(generateInvitationToken())).toBe(true);
  });
});

describe("★招待メールの制約", () => {
  const mail = (opts?: { revealSenderName?: boolean; senderName?: string }) =>
    buildInvitationMail({
      url: "https://example.test/invite/abc",
      senderName: opts?.senderName ?? "架空 太郎",
      revealSenderName: opts?.revealSenderName ?? false,
    });

  it("★件名に禁止語が含まれない", () => {
    const { subject } = mail();
    for (const w of SUBJECT_FORBIDDEN_WORDS) expect(subject).not.toContain(w);
  });

  it("★当事者が自由文を差し込めない（引数に本文がない）", () => {
    expect(buildInvitationMail.length).toBe(1);
    const keys = Object.keys({ url: "", senderName: "", revealSenderName: false });
    expect(keys).not.toContain("body");
    expect(keys).not.toContain("message");
  });

  it("送信者名を出さない設定では、名前が本文に現れない", () => {
    const { subject, body } = mail({ revealSenderName: false, senderName: "架空 太郎" });
    expect(body).not.toContain("架空 太郎");
    expect(subject).not.toContain("架空 太郎");
  });

  it("送信者名を出す設定では、本文に現れる", () => {
    expect(mail({ revealSenderName: true }).body).toContain("架空 太郎");
  });

  it("招待URLが含まれる", () => {
    expect(mail().body).toContain("https://example.test/invite/abc");
  });

  it("★断ってよいことが書かれている", () => {
    expect(mail().body).toMatch(/断|お断り|やめて|無視/);
  });
});
