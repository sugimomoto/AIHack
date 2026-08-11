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
import { generateInvitationToken,
  hashToken,
  isWellFormedToken,
} from "@/domain/invitation/token";

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

  /**
   * ★画面（A-2）は「離婚・養育費・調停といった語も使いません」と本文についても約束している。
   *   画面の約束は、テストで担保されていなければ嘘になる。
   */
  it("★本文にも禁止語が含まれない", () => {
    for (const w of SUBJECT_FORBIDDEN_WORDS) {
      expect(mail().body).not.toContain(w);
      expect(mail({ revealSenderName: true }).body).not.toContain(w);
    }
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

  /**
   * ★「断ってよい」はメールに書かない。
   *
   * 納品物の確定文面は「お返事の期限はありません。」までにとどめている。
   * 断ってよいことの明示は、受け取った側の画面（A-3）が担う。
   *
   *   メール      … 相手の職場や家庭で見られうる。情報量を最小にする
   *   A-3 の画面  … 本人が一人で見ている。ここで初めて選択を提示する
   *
   * したがってメールに求めるのは「急かさないこと」である。
   */
  it("★急かす表現が含まれない", () => {
    expect(mail().body).not.toMatch(/至急|お早め|までに|ご返信ください|お急ぎ|期限が/);
  });

  it("★期限がないことが明示されている", () => {
    expect(mail().body).toContain("お返事の期限はありません");
  });
});

/**
 * ★トークンの保存方法
 *
 * 平文で保存すると、この文書が漏れた時点で有効なリンクが復元できてしまう。
 * ハッシュで保存し、照会もハッシュで行う。
 *
 * ★このテストは実装より先に書かれた
 */
describe("トークンのハッシュ化", () => {
  it("同じトークンからは同じハッシュが得られる（照会に使えること）", () => {
    const t = generateInvitationToken();
    expect(hashToken(t)).toBe(hashToken(t));
  });

  it("異なるトークンからは異なるハッシュになる", () => {
    expect(hashToken(generateInvitationToken())).not.toBe(hashToken(generateInvitationToken()));
  });

  it("★ハッシュから元のトークンが読み取れない", () => {
    const t = generateInvitationToken();
    expect(hashToken(t)).not.toContain(t);
    expect(hashToken(t)).not.toBe(t);
  });

  it("十分な長さがある（SHA-256 の16進表現）", () => {
    expect(hashToken(generateInvitationToken())).toMatch(/^[0-9a-f]{64}$/);
  });
});
