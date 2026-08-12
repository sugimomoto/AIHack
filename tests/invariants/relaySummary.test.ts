import { describe, expect, it } from "vitest";
import { summaryFromPayload } from "@/domain/relay/summary";
import { hasVerbatimRun } from "@/domain/relay/guard";
import { RELAY_PROMISE, RELAY_PROMISE_SHORT } from "@/domain/ui/emptyState";

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
   * ★金額・日付・時刻は、正しく伝えれば原文と一致して当たり前である。
   *   組み立てた文**全体**を検査すると、事実を伝えること自体ができなくなる。
   *   （実測：「10月8日の14時に小学校の体育館で開催されます」→ 何も渡らなかった）
   */
  it("★定型どおりの原文でも、金額と支払日は落とさない", () => {
    const raw = "養育費は月額40,000円、お支払いは毎月末日にしてほしいです";
    expect(summaryFromPayload({ monthlyAmount: 40000, payDay: "LAST_DAY" }, raw)).toContain(
      "40,000円",
    );
  });
});

describe("★お知らせ（日常の連絡）", () => {
  it("日付・時刻・場所を助詞でつなぐ", () => {
    expect(
      summaryFromPayload({ date: "10月8日", time: "14時", place: "小学校の体育館", subject: "父母会" }),
    ).toBe("10月8日14時に小学校の体育館で父母会とのことです。");
  });

  it("★「ご希望」と書かない（要求として誤解される）", () => {
    const s = summaryFromPayload({ date: "10月8日", subject: "運動会" })!;
    expect(s).not.toContain("ご希望");
    expect(s).toContain("とのことです");
  });

  // ★書かれていない年を足すと、事実を作ることになる
  it("★抽出が ISO で返しても、年を出さない", () => {
    expect(summaryFromPayload({ date: "2023-10-08", subject: "父母会" })).toBe(
      "10月8日に父母会とのことです。",
    );
  });

  it("★「未記載」を事実として渡さない", () => {
    expect(summaryFromPayload({ date: "今朝", time: "未記載", subject: "発熱" })).toBe(
      "今朝に発熱とのことです。",
    );
  });

  // ★自由記述からは原文の言い回しを越えさせる余地がある
  it("★できごと・場所が原文と逐語一致したら、その項目を落とす", () => {
    const raw = "あの人のせいで子どもがひどく体調を崩したんですけど";
    const s = summaryFromPayload({ date: "今朝", subject: "あの人のせいで子どもがひどく体調を崩した" }, raw);
    expect(s).not.toContain("あの人のせいで");
  });

  // ★読み取れない数字の塊を日付として出すと、
  //   PII 除去が年収と誤認して〔伏せています〕に化ける（実測）
  it("★読み取れない数字の塊を日付として出さない", () => {
    expect(summaryFromPayload({ date: "20261205", subject: "発表会" })).toBe(
      "発表会とのことです。",
    );
  });

  it("いろいろな日付の書き方を月日に直す", () => {
    for (const d of ["2026-12-05", "2026/12/05", "2026年12月5日", "12/5"]) {
      expect(summaryFromPayload({ date: d, subject: "発表会" })).toBe(
        "12月5日に発表会とのことです。",
      );
    }
  });

  it("日付だけでも文になる", () => {
    expect(summaryFromPayload({ date: "10月8日" })).toBe("10月8日に予定があるとのことです。");
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

/**
 * ★「お相手には届きません」だけでは、説明が足りない。
 *   これだけを読むと「何も伝わらない」と受け取れるが、
 *   実際には必要なことが整えた形で渡っている。
 *   **約束と実際の動きが食い違うと、届いたときに驚かせる。**
 */
describe("★約束の言い方", () => {
  it("そのままは渡らない、と言い切る", () => {
    expect(RELAY_PROMISE).toContain("そのまま");
  });

  // ★これが無いと「何も伝わらない」と読める
  it("★整えて伝えることまで書く", () => {
    expect(RELAY_PROMISE).toContain("整えて");
    expect(RELAY_PROMISE).toContain("お伝えします");
  });

  it("★短い形も同じことを言う（発言の直下）", () => {
    expect(RELAY_PROMISE_SHORT).toContain("そのまま");
    expect(RELAY_PROMISE_SHORT).toContain("整えて");
  });

  // ★直後に「お相手には、こう伝わりました」が並ぶ。言い切ると矛盾する
  it("★「何も届きません」と言い切らない", () => {
    for (const t of [RELAY_PROMISE, RELAY_PROMISE_SHORT]) {
      expect(t).not.toMatch(/^お相手には届きません/);
      expect(t).not.toContain("何も届きません");
    }
  });
});
