import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE,
  cookieOptions,
  signSession,
  verifySession,
} from "@/domain/session/token";

/**
 * ★セッション
 *
 * セッションが偽造できれば、**誰でも他人の当事者になれる。**
 * S19 で開発用切替を厳しくしたのと同じ理由である。
 *
 * ★パスワードを一切保持しない。
 *   このアプリは住所・年収・子の情報を持つ。
 *   漏れて困るものを、そもそも預からない。
 *
 * ★このテストは実装より先に書かれた
 */

const KEY = "test-secret-key-0123456789abcdef";
const OTHER = "another-secret-key-abcdef0123456";
const NOW = Date.parse("2026-08-11T00:00:00Z");
const PAYLOAD = { partyId: "party_a", caseId: "case_1" };

describe("★署名と検証", () => {
  it("自分で署名したものは通る", () => {
    const t = signSession(PAYLOAD, { key: KEY, now: NOW });
    expect(verifySession(t, { key: KEY, now: NOW })).toEqual(PAYLOAD);
  });

  it("★1文字でも改竄されたら通らない", () => {
    const t = signSession(PAYLOAD, { key: KEY, now: NOW });
    for (let i = 0; i < t.length; i += 7) {
      const c = t[i] === "a" ? "b" : "a";
      const tampered = t.slice(0, i) + c + t.slice(i + 1);
      expect(verifySession(tampered, { key: KEY, now: NOW })).toBeNull();
    }
  });

  it("★別の鍵で署名されたものは通らない", () => {
    const t = signSession(PAYLOAD, { key: OTHER, now: NOW });
    expect(verifySession(t, { key: KEY, now: NOW })).toBeNull();
  });

  it("★partyId を差し替えたものは通らない", () => {
    const t = signSession(PAYLOAD, { key: KEY, now: NOW });
    const [body, sig] = t.split(".");
    const evil = Buffer.from(
      JSON.stringify({ ...PAYLOAD, partyId: "party_b", exp: NOW + 1000 }),
    ).toString("base64url");
    expect(verifySession(`${evil}.${sig}`, { key: KEY, now: NOW })).toBeNull();
    expect(body).not.toBe(evil);
  });

  it("★署名の無い文字列は通らない", () => {
    expect(verifySession("", { key: KEY, now: NOW })).toBeNull();
    expect(verifySession("abc", { key: KEY, now: NOW })).toBeNull();
    expect(
      verifySession(Buffer.from(JSON.stringify(PAYLOAD)).toString("base64url"), { key: KEY, now: NOW }),
    ).toBeNull();
  });

  it("★期限切れは通らない", () => {
    const t = signSession(PAYLOAD, { key: KEY, now: NOW });
    expect(verifySession(t, { key: KEY, now: NOW + 31 * 86_400_000 })).toBeNull();
  });

  it("期限内なら通る", () => {
    const t = signSession(PAYLOAD, { key: KEY, now: NOW });
    expect(verifySession(t, { key: KEY, now: NOW + 86_400_000 })).toEqual(PAYLOAD);
  });

  it("★鍵が空なら署名しない", () => {
    expect(() => signSession(PAYLOAD, { key: "", now: NOW })).toThrow();
  });

  it("★鍵が空なら検証も通さない", () => {
    const t = signSession(PAYLOAD, { key: KEY, now: NOW });
    expect(verifySession(t, { key: "", now: NOW })).toBeNull();
  });

  it("★セッションに名前や連絡先を入れない", () => {
    const t = signSession(PAYLOAD, { key: KEY, now: NOW });
    const decoded = Buffer.from(t.split(".")[0], "base64url").toString();
    expect(Object.keys(JSON.parse(decoded)).sort()).toEqual(["caseId", "exp", "partyId"]);
  });
});

describe("★Cookie の属性", () => {
  const o = cookieOptions({ secure: true });

  it("★JS から読めない", () => {
    expect(o.httpOnly).toBe(true);
  });

  it("★本番では平文で飛ばない", () => {
    expect(o.secure).toBe(true);
  });

  it("★他サイトからの遷移で送られない", () => {
    expect(["lax", "strict"]).toContain(o.sameSite);
  });

  it("パスがサイト全体", () => {
    expect(o.path).toBe("/");
  });

  it("名前が推測を招かない", () => {
    expect(SESSION_COOKIE).not.toContain("token");
    expect(SESSION_COOKIE).not.toContain("auth");
  });
});
