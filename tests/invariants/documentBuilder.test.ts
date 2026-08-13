import { describe, expect, it } from "vitest";
import {
  NOTARY_NOTICE,
  UnresolvedConditionError,
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
      items: [AGREED_CS, { topic: "VISITATION", status: "PENDING", payload: { frequency: "MONTHLY_1" } }],
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
        { topic: "VISITATION", status: "AGREED", payload: { frequency: "MONTHLY_1" } },
        AGREED_CS,
      ],
    });
    expect(d.clauses.map((c) => c.title)).toEqual(["養育費", "面会交流"]);
  });

  it("条項番号が振られる", () => {
    const d = buildDocument({
      templates: TEMPLATES,
      items: [AGREED_CS, { topic: "VISITATION", status: "AGREED", payload: { frequency: "MONTHLY_1" } }],
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

  it("★表記の定義があるコード値は変換される", () => {
    expect(formatValue("frequency", "MONTHLY_1")).toBe("月1回");
  });

  it("★表記の定義が無いコード値は通さない", () => {
    expect(formatValue("anything", "SOME_CODE")).toBeNull();
    expect(formatValue("frequency", "MONTHLY_9")).toBeNull();
  });

  it("自由入力の文字列はそのまま使う", () => {
    expect(formatValue("handoverPlace", "○○駅の改札前")).toBe("○○駅の改札前");
  });

  it("時間帯は定義された表記になる", () => {
    expect(formatValue("timeRange", "10:00-17:00")).toBe("10時00分から17時00分まで");
  });
});

/**
 * ★複数のお子さんに対応する
 *
 *   ひな形が「丙」1人固定だった。子が2人以上いると、
 *   **誰についての取り決めなのかが文から読み取れない。**
 *
 * ★氏名を条項に出さない。
 *   公正証書には氏名が入るが、原案は当事者が公証役場に持ち込むもので
 *   あり、**アプリ側で氏名を保持しない設計と整合させる。**
 *   「長男」「長女」といった続柄も、こちらでは判定できない。
 */
describe("★複数のお子さん", () => {
  const T = [
    {
      id: "ct_cs",
      topic: "CHILD_SUPPORT",
      order: 1,
      title: "養育費",
      body: "甲は乙に対し、{{childrenRef}}の養育費として、{{monthlyAmount}}円を{{payDay}}限り支払う。",
    },
  ];
  const item = (n: number) => ({
    topic: "CHILD_SUPPORT",
    status: "AGREED" as const,
    payload: { monthlyAmount: 30000, payDay: "DAY_25" },
    childCount: n,
  });

  it("1人なら従来どおり", () => {
    const d = buildDocument({ templates: T, items: [item(1)] });
    expect(d.clauses[0].body).toContain("丙の養育費");
  });

  it("★2人なら、2人ぶんの表記になる", () => {
    const d = buildDocument({ templates: T, items: [item(2)] });
    expect(d.clauses[0].body).toContain("丙及び丁");
  });

  it("★3人にも対応する", () => {
    const d = buildDocument({ templates: T, items: [item(3)] });
    expect(d.clauses[0].body).toContain("丙、丁及び戊");
  });

  it("★人数が分からなければ、文書を返さない（誰の取り決めか書けない）", () => {
    expect(() =>
      buildDocument({ templates: T, items: [{ ...item(1), childCount: 0 }] }),
    ).toThrow(UnresolvedPlaceholderError);
  });

  it("★金額は総額である（子ごとに割らない）", () => {
    // 算定表は「子○人」で総額を出す。割ると根拠を失う
    const d = buildDocument({ templates: T, items: [item(3)] });
    expect(d.clauses[0].body).toContain("30,000円");
  });
});

// ---------------------------------------------------------------------------
// ★条項を出す条件（財産分与・年金分割）
// ---------------------------------------------------------------------------

describe("★condition｜どの条項を出すか", () => {
  const LUMP = {
    id: "ct_pd_lump",
    topic: "PROPERTY_DIVISION",
    order: 1,
    title: "財産分与",
    condition: { field: "method", equals: "LUMP_SUM" },
    body: "{{payerMark}}は{{payeeMark}}に対し、財産分与として金{{amountYen}}円を、{{dueDate}}限り、{{payeeMark}}の指定する方法により支払う。",
  };
  const SETTLED = {
    id: "ct_pd_settled",
    topic: "PROPERTY_DIVISION",
    order: 2,
    title: "財産分与",
    condition: { field: "method", equals: "ALREADY_SETTLED" },
    body: "甲及び乙は、財産分与について、本日までに協議のうえ清算が済んでいることを相互に確認する。",
  };

  const build = (payload: Record<string, unknown>) =>
    buildDocument({
      templates: [LUMP, SETTLED],
      items: [{ topic: "PROPERTY_DIVISION", status: "AGREED", payload }],
    });

  it("★選んだ決め方の条項だけが出る", () => {
    const d = build({
      method: "LUMP_SUM",
      payerSide: "NON_CUSTODIAL",
      amountYen: 1000000,
      dueDate: "2026-12-31",
    });
    expect(d.clauses).toHaveLength(1);
    expect(d.clauses[0].templateId).toBe("ct_pd_lump");
  });

  it("★別の決め方なら、別の条項が出る", () => {
    const d = build({ method: "ALREADY_SETTLED" });
    expect(d.clauses).toHaveLength(1);
    expect(d.clauses[0].templateId).toBe("ct_pd_settled");
  });

  it("★条件に使う値が無ければ、黙って落とさず例外にする", () => {
    // ★合意した内容が文書から消えるほうが、例外で止まるより危険である
    expect(() => build({ amountYen: 1000000 })).toThrow(UnresolvedConditionError);
  });

  it("★支払う向きが条項に出る（取り違えると法的文書が逆になる）", () => {
    const 甲が払う = build({
      method: "LUMP_SUM",
      payerSide: "NON_CUSTODIAL",
      amountYen: 1000000,
      dueDate: "2026-12-31",
    });
    expect(甲が払う.clauses[0].body).toMatch(/^甲は乙に対し/);

    const 乙が払う = build({
      method: "LUMP_SUM",
      payerSide: "CUSTODIAL",
      amountYen: 1000000,
      dueDate: "2026-12-31",
    });
    expect(乙が払う.clauses[0].body).toMatch(/^乙は甲に対し/);
  });

  it("★向きが決まっていなければ、条項を作らない", () => {
    expect(() =>
      build({ method: "LUMP_SUM", amountYen: 1000000, dueDate: "2026-12-31" }),
    ).toThrow(UnresolvedPlaceholderError);
  });

  it("★日付を ISO 形式のまま条項に出さない", () => {
    const d = build({
      method: "LUMP_SUM",
      payerSide: "NON_CUSTODIAL",
      amountYen: 1000000,
      dueDate: "2026-12-31",
    });
    expect(d.clauses[0].body).toContain("2026年12月31日");
    expect(d.clauses[0].body).not.toContain("2026-12-31");
  });

  it("★年金分割を「しない」と決めたときは、条項が出ない", () => {
    const d = buildDocument({
      templates: [
        {
          id: "ct_ps_half",
          topic: "PENSION_SPLIT",
          order: 1,
          title: "年金分割",
          condition: { field: "pensionMethod", equals: "HALF" },
          body: "甲及び乙は、厚生年金保険法に基づく年金分割について、請求すべき按分割合を{{pensionMethod}}と定める。",
        },
      ],
      items: [{ topic: "PENSION_SPLIT", status: "AGREED", payload: { pensionMethod: "NONE" } }],
    });
    expect(d.clauses).toHaveLength(0);
  });

  it("★按分割合は表記に変換される（コード値をそのまま出さない）", () => {
    const d = buildDocument({
      templates: [
        {
          id: "ct_ps_half",
          topic: "PENSION_SPLIT",
          order: 1,
          title: "年金分割",
          condition: { field: "pensionMethod", equals: "HALF" },
          body: "請求すべき按分割合を{{pensionMethod}}と定める。",
        },
      ],
      items: [{ topic: "PENSION_SPLIT", status: "AGREED", payload: { pensionMethod: "HALF" } }],
    });
    expect(d.clauses[0].body).toContain("2分の1");
    expect(d.clauses[0].body).not.toContain("HALF");
  });
});
