import { describe, expect, it } from "vitest";
import {
  NOTARY_NOTICE,
  UnresolvedPlaceholderError,
  buildDocument,
  formatValue,
} from "@/domain/document/builder";

/**
 * ★公正証書原案の生成
 *
 * **LLMを一切使わない。**ひな形のプレースホルダ置換だけで作る。
 *
 * ★置換に失敗した文書を世に出さない。
 *   置換漏れは `{{monthlyAmount}}` のまま残る。
 *   **空欄のある法的文書は、空欄のない誤りより危険である。**
 *   当事者がそれを公証役場に持ち込む。
 *
 * ★このテストは実装より先に書かれた
 */

const TEMPLATES = [
  {
    id: "ct_child_support_v1",
    topic: "CHILD_SUPPORT",
    order: 1,
    title: "養育費",
    body: "甲は乙に対し、丙の養育費として、{{monthlyAmount}}円を{{payDay}}限り支払う。\n前項の支払は、丙が{{until}}に達する月まで継続する。",
  },
  {
    id: "ct_visitation_v1",
    topic: "VISITATION",
    order: 2,
    title: "面会交流",
    body: "面会交流は{{frequency}}とする。",
  },
];

const AGREED_CS = {
  topic: "CHILD_SUPPORT",
  status: "AGREED" as const,
  payload: { monthlyAmount: 30000, payDay: "DAY_25", until: "AGE_20" },
};

describe("★未置換を残さない", () => {
  it("すべて置換できれば文書になる", () => {
    const d = buildDocument({ templates: TEMPLATES, items: [AGREED_CS] });
    expect(d.clauses[0].body).toContain("30,000円");
    expect(d.clauses[0].body).not.toContain("{{");
  });

  it("★値が欠けていたら例外になる（空欄のまま返さない）", () => {
    expect(() =>
      buildDocument({
        templates: TEMPLATES,
        items: [{ ...AGREED_CS, payload: { monthlyAmount: 30000 } }],
      }),
    ).toThrow(UnresolvedPlaceholderError);
  });

  it("★どの項目が欠けたかが分かる", () => {
    try {
      buildDocument({ templates: TEMPLATES, items: [{ ...AGREED_CS, payload: { monthlyAmount: 1 } }] });
      throw new Error("例外が投げられませんでした");
    } catch (e) {
      expect((e as UnresolvedPlaceholderError).missing).toEqual(["payDay", "until"]);
    }
  });

  it("★null や空文字も「欠けている」として扱う", () => {
    expect(() =>
      buildDocument({
        templates: TEMPLATES,
        items: [{ ...AGREED_CS, payload: { monthlyAmount: 30000, payDay: "", until: null } }],
      }),
    ).toThrow(UnresolvedPlaceholderError);
  });

  it("★その条項だけ落とす、という逃げ道が無い", () => {
    // 引数に「落とす」オプションが存在しないこと
    expect(buildDocument.length).toBe(1);
  });
});

describe("★合意した論点だけが入る", () => {
  it("AGREED 以外は文書に入らない", () => {
    const d = buildDocument({
      templates: TEMPLATES,
      items: [AGREED_CS, { topic: "VISITATION", status: "PENDING", payload: { frequency: "月1回" } }],
    });
    expect(d.clauses).toHaveLength(1);
    expect(d.clauses[0].title).toBe("養育費");
  });

  it("★合意が無ければ条項も無い", () => {
    expect(buildDocument({ templates: TEMPLATES, items: [] }).clauses).toHaveLength(0);
  });

  it("ひな形の順に並ぶ", () => {
    const d = buildDocument({
      templates: TEMPLATES,
      items: [
        { topic: "VISITATION", status: "AGREED", payload: { frequency: "月1回" } },
        AGREED_CS,
      ],
    });
    expect(d.clauses.map((c) => c.title)).toEqual(["養育費", "面会交流"]);
  });

  it("条項番号が振られる", () => {
    const d = buildDocument({
      templates: TEMPLATES,
      items: [AGREED_CS, { topic: "VISITATION", status: "AGREED", payload: { frequency: "月1回" } }],
    });
    expect(d.clauses.map((c) => c.number)).toEqual([1, 2]);
  });
});

describe("★注意書きは外せない", () => {
  it("文書に必ず注意書きが含まれる", () => {
    const d = buildDocument({ templates: TEMPLATES, items: [AGREED_CS] });
    expect(d.notice).toBe(NOTARY_NOTICE);
  });

  it("★公証人が作成することが書かれている", () => {
    expect(NOTARY_NOTICE).toContain("公証人");
    expect(NOTARY_NOTICE).toContain("原案");
  });

  it("★合意が無くても注意書きは付く", () => {
    expect(buildDocument({ templates: TEMPLATES, items: [] }).notice).toBe(NOTARY_NOTICE);
  });
});

describe("値の書式", () => {
  it.each([
    ["monthlyAmount", 30000, "30,000"],
    ["payDay", "DAY_25", "毎月25日"],
    ["payDay", "LAST_DAY", "毎月末日"],
    ["until", "AGE_20", "20歳"],
    ["until", "AGE_22_MARCH", "22歳に達した後の最初の3月"],
  ])("%s=%s → %s", (key, value, expected) => {
    expect(formatValue(key, value)).toBe(expected);
  });

  it("★未知のコード値はそのまま返さない（未置換として扱えるように null）", () => {
    expect(formatValue("payDay", "UNKNOWN_CODE")).toBeNull();
  });

  /**
   * ★実機で欠陥を検出した。
   *
   *   面会交流は{{frequency}}とし、時間は{{timeRange}}、…
   *     → 「面会交流はMONTHLY_1とし、時間は[object Object]、…」
   *
   * コード値がそのまま出て、オブジェクトが [object Object] になった。
   * **空欄と同じくらい危険である。**これが公証役場に持ち込まれる。
   *
   * 原因は「定義の無いキーは文字列化する」としたこと。
   * 文字列化してよいのは、**当事者が自由入力した値だけ**である。
   */
  it("★オブジェクトを文字列化しない", () => {
    expect(formatValue("timeRange", { from: "10:00", to: "17:00" })).toBeNull();
  });

  it("★配列を文字列化しない", () => {
    expect(formatValue("whatever", ["a", "b"])).toBeNull();
  });

  it("★コード値らしい文字列（英大文字とアンダースコア）は通さない", () => {
    expect(formatValue("frequency", "MONTHLY_1")).toBeNull();
    expect(formatValue("anything", "SOME_CODE")).toBeNull();
  });

  it("自由入力の文字列はそのまま使う", () => {
    expect(formatValue("handoverPlace", "○○駅の改札前")).toBe("○○駅の改札前");
  });

  it("時間帯は定義された表記になる", () => {
    expect(formatValue("timeRange", "10:00-17:00")).toBe("10時00分から17時00分まで");
  });
});
