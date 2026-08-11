import { callLlmStructured } from "@/infra-adapters/llm/router";
import { saveCallLog } from "@/infra-adapters/firestore/repositories/llmCallLogRepository";
import { needsRelay, type Intent } from "@/domain/dialogue/intent";
import { sanitizeReception } from "@/domain/dialogue/vocabulary";
import { EXTRACTION_SCHEMA } from "@/domain/relay/schema";
import { EXTRACTION_SYSTEM_PROMPT, buildRelayText } from "@/domain/relay/prompts";
import { hasVerbatimRun, verifyRelay, type ContextCategory } from "@/domain/relay/guard";

/**
 * 取次ぎの生成 ★C1 の実装本体
 *
 * ★ここを通ったものだけが相手に届く。
 *
 *   入力 → 抽出【MEDIUM】 → ★検査 → 定型の枠にはめる → 相手へ
 *                             ↓ 落ちた
 *                         事情を落として最小形で越える
 *
 * ★再生成を1回だけ試す。繰り返さない。
 *   待たせるうえ、通る保証がない。
 *   **事情が伝わらないことより、原文が越えることのほうが重い。**
 */

export type RelayResult = {
  /** ★相手に届く本文。これ以外は越えない */
  content: string;
  summary: string;
  context: string;
  categories: ContextCategory[];
  /** 検査で落ちた理由。落ちても取次ぎ自体は成立する */
  droppedReason?: "VERBATIM" | "CATEGORY" | "ASSERTION";
  attempts: number;
};

const TOPIC_LABEL: Record<string, string> = {
  CHILD_SUPPORT: "養育費",
  VISITATION: "面会交流",
  SCHEDULE: "日程",
  DAILY_CONTACT: "お子さんのこと",
  OTHER: "ご相談",
};

export async function buildRelay(input: {
  caseId: string;
  consultationId: string;
  raw: string;
  intents: readonly Intent[];
  topic: string | null;
}): Promise<RelayResult | null> {
  // ★感情表現だけでは取次ぎを起こさない。受け止めて終わる
  if (!needsRelay(input.intents)) return null;

  const topicLabel = TOPIC_LABEL[input.topic ?? "OTHER"] ?? "ご相談";

  let last: { summary: string; context: string; categories: string[] } | null = null;
  let verification: ReturnType<typeof verifyRelay> | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    last = await extract(input, attempt);
    verification = verifyRelay({
      raw: input.raw,
      topicLabel,
      context: last.context,
      categories: last.categories,
    });
    if (verification.ok) break;
    // ★1回だけ作り直す。2回目も落ちたら事情を落とす
  }

  const v = verification!;
  const summary = safeSummary(last!.summary, input.raw, topicLabel);

  return {
    content: sanitizeReception(buildRelayText({ topicLabel, summary, context: v.context })),
    summary,
    context: v.context,
    categories: v.categories,
    ...(v.ok ? {} : { droppedReason: v.reason }),
    attempts: v.ok ? 1 : 2,
  };
}

/**
 * ★要約にも同じ検査をかける。
 *   context だけを検査して summary を素通しすると、そこから原文が越える。
 *   落ちたら、話題だけを伝える最小形にする。
 */
function safeSummary(summary: string, raw: string, topicLabel: string): string {
  const s = summary.trim();
  if (!s || hasVerbatimRun(raw, s)) return "ご相談が来ています。";
  return s;
}

async function extract(
  input: { caseId: string; consultationId: string; raw: string },
  attempt: number,
): Promise<{ summary: string; context: string; categories: string[] }> {
  const system =
    attempt === 1
      ? EXTRACTION_SYSTEM_PROMPT
      : `${EXTRACTION_SYSTEM_PROMPT}\n\n# 再試行\n前回の出力は原文をそのまま含んでいたか、規則に反していました。より短く、完全に書き直してください。`;

  const res = await callLlmStructured<{ summary: string; context: string; categories: string[] }>({
    tier: "MEDIUM",
    purpose: "CIRCUMSTANCE_EXTRACTION",
    system,
    user: input.raw,
    caseId: input.caseId,
    consultationId: input.consultationId,
    schema: EXTRACTION_SCHEMA,
    maxOutputTokens: 400,
  });
  await saveCallLog(res.log);

  return {
    summary: res.content.summary ?? "",
    context: res.content.context ?? "",
    categories: res.content.categories ?? [],
  };
}
