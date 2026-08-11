import { describe, expect, it } from "vitest";
import {
  CONTEXT_CATEGORIES,
  assertWhitelisted,
  hasVerbatimRun,
  isHearsay,
  verifyRelay,
} from "@/domain/relay/guard";

/**
 * ★取次ぎの実行時検査
 *
 * **テストで確かめるだけでは足りない。**
 * LLM の出力は毎回変わるため、本番の1回1回を検査しなければならない。
 *
 *   ❌ テストで INV-4a を確かめる
 *        → テストでは通っても、本番で逐語引用が越えうる
 *
 *   ✅ 生成のたびに検査し、通らなければ越えさせない
 *
 * **INV-4a / INV-4c は、テストであると同時に実行時の門である。**
 *
 * ★このテストは実装より先に書かれた
 */

const RAW = "月3万が限界。こっちだって仕事切られて必死なんだよ。そっちだって働いてるだろ、少しは考えろ";

describe("★INV-4a｜逐語引用の検出", () => {
  it("原文をそのまま含むと検出される", () => {
    expect(hasVerbatimRun(RAW, `お相手より：${RAW}`)).toBe(true);
  });

  it("★原文の一部（10文字）でも検出される", () => {
    expect(hasVerbatimRun(RAW, `背景として、${RAW.slice(10, 22)}という事情があります`)).toBe(true);
  });

  it("再構成された文は通る", () => {
    expect(hasVerbatimRun(RAW, "現在失職しており、求職中とのことです。")).toBe(false);
  });

  it("9文字の一致は通す（閾値の境界）", () => {
    const nine = RAW.slice(0, 9);
    expect(hasVerbatimRun(RAW, `背景：${nine}`)).toBe(false);
  });

  it("空文字は検出しない", () => {
    expect(hasVerbatimRun(RAW, "")).toBe(false);
    expect(hasVerbatimRun("", "なにか")).toBe(false);
  });
});

describe("★INV-4c｜抽出カテゴリのホワイトリスト", () => {
  it("ホワイトリストに主要なカテゴリがある", () => {
    for (const c of ["INCOME_EMPLOYMENT", "CHILD_STATUS", "SCHEDULE_CONSTRAINT", "HEALTH_LIVING"]) {
      expect(CONTEXT_CATEGORIES).toContain(c);
    }
  });

  it("ホワイトリスト内なら通る", () => {
    expect(() => assertWhitelisted(["INCOME_EMPLOYMENT", "CHILD_STATUS"])).not.toThrow();
  });

  it("★ホワイトリスト外は落ちる", () => {
    expect(() => assertWhitelisted(["INCOME_EMPLOYMENT", "BLAME"])).toThrow(/BLAME/);
  });

  it("★相手への評価・過去の蒸し返し・交際相手はホワイトリストにない", () => {
    for (const c of ["BLAME", "PAST_GRIEVANCE", "NEW_PARTNER", "PERSONALITY"]) {
      expect(CONTEXT_CATEGORIES).not.toContain(c);
    }
  });

  it("空でも通る（事情なしは正常）", () => {
    expect(() => assertWhitelisted([])).not.toThrow();
  });
});

describe("★R-2｜伝聞形式", () => {
  it("伝聞形式を認める", () => {
    expect(isHearsay("現在失職しており、求職中とのことです。")).toBe(true);
    expect(isHearsay("お子さんの体調がすぐれないそうです。")).toBe(true);
  });

  it("★断定は認めない（AIが事実認定すると、虚偽の申告をAIが保証したことになる）", () => {
    expect(isHearsay("現在失職しており、求職中です。")).toBe(false);
    expect(isHearsay("お相手は仕事を失いました。")).toBe(false);
  });

  it("事情がなければ検査しない", () => {
    expect(isHearsay("")).toBe(true);
  });
});

describe("★検査に落ちたときの退避", () => {
  const base = { raw: RAW, topicLabel: "養育費" };

  it("すべて通れば、そのまま越える", () => {
    const r = verifyRelay({
      ...base,
      context: "現在失職しており、求職中とのことです。",
      categories: ["INCOME_EMPLOYMENT"],
    });
    expect(r.ok).toBe(true);
    expect(r.context).toBe("現在失職しており、求職中とのことです。");
  });

  it("★逐語引用があれば、事情を落として最小形で越える", () => {
    const r = verifyRelay({ ...base, context: RAW.slice(0, 20), categories: ["INCOME_EMPLOYMENT"] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("VERBATIM");
    expect(r.context).toBe("");
  });

  it("★ホワイトリスト外なら、事情を落とす", () => {
    const r = verifyRelay({ ...base, context: "とても疲れているとのことです。", categories: ["BLAME"] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("CATEGORY");
    expect(r.context).toBe("");
  });

  it("★断定形なら、事情を落とす", () => {
    const r = verifyRelay({ ...base, context: "失職しました。", categories: ["INCOME_EMPLOYMENT"] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("ASSERTION");
    expect(r.context).toBe("");
  });

  it("★落ちても取次ぎ自体は成立する（提案は越える）", () => {
    const r = verifyRelay({ ...base, context: RAW.slice(0, 20), categories: [] });
    expect(r.context).toBe("");
    // 事情が伝わらないことより、原文が越えることのほうが重い
    expect(r.reason).toBeDefined();
  });
});

/**
 * ★取次ぎの文言が入力の意味を変えないこと
 *
 * 実機で意味が変わった：
 *   入力  「月3万が限界」（支払える額）
 *   取次ぎ「収入を3万円以内にしてほしい」（収入の話にすり替わった）
 *
 * **INV-4a は原文の混入を防ぐが、意味の取り違えは防げない。**
 * 機械的に検査できる範囲を明示しておく。
 */
describe("★機械的な検査の限界", () => {
  it("逐語引用は検出できる", () => {
    expect(hasVerbatimRun("月3万が限界。仕事切られて必死なんだよ", "月3万が限界。仕事切ら")).toBe(true);
  });

  it("★意味の取り違えは検出できない（検査の限界）", () => {
    // どちらも原文と10文字以上一致しない。機械的には区別がつかない
    const raw = "月3万が限界。仕事切られて必死なんだよ";
    expect(hasVerbatimRun(raw, "月額3万円までを希望されているそうです")).toBe(false);
    expect(hasVerbatimRun(raw, "収入を3万円以内にしてほしいとのことです")).toBe(false);
  });
});
