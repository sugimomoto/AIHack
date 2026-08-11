import { ratesFromPricing, type PricingEntry, type Rates } from "@/domain/llm/pricing";

/**
 * 単価カタログ
 *
 * ★ハードコードしない。OrcaRouter の /api/pricing から取得する。
 *   プロバイダの値下げが自動的に反映される。
 *
 * ★取得に失敗しても呼び出しを止めない。
 *   単価が分からないことは、対話を止める理由にならない。
 *   最後に成功した値を使い、それも無ければ原価を null として記録する。
 */

const PRICING_URL = "https://api.orcarouter.ai/api/pricing";
const TTL_MS = 24 * 60 * 60 * 1000;

let cache: { at: number; rates: Map<string, Rates> } | null = null;
let inflight: Promise<Map<string, Rates>> | null = null;

export async function ratesOf(model: string): Promise<Rates | null> {
  const table = await load();
  const rates = table.get(model) ?? table.get(model.replace(/^[^/]+\//, "")) ?? null;
  // ★単価が引けないと原価が黙って0円になり、CT-1 が狂う。必ず気づけるようにする。
  if (!rates) console.warn(`[pricing] 単価が見つかりません: ${model}（原価は0として記録されます）`);
  return rates;
}

async function load(): Promise<Map<string, Rates>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rates;
  if (inflight) return inflight;

  inflight = fetchCatalog()
    .then((rates) => {
      cache = { at: Date.now(), rates };
      return rates;
    })
    .catch((e) => {
      // ★失敗しても止めない。最後に成功した値を使う
      console.warn("[pricing] 単価の取得に失敗しました。前回の値を使います", e);
      return cache?.rates ?? new Map<string, Rates>();
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/**
 * ★応答は `{ data: [{ model_name, model_ratio, completion_ratio, cache_ratio }, …] }`。
 *   モデル名をキーにした辞書ではなく、配列である（2026-08-11 実測）。
 */
type PricingRow = PricingEntry & { model_name?: string };

async function fetchCatalog(): Promise<Map<string, Rates>> {
  const key = process.env.ORCAROUTER_API_KEY;
  const res = await fetch(PRICING_URL, {
    headers: key ? { authorization: `Bearer ${key}` } : {},
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`pricing ${res.status}`);

  const body = (await res.json()) as { data?: PricingRow[] };
  const rows = Array.isArray(body?.data) ? body.data : [];
  if (rows.length === 0) throw new Error("pricing: data が空です");

  const map = new Map<string, Rates>();
  for (const r of rows) {
    if (r.model_name && typeof r.model_ratio === "number" && typeof r.completion_ratio === "number") {
      map.set(r.model_name, ratesFromPricing(r));
    }
  }
  return map;
}

/** テスト・検証用 */
export function __resetPricingCache() {
  cache = null;
  inflight = null;
}
