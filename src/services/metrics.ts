import { costJpyOf } from "@/domain/llm/pricing";
import { TIER_CONFIG } from "@/domain/llm/tier";
import { ratesOf } from "@/infra-adapters/llm/pricingCatalog";
import { listCallLogs } from "@/infra-adapters/firestore/repositories/llmCallLogRepository";

/**
 * CT-1〜CT-4
 *
 * ★CT-4 は、保存されたログのトークン数に LARGE の単価を掛け直して出す。
 *   **推測ではなく計測値である。**
 *
 * ★ログには原文が入っていない（G-F）。集計に必要なのはトークン数だけである。
 */
export type Metrics = {
  calls: number;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  totalJpy: number;
  /** CT-1：メッセージ単価 */
  perMessageJpy: number | null;
  /** CT-4：全部 LARGE だった場合との比較 */
  asLargeJpy: number | null;
  reductionRate: number | null;
  byTier: Record<string, { calls: number; jpy: number }>;
  byPurpose: Record<string, { calls: number; jpy: number }>;
};

export async function computeMetrics(caseId?: string): Promise<Metrics> {
  const logs = await listCallLogs(caseId);
  const large = await ratesOf(TIER_CONFIG.LARGE.model);

  const byTier: Metrics["byTier"] = {};
  const byPurpose: Metrics["byPurpose"] = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let totalJpy = 0;
  let asLargeJpy = 0;

  for (const l of logs) {
    inputTokens += l.inputTokens;
    outputTokens += l.outputTokens;
    totalJpy += l.costJpy;
    if (large) asLargeJpy += costJpyOf(large, l.inputTokens, l.outputTokens);

    (byTier[l.tier] ??= { calls: 0, jpy: 0 }).calls++;
    byTier[l.tier].jpy += l.costJpy;
    const p = String(l.purpose);
    (byPurpose[p] ??= { calls: 0, jpy: 0 }).calls++;
    byPurpose[p].jpy += l.costJpy;
  }

  // ★1メッセージあたりの呼び出しは、意図分類＋受け止め＋（取次ぎ時に抽出＋構造化）
  const messages = byPurpose.EMOTION_RECEPTION?.calls ?? 0;

  return {
    calls: logs.length,
    messages,
    inputTokens,
    outputTokens,
    totalJpy,
    perMessageJpy: messages > 0 ? totalJpy / messages : null,
    asLargeJpy: large ? asLargeJpy : null,
    reductionRate: large && asLargeJpy > 0 ? 1 - totalJpy / asLargeJpy : null,
    byTier,
    byPurpose,
  };
}
