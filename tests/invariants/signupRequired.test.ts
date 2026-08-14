import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * ★サインアップ必須
 *
 * 以前は匿名でケースを始められた。セッションの Cookie だけが手がかりで、
 * **失えば二度と辿れなかった。**
 *
 *   実測（2026-08-14）：70ケース中 30ケースが、誰も登録していない状態。
 *
 * ★データが孤児になる形を、構造として無くす。
 */

const strip = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const casesRoute = readFileSync("src/app/api/cases/route.ts", "utf8");
const signup = readFileSync("src/app/api/auth/signup/route.ts", "utf8");
const accept = readFileSync("src/app/api/invite/[token]/accept/route.ts", "utf8");
const landing = strip(readFileSync("src/app/page.tsx", "utf8"));
const account = strip(readFileSync("src/app/account/page.tsx", "utf8"));

describe("★匿名でケースを作れない", () => {
  it("★旧経路は閉じた（画面から呼ばないだけでなく、API としても）", () => {
    // ★開いたままだと、匿名のケースが増え続ける
    expect(casesRoute).toContain("410");
    expect(casesRoute).toContain("_startAnonymously");
  });

  it("★ケースを作るのは、本人確認のあと", () => {
    const i = signup.indexOf("verifyIdToken");
    const j = signup.indexOf("startCase");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(-1);
    expect(i).toBeLessThan(j); // ★確認が先
  });

  it("★作った直後に結びつける。認証済みでないケースを残さない", () => {
    expect(signup).toContain("linkAuthUid");
  });

  it("★同じアドレスで押し直しても、ケースを増やさない", () => {
    expect(signup).toContain("resolvePartyForUid");
    expect(signup).toContain("resumed");
  });
});

describe("★招待された側も同じ扱い", () => {
  it("★受諾には本人確認が要る", () => {
    // ★片側だけ辿れない状態を残さない
    expect(accept).toContain("verifyIdToken");
    expect(accept).toContain("needsAuth");
  });

  it("★参加した時点で結びつける", () => {
    expect(accept).toContain("linkAuthUid");
  });

  it("★辞退には要らない（断るのに、アカウントを作らせない）", () => {
    // ACCEPT のときだけ確認する
    expect(accept).toMatch(/action === "ACCEPT"[\s\S]{0,200}verifyIdToken/);
  });
});

describe("★書いた約束を、実態に合わせる", () => {
  it("★「ご連絡先も要りません」を撤回した", () => {
    // ★できないことを書かないのと同じで、**しなくなったことも書かない**
    expect(landing).not.toContain("ご連絡先も要りません");
  });

  it("お名前が要らないことは、変わらない", () => {
    expect(landing).toContain("お名前は要りません");
  });

  it("★何のために使うかを、その場に書く", () => {
    expect(landing).toContain("次にお戻りいただくためだけ");
  });

  it("★「あとで登録する」を外した（飛ばせなくなったため）", () => {
    expect(account).not.toContain("あとで登録する");
  });
});

/**
 * ★どのアドレスで入っているかを、見せる
 *
 * ★サインアップ必須にしたことで、**打ち間違いが新しい空のケースを作る。**
 *   「データが消えた」ように見えるが、実際は**別人として入っている。**
 *   見せないと、本人にも気づけない。
 */
describe("★入っているアドレスが見える", () => {
  const sessionRoute = readFileSync("src/app/api/session/route.ts", "utf8");
  const form = strip(readFileSync("src/components/auth/EmailLinkForm.tsx", "utf8"));
  const settings = strip(readFileSync("src/components/settings/SettingsView.tsx", "utf8"));

  it("★セッションがアドレスを返す", () => {
    expect(sessionRoute).toContain("email");
  });

  it("★ただし保存はしない。その都度 Auth から引く", () => {
    // ★「漏れて困るものを、そもそも預からない」を崩さない
    expect(sessionRoute).toContain("getUser");
    expect(sessionRoute).not.toContain("saveOwnContactInfo");
  });

  it("★引けなくても、動作は変えない（表示できないだけ）", () => {
    expect(sessionRoute).toMatch(/catch[\s\S]{0,40}return null/);
  });

  it("★はじめた直後に、入ったアドレスを見せる", () => {
    expect(form).toContain("お入りになったアドレス");
  });

  it("★新規か復帰かを言い分ける", () => {
    // ★戻ったつもりで「はじめまして」が出れば、打ち間違いに気づける
    expect(form).toContain("おかえりなさい");
    expect(form).toContain("はじめまして");
  });

  it("★新規のときは、入り直す道を置く", () => {
    expect(form).toContain("別のアドレスで入り直す");
    expect(form).toContain("前のご利用は、そのまま残っています");
  });

  it("★設定でも、いつでも確かめられる", () => {
    expect(settings).toContain("お入りのアドレス");
  });

  it("★お相手には知られないことを、その場に書く", () => {
    expect(settings).toContain("お相手には知られません");
  });
});
