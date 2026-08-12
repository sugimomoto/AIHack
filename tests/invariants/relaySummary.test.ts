import { describe, expect, it } from "vitest";
import { summaryFromPayload } from "@/domain/relay/summary";
import { hasVerbatimRun } from "@/domain/relay/guard";

/**
 * ★短く素直に書いた発言ほど、要約が原文と逐語一致して落ちる。
 *   その結果、相手に届くのが「ご相談が来ています。」だけになっていた。
 *   **はっきり書いた人ほど、伝わる中身が減っていた。**
 */
describe("★構造化された提案から要約を組み立てる", () => {
  it("金額・支払日・終期を読める形にする", () => {
    expect(summaryFromPayload({ monthlyAmount: 40000, payDay: "LAST_DAY", until: "AGE_20" })).toBe(
      "月額40,000円、お支払いは毎月末日、20歳までをご希望とのことです。",
    );
  });

  // ★実際の書き方（感情まじり・口語）とは一致しない
  it("★自然な原文とは逐語一致しない", () => {
    const raw = "もう限界です。毎月きっちり払ってるのに、月4万が精一杯なんだよ";
    const s = summaryFromPayload({ monthlyAmount: 40000, payDay: "LAST_DAY" })!;
    expect(hasVerbatimRun(raw, s)).toBe(false);
  });

  /**
   * ★ただし「起こりえない」わけではない。
   *   本人が定型どおりの言い方で書けば、組み立て直した文とも一致しうる。
   *   **だから safeSummary は、組み立て直したものにも同じ検査をかける。**
   */
  it("★定型どおりに書かれた原文とは一致しうる（検査を外さない理由）", () => {
    const raw = "養育費は月額40,000円、お支払いは毎月末日にしてほしいです";
    const s = summaryFromPayload({ monthlyAmount: 40000, payDay: "LAST_DAY" })!;
    expect(hasVerbatimRun(raw, s)).toBe(true);
  });

  // ★G-3b と同じ規律
  it("★表記の定義が無いコード値は出さない", () => {
    expect(summaryFromPayload({ payDay: "DAY_99" })).toBeNull();
  });

  it("★入れ子をそのまま出さない", () => {
    expect(summaryFromPayload({ payDay: { code: "LAST_DAY" } })).toBeNull();
  });

  it("読める項目が無ければ null（最小形に落とす）", () => {
    expect(summaryFromPayload(null)).toBeNull();
    expect(summaryFromPayload({})).toBeNull();
    expect(summaryFromPayload({ payeeAccount: "" })).toBeNull();
  });

  it("面会交流も組み立てられる", () => {
    expect(summaryFromPayload({ frequency: "MONTHLY_1", dayOfWeek: "SAT" })).toBe(
      "月1回、土曜日をご希望とのことです。",
    );
  });
});
