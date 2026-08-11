import { costJpyOf } from "@/domain/llm/pricing";
import { toCallLog, type LlmCallLog, type LlmPurpose } from "@/domain/llm/callLog";
import { assertTierConfig, TIER_CONFIG, type ModelTier } from "@/domain/llm/tier";
import { ratesOf } from "./pricingCatalog";

/**
 * LlmRouter — LLM 呼び出しの唯一の入口
 *
 * ★ここ以外から LLM を呼んではならない（静的検査で担保）。
 *
 *   ContextBuilder が相手の原文への経路を型で消しても、
 *   SDK を直接叩けば迂回できる。入口を1つにすることで、
 *   **C1 の防御とコスト計測が同じ1点に集まる。**
 *
 * ★OpenAI SDK を使わず fetch で呼ぶ。
 *   OrcaRouter は OpenAI 互換であり、必要なのは1エンドポイントのみ。
 *   依存を増やさないことで、「SDK を import していない」という
 *   静的検査が単純な形で成立する。
 *
 * @see docs/architecture.md §4
 */

const ENDPOINT = "https://api.orcarouter.ai/v1/chat/completions";

export type LlmRequest = {
  tier: ModelTier;
  purpose: LlmPurpose | string;
  system: string;
  user: string;
  /** 構造化出力。指定すると JSON Schema に準拠した応答が返る */
  schema?: { name: string; schema: Record<string, unknown> };
  maxOutputTokens?: number;
  /** 記録用。★内容は保存されない */
  caseId: string;
  consultationId?: string | null;
};

export type LlmResponse<T = string> = {
  content: T;
  log: LlmCallLog;
};

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/** 起動時に階層設定を検査する。★実行時まで気づかないと、その間ずっと原価が狂う */
for (const tier of Object.keys(TIER_CONFIG) as ModelTier[]) {
  assertTierConfig(TIER_CONFIG[tier]);
}

export async function callLlm(req: LlmRequest): Promise<LlmResponse<string>> {
  const cfg = TIER_CONFIG[req.tier];
  const key = process.env.ORCAROUTER_API_KEY;
  if (!key) throw new LlmError("ORCAROUTER_API_KEY が設定されていません");

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    ...(cfg.reasoningEffort ? { reasoning_effort: cfg.reasoningEffort } : {}),
    ...(req.maxOutputTokens ? { max_completion_tokens: req.maxOutputTokens } : {}),
    ...(req.schema
      ? {
          response_format: {
            type: "json_schema",
            json_schema: { name: req.schema.name, schema: req.schema.schema, strict: true },
          },
        }
      : {}),
  };

  const started = Date.now();
  const res = await requestWithRetry(key, body);
  const durationMs = Date.now() - started;

  if (!res.ok) {
    // ★応答本文をそのままエラーに載せない（G-F）
    throw new LlmError(`LLM の呼び出しに失敗しました`, res.status);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  const inputTokens = json.usage?.prompt_tokens ?? 0;
  const outputTokens = json.usage?.completion_tokens ?? 0;

  const rates = await ratesOf(cfg.model);
  const costJpy = rates ? costJpyOf(rates, inputTokens, outputTokens) : 0;

  // ★prompt / completion を持たせたうえで toCallLog に落とす。
  //   落とす処理を1箇所に閉じ込め、呼び出し側が組み立てないようにする。
  const log = toCallLog({
    caseId: req.caseId,
    consultationId: req.consultationId ?? null,
    purpose: req.purpose,
    tier: req.tier,
    model: cfg.model,
    inputTokens,
    outputTokens,
    costJpy,
    durationMs,
    createdAt: new Date().toISOString(),
    prompt: `${req.system}\n${req.user}`,
    completion: content,
  });

  return { content, log };
}

/** 構造化出力つきの呼び出し */
export async function callLlmStructured<T>(
  req: LlmRequest & { schema: NonNullable<LlmRequest["schema"]> },
): Promise<LlmResponse<T>> {
  const { content, log } = await callLlm(req);
  try {
    return { content: JSON.parse(content) as T, log };
  } catch {
    // ★応答本文をエラーに載せない（G-F）
    throw new LlmError("構造化出力の解析に失敗しました");
  }
}

/**
 * 429 の扱い
 *
 * ★レート制限はワークスペース単位である（キー単位ではない）。
 *   Retry-After に従い、上限を決めて待つ。待たせすぎない。
 */
const MAX_RETRIES = 2;

async function requestWithRetry(key: string, body: unknown): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (res.status !== 429 || attempt >= MAX_RETRIES) return res;

    const wait = Number(res.headers.get("retry-after")) * 1000;
    await new Promise((r) => setTimeout(r, Number.isFinite(wait) && wait > 0 ? Math.min(wait, 10_000) : 1000));
  }
}
