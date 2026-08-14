import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * ★オンボーディングは3枚
 *
 *   1. アプリの説明 ＋ ★**メールアドレスの登録**（ここでケースが作られる）
 *   2. （登録済みなら）次に使うときのための確認
 *   3. お相手を招待しますか
 *
 * ★2026-08-14：**サインアップ必須にした。**
 *   匿名で始めると、Cookie を失った時点で二度と辿れない。
 *   実測で70ケース中30ケースがその状態だった（→ signupRequired.test.ts）。
 *
 * ★状況の5択をやめた。**全員が入力から始まるので、分岐する意味が無い。**
 *   同居・お子さん・年収は、取り決めの画面（A-3）で必要になった時点で伺う。
 *
 * ★招待を戻すにあたっての歯止め（第3弾の懸念に対して）
 *   1. 関係の状態を一切聞かない
 *   2. 2つの選択肢を、枠線・面積・文字サイズまで揃える
 *   3. 「お渡しになるまで、お相手には何も届きません」を選択肢より先に置く
 */

/** ★コメントは数えない。「なぜそうしたか」の説明が引っかかるため */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const top = readFileSync("src/app/page.tsx", "utf8");
const startButton = stripComments(readFileSync("src/components/onboarding/StartButton.tsx", "utf8"));
const gate = stripComments(readFileSync("src/components/onboarding/InviteGate.tsx", "utf8"));
const account = readFileSync("src/app/account/page.tsx", "utf8");

describe("★1枚目：アプリの説明", () => {
  it("★取り決めの作られ方を、ここで先に言う", () => {
    // ★言っておかないと、取り決めの画面が唐突になる
    expect(top).toContain("取り決めは、ご自身で書いて残します");
    expect(top).toContain("記録が同じになったとき、合意になります");
  });

  it("★状況（5択）へは行かない", () => {
    expect(startButton).not.toContain("/start");
  });

  it("★はじめる＝メールアドレスの登録になっている", () => {
    // ★ケースは本人確認が済んでから作る
    expect(startButton).toContain("EmailLinkForm");
    expect(startButton).toContain("signup");
  });

  it("★関係の状態を、うかがわないと明記する", () => {
    expect(top).toContain("ご関係の状態も、うかがいません");
  });
});

describe("★オンボーディングは3枚のまま", () => {
  const form = stripComments(readFileSync("src/components/auth/EmailLinkForm.tsx", "utf8"));

  it("★はじめた人は、3枚目（招待するか）へ進む", () => {
    // ★サインアップを1枚目に統合したとき、ここの接続が切れていた（退行）。
    //   ホームのカードでは、第4弾で決めた3つの歯止めを持てない
    //   （関係の状態を聞かない／2択を同じ重さで／約束を選択肢より先に置く）
    expect(form).toContain("/onboarding/invite");
  });

  it("★受諾した人は、招待する相手がいない。そのままアプリへ", () => {
    expect(form).toMatch(/mode === "accept" \? "\/app"/);
  });
});

describe("★2枚目：登録の確認", () => {
  it("★飛ばす道は無い（サインアップ必須にしたため）", () => {
    expect(account).not.toContain("あとで登録する");
  });

  it("★次は招待（3枚目）", () => {
    expect(account).toContain("/onboarding/invite");
  });
});

describe("★3枚目：招待を戻すにあたっての歯止め", () => {
  it("★関係の状態を一切聞かない", () => {
    expect(gate).toContain("ご関係の状態は、うかがいません");
    // ★「話していますか」の類を置かない
    expect(gate).not.toContain("話して");
  });

  it("★「お渡しになるまで、何も届きません」が、選択肢より先にある", () => {
    const promise = gate.indexOf("お渡しになるまで、お相手には何も届きません");
    const choices = gate.indexOf("いまお渡しする");
    expect(promise).toBeGreaterThan(-1);
    expect(promise).toBeLessThan(choices);
  });

  it("★2つの選択肢が、同じ寸法を共有している", () => {
    // ★別々に書くと、いずれ片方だけ育つ
    const uses = gate.match(/style=\{\{?\s*\.\.\.CARD|style=\{CARD\}/g) ?? [];
    expect(uses.length).toBe(2);
  });

  it("★「あとにする」を、待機ではなく通常の使い方として書く", () => {
    expect(gate).toContain("ひとりで書きはじめて");
  });
});
