/**
 * S3 の疎通確認
 *
 * ★実際に呼んで、実測値で確かめる。
 *   単価表と机上計算だけでは、推論モデルの罠（§4.1a）に気づけない。
 */
import { callLlm, callLlmStructured } from "../src/infra-adapters/llm/router";
import { deleteCallLogs, listCallLogs, saveCallLog } from "../src/infra-adapters/firestore/repositories/llmCallLogRepository";
import { costJpyOf } from "../src/domain/llm/pricing";
import { ratesOf } from "../src/infra-adapters/llm/pricingCatalog";
import { TIER_CONFIG } from "../src/domain/llm/tier";

const CASE_ID = "case_verify_s3";

async function main() {
  // ★前回の記録を巻き込むと CT-4 の数字が狂う
  const removed = await deleteCallLogs(CASE_ID);
  if (removed > 0) console.log(`前回の記録を${removed}件削除しました\n`);

  console.log("階層設定:");
  for (const [t, c] of Object.entries(TIER_CONFIG)) {
    console.log(`  ${t.padEnd(6)} ${c.model}${c.reasoningEffort ? ` (effort=${c.reasoningEffort})` : ""}`);
  }

  console.log("\n① SMALL・素の呼び出し");
  const a = await callLlm({
    tier: "SMALL",
    purpose: "INTENT_CLASSIFICATION",
    system: "あなたは分類器です。ラベルだけを1語で答えてください。",
    user: "来週の受け渡し、10時ではなく11時にできませんか。",
    caseId: CASE_ID,
    maxOutputTokens: 16,
  });
  console.log(`  応答: ${a.content.trim()}`);
  console.log(`  入力${a.log.inputTokens} / 出力${a.log.outputTokens} → ${a.log.costJpy.toFixed(4)}円`);
  await saveCallLog(a.log);

  console.log("\n② SMALL・構造化出力（json_schema）");
  const b = await callLlmStructured<{ intent: string; urgency: string }>({
    tier: "SMALL",
    purpose: "PROPOSAL_STRUCTURING",
    system: "入力を分類してください。",
    user: "来週の受け渡し、10時ではなく11時にできませんか。",
    caseId: CASE_ID,
    schema: {
      name: "intent",
      schema: {
        type: "object",
        properties: {
          intent: { type: "string", enum: ["SCHEDULE_CHANGE", "PAYMENT", "OTHER"] },
          urgency: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
        },
        required: ["intent", "urgency"],
        additionalProperties: false,
      },
    },
  });
  console.log(`  応答: ${JSON.stringify(b.content)}`);
  console.log(`  入力${b.log.inputTokens} / 出力${b.log.outputTokens} → ${b.log.costJpy.toFixed(4)}円`);
  await saveCallLog(b.log);

  console.log("\n③ ★G-F：ログに原文が残らないこと");
  const s = JSON.stringify(a.log);
  console.log(`  プロンプトが含まれない: ${!s.includes("受け渡し") ? "✓" : "✗"}`);
  console.log(`  応答本文が含まれない  : ${!s.includes(a.content.trim()) || a.content.trim() === "" ? "✓" : "✗"}`);

  console.log("\n④ ★CT-4：ルーティングなしとの比較");
  const large = await ratesOf(TIER_CONFIG.LARGE.model);
  if (large) {
    const logs = await listCallLogs(CASE_ID);
    const actual = logs.reduce((n, l) => n + l.costJpy, 0);
    const asLarge = logs.reduce((n, l) => n + costJpyOf(large, l.inputTokens, l.outputTokens), 0);
    console.log(`  実際          : ${actual.toFixed(4)}円（${logs.length}件）`);
    console.log(`  全部LARGEなら : ${asLarge.toFixed(4)}円`);
    console.log(`  削減率        : ${((1 - actual / asLarge) * 100).toFixed(1)}%`);
  } else {
    console.log("  LARGE の単価が取得できませんでした");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
