import { describe, expect, it } from "vitest";
import { buildMediationInput, verifyMediationText } from "@/domain/support/mediation";
import { redactPii } from "@/domain/security/guard";

/**
 * ★調停案は、双方に見える唯一のLLM長文である
 *
 * レビューで検出：対話は sanitize＋redact、取次ぎは verifyRelay を通るのに、
 * **調停案だけが素通しだった。**
 * 「間をとって35,000円では」のような、表にも提案にも無い金額が
 * 両当事者に届き、しかもキャッシュで恒久固定されうる。
 *
 * ★このテストは実装より先に書かれた
 */

const ALLOWED = { amounts: [30000, 40000], rangeText: "月4万〜6万円の範囲" };

describe("★調停案の事後検査", () => {
  it("許された数値だけなら通る", () => {
    const t = "おふたりのご提案は30,000円と40,000円です。算定表では月4万〜6万円の範囲とされています。";
    expect(verifyMediationText(t, ALLOWED).ok).toBe(true);
  });

  it("★表にも提案にも無い金額があれば落ちる", () => {
    const r = verifyMediationText("間をとって35,000円ではいかがでしょうか。", ALLOWED);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("UNKNOWN_AMOUNT");
  });

  it("★禁止語があれば落ちる", () => {
    const r = verifyMediationText("お支払いの遅延を避けるためにも30,000円で。", ALLOWED);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("FORBIDDEN_WORD");
  });

  it("★助言になっていれば落ちる", () => {
    const r = verifyMediationText("30,000円にすべきです。", ALLOWED);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("ADVICE");
  });

  it("年号や表番号は数値として扱わない", () => {
    const t = "算定表（表1（子1人・0〜14歳））では月4万〜6万円の範囲とされています。";
    expect(verifyMediationText(t, { amounts: [], rangeText: t }).ok).toBe(true);
  });
});

describe("★調停案は閲覧者に依存しない", () => {
  it("★「あなた」「お相手」を入力に含めない（キャッシュで入れ替わるため）", () => {
    const s = buildMediationInput({
      topicLabel: "養育費",
      range: { minYen: 40000, maxYen: 60000, tableRef: "表1" },
      proposals: [{ payload: { monthlyAmount: 30000 } }, { payload: { monthlyAmount: 40000 } }],
    });
    expect(s).not.toContain("あなた");
    expect(s).not.toContain("お相手");
  });

  it("双方の提案は含まれる", () => {
    const s = buildMediationInput({
      topicLabel: "養育費",
      range: { minYen: 40000, maxYen: 60000, tableRef: "表1" },
      proposals: [{ payload: { monthlyAmount: 30000 } }, { payload: { monthlyAmount: 40000 } }],
    });
    expect(s).toContain("30000");
    expect(s).toContain("40000");
  });
});

/**
 * ★越境するテキストに PII フィルタが掛かること
 *
 * レビューで検出：redactPii は本人に返す受け止め文にしか掛かっておらず、
 * **相手に届く取次ぎには掛かっていなかった。**
 *   原文「電話は090-1234-5678です」→ 抽出「連絡先は09012345678とのことです」
 *   10文字連続一致が無いため verifyRelay を通過し、電話番号が相手に届く。
 */
describe("★PIIフィルタ", () => {
  it("★区切りの無い電話番号を伏せる", () => {
    expect(redactPii("連絡先は09012345678とのことです")).toContain("電話番号");
  });

  it("★全角の電話番号を伏せる", () => {
    expect(redactPii("０９０－１２３４－５６７８")).toContain("電話番号");
  });

  it("★カンマ区切りの精密な年収を伏せる", () => {
    expect(redactPii("年収は4,380,000円です")).toContain("年収");
  });

  it("★丁目・番地の住所を伏せる", () => {
    expect(redactPii("東京都渋谷区神南1丁目2番3号")).toContain("住所");
  });

  it("★合意の文言を壊さない（時刻）", () => {
    const t = "東京都内の公園で10-12時に受け渡しをします";
    expect(redactPii(t)).toBe(t);
  });

  it("★合意の文言を壊さない（表番号）", () => {
    const t = "大阪府の算定表2-1の行では月4万円です";
    expect(redactPii(t)).toBe(t);
  });

  it("★合意の文言を壊さない（金額・回数）", () => {
    for (const t of ["毎月30,000円を毎月25日限り支払う。", "この年収帯は月2万〜4万円の範囲", "面会は毎月1-2回"]) {
      expect(redactPii(t)).toBe(t);
    }
  });

  it("ラベルが内容と一致する", () => {
    expect(redactPii("09012345678")).not.toContain("金額");
  });
});
