import { describe, expect, it } from "vitest";
import { costJpyOf, ratesFromPricing } from "@/domain/llm/pricing";

/**
 * ★単価の算出
 *
 * CT-1〜CT-4 の根拠。ここが誤ると、提示する数字がすべて狂う。
 *
 * OrcaRouter の /api/pricing はレシオ方式で返す：
 *   入力単価（$/1M） = model_ratio × 2
 *   出力単価（$/1M） = 入力単価 × completion_ratio
 *
 * ★このテストは実装より先に書かれた
 */

describe("レシオ方式からの単価算出", () => {
  it("★既知の公開価格と一致する（gpt-5.1 → $1.25 / $10.00）", () => {
    const r = ratesFromPricing({ model_ratio: 0.625, completion_ratio: 8 });
    expect(r.inputUsdPerMillion).toBeCloseTo(1.25);
    expect(r.outputUsdPerMillion).toBeCloseTo(10.0);
  });

  it("★既知の公開価格と一致する（gemini-2.5-flash → $0.30 / $2.50）", () => {
    const r = ratesFromPricing({ model_ratio: 0.15, completion_ratio: 8.3333 });
    expect(r.inputUsdPerMillion).toBeCloseTo(0.3);
    expect(r.outputUsdPerMillion).toBeCloseTo(2.5, 2);
  });

  it("キャッシュ入力の単価も算出できる", () => {
    const r = ratesFromPricing({ model_ratio: 0.625, completion_ratio: 8, cache_ratio: 0.1 });
    expect(r.cachedInputUsdPerMillion).toBeCloseTo(0.125);
  });
});

describe("円換算", () => {
  const RATES = { inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.4 };

  it("★実測値と一致する（gpt-4.1-nano・入力99/出力29 → 約0.0032円）", () => {
    // 入力 99/1M × $0.10 + 出力 29/1M × $0.40 = $0.0000215 ≒ 0.0032円（150円/$）
    expect(costJpyOf(RATES, 99, 29, 150)).toBeCloseTo(0.0032, 4);
  });

  it("トークン0なら0円", () => {
    expect(costJpyOf(RATES, 0, 0, 150)).toBe(0);
  });

  it("★CT-4：同じトークン数に別の単価を掛け直せる", () => {
    const large = { inputUsdPerMillion: 1.25, outputUsdPerMillion: 10.0 };
    const small = costJpyOf(RATES, 1000, 500, 150);
    const asLarge = costJpyOf(large, 1000, 500, 150);
    // ルーティングによる削減率が実測ベースで出せる
    expect(1 - small / asLarge).toBeGreaterThan(0.8);
  });
});
