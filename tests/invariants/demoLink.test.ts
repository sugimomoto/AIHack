import { describe, expect, it } from "vitest";
import { signDemoLink, verifyDemoLink } from "@/domain/session/demoLink";

/**
 * ★継続的に使える確認用リンク
 *
 *   リンクを持っている人は、その当事者になれる。
 *   **つまり、範囲を絞らなければ「誰でも他人になれる」仕組みそのものである。**
 *
 *   絞り方：
 *     ・**確認用と印を付けたケースにしか効かない**
 *     ・印を付けられるのは、運営トークンを持つ人だけ
 *     ・期限がある
 *     ・改竄できない
 *
 * ★このテストは実装より先に書かれた
 */

const KEY = "demo-secret-0123456789abcdef";
const NOW = Date.parse("2026-08-12T00:00:00Z");

describe("★署名と検証", () => {
  const t = signDemoLink({ partyId: "p1", caseId: "c1" }, { key: KEY, now: NOW, days: 7 });

  it("自分で署名したものは通る", () => {
    expect(verifyDemoLink(t, { key: KEY, now: NOW })).toEqual({ partyId: "p1", caseId: "c1" });
  });

  it("★1文字でも改竄されたら通らない", () => {
    for (let i = 0; i < t.length; i += 5) {
      const c = t[i] === "a" ? "b" : "a";
      expect(verifyDemoLink(t.slice(0, i) + c + t.slice(i + 1), { key: KEY, now: NOW })).toBeNull();
    }
  });

  it("★別の鍵では通らない", () => {
    expect(verifyDemoLink(t, { key: "another-key-abcdef0123456789", now: NOW })).toBeNull();
  });

  it("★期限を過ぎたら通らない", () => {
    expect(verifyDemoLink(t, { key: KEY, now: NOW + 8 * 86_400_000 })).toBeNull();
  });

  it("★鍵が無ければ署名しない", () => {
    expect(() => signDemoLink({ partyId: "p1", caseId: "c1" }, { key: "", now: NOW, days: 7 })).toThrow();
  });

  it("★鍵が無ければ検証も通さない", () => {
    expect(verifyDemoLink(t, { key: "", now: NOW })).toBeNull();
  });

  it("★セッションの鍵と共用しない（用途を混ぜない）", () => {
    // 署名の対象に用途を含めることで、他の署名を流用できないようにする
    const decoded = Buffer.from(t.split(".")[0], "base64url").toString();
    expect(JSON.parse(decoded).use).toBe("DEMO_LINK");
  });
});
