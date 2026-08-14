import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  RULE_NOTE,
  SHARES,
  THRESHOLDS,
  describeRule,
  ruleStateOf,
} from "@/domain/rule/houseRule";

/**
 * ★おふたりで決めたこと（House Rule）
 *
 * 実データで最も頻出する対立要因は、臨時費用の分担だった。
 * そのご家庭は、都度の交渉ではなく**ルールを先に決めていた。**
 *
 *   > 1件1万円を超えるものは折半
 *
 * ★公正証書には入れない。条項にもしない。**当事者が自分で決めて、自分で直す。**
 */

const A = "party_a";
const B = "party_b";
const HALF = { thresholdYen: 10000, share: "HALF" };

describe("★片方だけでは決まらない", () => {
  it("誰も出していなければ NONE", () => {
    expect(ruleStateOf([], [A, B])).toBe("NONE");
  });

  it("★片方だけでは WAITING", () => {
    // ★「決まったこと」という題である以上、
    //   一方が書いただけのものが決まったこととして並ぶのは誤りである
    expect(ruleStateOf([{ byPartyId: A, value: HALF }], [A, B])).toBe("WAITING");
  });

  it("★双方が同じ内容を選んだら AGREED", () => {
    expect(
      ruleStateOf(
        [
          { byPartyId: A, value: HALF },
          { byPartyId: B, value: { ...HALF } },
        ],
        [A, B],
      ),
    ).toBe("AGREED");
  });

  it("★内容が違えば、揃わない", () => {
    expect(
      ruleStateOf(
        [
          { byPartyId: A, value: { thresholdYen: 10000, share: "HALF" } },
          { byPartyId: B, value: { thresholdYen: 30000, share: "HALF" } },
        ],
        [A, B],
      ),
    ).toBe("WAITING");
  });

  it("★1人しかいないケースで、揃ったことにしない", () => {
    expect(ruleStateOf([{ byPartyId: A, value: HALF }], [A])).toBe("WAITING");
  });

  it("★当事者ごとに最新の1件だけを見る（決め直せる）", () => {
    expect(
      ruleStateOf(
        [
          { byPartyId: A, value: { thresholdYen: 30000, share: "HALF" } },
          { byPartyId: B, value: HALF },
          { byPartyId: A, value: { ...HALF } }, // ★Aが決め直した
        ],
        [A, B],
      ),
    ).toBe("AGREED");
  });
});

describe("★選択肢だけ。自由記述にしない", () => {
  it("★API が、用意した選択肢以外を受け付けない", () => {
    // ★自由記述にすると、書いた言葉がそのまま相手に渡ることになる（C1）
    const route = readFileSync("src/app/api/cases/[caseId]/rules/route.ts", "utf8");
    expect(route).toContain("THRESHOLDS.some");
    expect(route).toContain("SHARES.some");
  });

  it("選択肢が有限で、すべて表記を持つ", () => {
    for (const [v, label] of THRESHOLDS) {
      expect(Number(v)).toBeGreaterThan(0);
      expect(label.length).toBeGreaterThan(0);
    }
    expect(SHARES.map(([v]) => v)).toEqual(["HALF", "CONSULT"]);
  });
});

describe("★表示は、当事者が選んだ値そのもの（LLM を通さない）", () => {
  it("選んだ額と分け方が、そのまま文になる", () => {
    expect(describeRule("SPECIAL_EXPENSE", HALF)).toBe("1件 10,000円 を超える費用は、半分ずつ");
  });

  it("★読めない値は、文にしない（推測しない）", () => {
    expect(describeRule("SPECIAL_EXPENSE", { thresholdYen: 0, share: "HALF" })).toBeNull();
    expect(describeRule("SPECIAL_EXPENSE", { thresholdYen: 10000, share: "???" })).toBeNull();
    expect(describeRule("SPECIAL_EXPENSE", {})).toBeNull();
  });
});

describe("★公正証書には入らない", () => {
  it("条項ひな形に、ルールの項目が無い", () => {
    // ★条項にすると、変えるのに相手の同意という重い手続きが要る。
    //   このルールは暮らしに合わせて何度でも直すもの。重くすると直されなくなる。
    const templates = readFileSync("firestore/seeds/clauseTemplates.json", "utf8");
    for (const k of ["thresholdYen", "share", "specialExpenses"]) {
      expect(templates.includes(k), `条項に入っている: ${k}`).toBe(false);
    }
  });

  it("★画面に「公正証書には入りません」と書く", () => {
    // ★取り決めのタブが隣にある。書かないと混ざる
    expect(RULE_NOTE).toContain("公正証書には入りません");
    expect(RULE_NOTE).toContain("決め直せます");
  });

  it("★お知らせに原文を含めない（C1）", () => {
    const route = readFileSync("src/app/api/cases/[caseId]/rules/route.ts", "utf8");
    const notice = route.slice(route.indexOf("content:"), route.indexOf("content:") + 200);
    expect(notice).not.toMatch(/\$\{/); // ★値の差し込みが無い
  });
});
