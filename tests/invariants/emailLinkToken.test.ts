import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { signEmailLink, verifyEmailLink } from "@/domain/session/emailLinkToken";
import { signDemoLink } from "@/domain/session/demoLink";
import { signSession } from "@/domain/session/token";

/**
 * ★メールのリンクを、別のブラウザで開いても結びつけられるようにする
 *
 * 実機で起きた：メールのリンクを踏んでも入口に戻され、**登録が完了しなかった。**
 * 原因は、結びつけがセッションの Cookie だけに頼っていたこと。
 * リンクはメールアプリの内蔵ブラウザや別の端末で開かれる。
 */

const KEY = "test-secret-key";
const NOW = 1_700_000_000_000;
const P = { partyId: "party_a", caseId: "case_a" };

describe("★当事者を運べる", () => {
  it("署名して、読み戻せる", () => {
    const t = signEmailLink(P, { key: KEY, now: NOW });
    expect(verifyEmailLink(t, { key: KEY, now: NOW })).toEqual(P);
  });

  it("★改竄すると通らない", () => {
    const t = signEmailLink(P, { key: KEY, now: NOW });
    const [body] = t.split(".");
    expect(verifyEmailLink(`${body}.xxxx`, { key: KEY, now: NOW })).toBeNull();
  });

  it("★別の鍵では通らない", () => {
    const t = signEmailLink(P, { key: KEY, now: NOW });
    expect(verifyEmailLink(t, { key: "other", now: NOW })).toBeNull();
  });

  it("★1時間で切れる（メールを開くまでで足りる長さ）", () => {
    const t = signEmailLink(P, { key: KEY, now: NOW });
    expect(verifyEmailLink(t, { key: KEY, now: NOW + 59 * 60 * 1000 })).toEqual(P);
    expect(verifyEmailLink(t, { key: KEY, now: NOW + 61 * 60 * 1000 })).toBeNull();
  });

  it("鍵が無ければ署名できない", () => {
    expect(() => signEmailLink(P, { key: "", now: NOW })).toThrow();
  });
});

describe("★用途を混ぜない", () => {
  it("★確認用リンクのトークンを、結びつけに使えない", () => {
    // ★確認用リンクは「日」単位で有効で、持つ人がその当事者になれる。
    //   結びつけに流用できてはならない
    const demo = signDemoLink(P, { key: KEY, now: NOW, days: 14 });
    expect(verifyEmailLink(demo, { key: KEY, now: NOW })).toBeNull();
  });

  it("★セッションのトークンを、結びつけに使えない", () => {
    const sess = signSession(P, { key: KEY, now: NOW });
    expect(verifyEmailLink(sess, { key: KEY, now: NOW })).toBeNull();
  });
});

describe("★トークン単体では何もできない", () => {
  const route = readFileSync("src/app/api/auth/link/route.ts", "utf8");

  it("★本人確認（Firebase）を必ず通る", () => {
    // ★トークンは「誰の当事者か」しか運ばない。
    //   本人であることの確認は、必ず Firebase の oobCode 経由である
    expect(route).toContain("verifyIdToken");
    const i = route.indexOf("verifyIdToken");
    const j = route.indexOf("verifyEmailLink");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(-1);
    // ★本人確認が先。通らなければトークンを見る前に返す
    expect(i).toBeLessThan(j);
  });

  it("★すでに別の識別子が紐づいていれば、結びつけない", () => {
    expect(route).toContain("canLinkAuthUid");
  });

  it("★このトークンでセッションを発行しない", () => {
    expect(route).not.toContain("writeSession");
  });
});

describe("★セッションが無くても、リンクが行き止まりにならない", () => {
  const page = readFileSync("src/app/account/page.tsx", "utf8");

  it("★メールのリンクから来たときは、入口へ飛ばさない", () => {
    // ★以前は無条件に redirect("/") していた。**リンクを踏んでも入れなかった**
    expect(page).toContain("oobCode");
    expect(page).toContain("fromEmailLink");
  });

  it("★トークンがあれば結びつけ、無ければ「戻る」を試す", () => {
    expect(page).toMatch(/hasLinkToken \? "link" : "signin"/);
  });
});
