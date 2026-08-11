import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GENERAL_INFO_NOTICE, assertGeneralInfo, isIndividualAdvice } from "@/domain/knowledge/article";

/**
 * ★ナレッジ｜非弁対策の構造
 *
 * 「一般情報」と「個別助言」を**画面レベルで分離する。**
 *
 *   弁護士法72条。離婚協議には事件性が認められる。
 *   「あなたのケースでは月5万円にすべきです」は個別助言であり、
 *   **記事という形であっても書いてはならない。**
 *
 * ★記事は人が書く。LLMに書かせない。
 *   毎回変わる法制度の説明に意味はなく、誤りの責任も所在しなくなる。
 *
 * ★このテストは実装より先に書かれた
 */

const ARTICLES = JSON.parse(readFileSync("firestore/seeds/knowledgeArticles.json", "utf8")) as {
  id: string;
  title: string;
  body: string;
  supervisedBy: string | null;
  topics: string[];
}[];

describe("★記事が個別助言になっていない", () => {
  it.each(ARTICLES.map((a) => [a.id, a] as const))("%s", (_id, a) => {
    expect(() => assertGeneralInfo(a.body)).not.toThrow();
  });

  it("★個別助言らしい表現を検出できる", () => {
    expect(isIndividualAdvice("あなたのケースでは月5万円にすべきです")).toBe(true);
    expect(isIndividualAdvice("あなたの場合は調停を申し立てるべきです")).toBe(true);
    expect(isIndividualAdvice("ご自身の状況に応じて、専門家にご相談ください")).toBe(false);
  });

  it("一般的な説明は通る", () => {
    expect(isIndividualAdvice("養育費は、算定表を目安に取り決められることが多いとされています。")).toBe(false);
  });
});

describe("★一般情報であることの表示", () => {
  it("すべての記事に注記が付く", () => {
    expect(GENERAL_INFO_NOTICE).toContain("一般的な");
    expect(GENERAL_INFO_NOTICE).toContain("個別");
  });

  it("★具体的な助言ではないことが明記されている", () => {
    expect(GENERAL_INFO_NOTICE).toMatch(/ではありません|お答えするものではありません/);
  });
});

describe("★監修", () => {
  it("★監修されていない記事は、その旨が分かる（null を許す）", () => {
    for (const a of ARTICLES) {
      expect(a).toHaveProperty("supervisedBy");
    }
  });

  it("記事が論点に紐づく", () => {
    for (const a of ARTICLES) expect(a.topics.length).toBeGreaterThan(0);
  });

  it("記事が空でない", () => {
    expect(ARTICLES.length).toBeGreaterThanOrEqual(3);
    for (const a of ARTICLES) expect(a.body.length).toBeGreaterThan(80);
  });
});
