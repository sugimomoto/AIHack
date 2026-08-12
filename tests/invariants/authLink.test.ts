import { describe, expect, it } from "vitest";
import { canLinkAuthUid, resolvePartyForUid } from "@/domain/session/authLink";

/**
 * ★Firebase の識別子と当事者の結びつけ
 *
 *   Firebase Authentication は「この人が誰か」を確かめるだけである。
 *   **どの当事者か**は、こちらで決める。
 *   ここを誤ると、他人のケースに入れる。
 *
 * ★このテストは実装より先に書かれた
 */

describe("★結びつけの可否", () => {
  it("まだ誰にも紐づいていない当事者には結びつけられる", () => {
    expect(canLinkAuthUid({ partyAuthUid: null, uid: "u1" })).toEqual({ ok: true });
  });

  it("同じ識別子の再登録は通る（同じ端末で再度サインインした場合）", () => {
    expect(canLinkAuthUid({ partyAuthUid: "u1", uid: "u1" })).toEqual({ ok: true });
  });

  it("★既に別の識別子が紐づいていたら結びつけない", () => {
    const r = canLinkAuthUid({ partyAuthUid: "u1", uid: "u2" });
    expect(r.ok).toBe(false);
  });

  it("★識別子が空なら結びつけない", () => {
    expect(canLinkAuthUid({ partyAuthUid: null, uid: "" }).ok).toBe(false);
  });
});

describe("★識別子から当事者を引く", () => {
  it("★未登録の識別子では当事者を返さない（勝手にケースを作らない）", () => {
    expect(resolvePartyForUid([], "u1")).toBeNull();
  });

  it("登録済みなら返す", () => {
    const parties = [{ id: "p1", caseId: "c1", authUid: "u1", state: "ACTIVE" as const }];
    expect(resolvePartyForUid(parties, "u1")).toEqual({ partyId: "p1", caseId: "c1" });
  });

  it("★退会済みの当事者では返さない", () => {
    const parties = [{ id: "p1", caseId: "c1", authUid: "u1", state: "WITHDRAWN" as const }];
    expect(resolvePartyForUid(parties, "u1")).toBeNull();
  });

  it("★同じ識別子が複数の当事者に紐づいていたら返さない（曖昧な状態で入れない）", () => {
    const parties = [
      { id: "p1", caseId: "c1", authUid: "u1", state: "ACTIVE" as const },
      { id: "p2", caseId: "c2", authUid: "u1", state: "ACTIVE" as const },
    ];
    expect(resolvePartyForUid(parties, "u1")).toBeNull();
  });
});
