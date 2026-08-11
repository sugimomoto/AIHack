/**
 * 単価
 *
 * ★ハードコードしない。
 *   OrcaRouter の /api/pricing から取得する。
 *   プロバイダの値下げが自動的に反映され、CT-1〜CT-4 が常に正確になる。
 *
 * レシオ方式：
 *   入力単価（$/1M） = model_ratio × 2
 *   出力単価（$/1M） = 入力単価 × completion_ratio
 *   キャッシュ入力   = 入力単価 × cache_ratio
 *
 * @see docs/architecture.md §4.0
 */

export type PricingEntry = {
  model_ratio: number;
  completion_ratio: number;
  cache_ratio?: number;
};

export type Rates = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  cachedInputUsdPerMillion?: number;
};

export function ratesFromPricing(e: PricingEntry): Rates {
  const input = e.model_ratio * 2;
  return {
    inputUsdPerMillion: input,
    outputUsdPerMillion: input * e.completion_ratio,
    ...(e.cache_ratio !== undefined ? { cachedInputUsdPerMillion: input * e.cache_ratio } : {}),
  };
}

/** 既定の為替レート。★C-03 として未確定。実測時に見直す */
export const DEFAULT_USD_JPY = 150;

/**
 * 円換算した原価。
 *
 * ★CT-4 では、同じトークン数に LARGE の単価を掛け直す。
 *   そのため rates を引数に取る形にしてある。
 *   ここに階層を埋め込むと、掛け直しができなくなる。
 */
export function costJpyOf(
  rates: Rates,
  inputTokens: number,
  outputTokens: number,
  usdJpy: number = DEFAULT_USD_JPY,
): number {
  const usd =
    (inputTokens / 1_000_000) * rates.inputUsdPerMillion +
    (outputTokens / 1_000_000) * rates.outputUsdPerMillion;
  return usd * usdJpy;
}
