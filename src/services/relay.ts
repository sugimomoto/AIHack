import { callLlmStructured } from "@/infra-adapters/llm/router";
import { saveCallLog } from "@/infra-adapters/firestore/repositories/llmCallLogRepository";
import { needsRelay, type Intent } from "@/domain/dialogue/intent";
import { sanitizeReception } from "@/domain/dialogue/vocabulary";
import { redactPii } from "@/domain/security/guard";
import { summaryFromPayload } from "@/domain/relay/summary";
import { EXTRACTION_SCHEMA } from "@/domain/relay/schema";
import { EXTRACTION_SYSTEM_PROMPT, buildRelayText } from "@/domain/relay/prompts";
import { hasVerbatimRun, verifyRelay, type ContextCategory } from "@/domain/relay/guard";
import { stripUnstated, toProposalSchema } from "@/domain/relay/payload";
import { findPublishedPayloadSchema } from "@/infra-adapters/firestore/repositories/masterRepository";

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
  /** ★構造化された提案。書かれた項目のみを持つ */
  payload: Record<string, unknown> | null;
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
  /** ★取り決めを動かさない相談か（ADJUSTMENT / NOTIFICATION） */
  flexible?: boolean;
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
  // ★payload を先に作る。要約が逐語一致で落ちたときの受け皿になる
  const payload = await structurePayload({ ...input, flexible: input.flexible });
  const summary = safeSummary(last!.summary, input.raw, topicLabel, payload);

  return {
    payload,
    // ★相手に届くものにも PII フィルタを掛ける。
    //   言い換えられた電話番号や住所は原文と10文字一致しないため、
    //   INV-4a では検出できない（レビューで検出）。
    content: redactPii(sanitizeReception(buildRelayText({ topicLabel, summary, context: v.context }))),
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
 *
 * ★落ちたら、まず**構造化された提案から組み立て直す。**
 *   短く素直に書いた発言ほど要約が原文と一致して落ちるため、
 *   **はっきり書いた人ほど、伝わる中身が減っていた。**
 *   構造化された値は原文から作られていないので、逐語一致が起こりえない。
 *
 * ★それも作れないときだけ、話題だけを伝える最小形にする。
 */
function safeSummary(
  summary: string,
  raw: string,
  topicLabel: string,
  payload: Record<string, unknown> | null,
): string {
  const s = summary.trim();
  if (s && !hasVerbatimRun(raw, s)) return s;

  // ★検査は自由記述の項目だけにかける（summaryFromPayload の中で行う）。
  //   組み立てた文全体を検査すると、日付や場所を正しく伝えるほど落ちてしまい、
  //   **事実を伝えること自体ができなくなる。**
  const fromPayload = summaryFromPayload(payload, raw);
  if (fromPayload) return fromPayload;

  return "ご相談が来ています。";
}

/**
 * 提案の構造化
 *
 * ★合意用スキーマの required を外して使う。
 *   そのまま使うと、書かれていない支払日や終期をLLMが埋める（P3違反）。
 *
 * ★スキーマが無い論点では payload を作らない。
 *   構造が定義されていないものを、その場で作り出さない。
 */
async function structurePayload(input: {
  caseId: string;
  consultationId: string;
  raw: string;
  topic: string | null;
  /** ★取り決めを動かさない相談では、柔軟なスキーマで取り出す（設計どおり） */
  flexible?: boolean;
}): Promise<Record<string, unknown> | null> {
  // ★ADJUSTMENT は論点のスキーマを使わない。
  //   養育費のスキーマで取り出すと、入学金が月額として入ってしまう。
  const key = input.flexible ? "ADJUSTMENT" : input.topic;
  if (!key) return null;
  try {
    const master = await findPublishedPayloadSchema(key);
    if (!master) return null;

    const res = await callLlmStructured<Record<string, unknown>>({
      tier: "SMALL",
      purpose: "PROPOSAL_STRUCTURING",
      system: [
        "入力に書かれている項目だけを取り出してください。",
        "★書かれていない項目は含めないでください。推測して埋めないでください。",
        "金額は数値で、単位を含めずに返してください（「月3万」→ 30000）。",
      ].join("\n"),
      user: input.raw,
      caseId: input.caseId,
      consultationId: input.consultationId,
      schema: {
        name: "proposal_payload",
        schema: toProposalSchema(master.schema) as Record<string, unknown>,
      },
      maxOutputTokens: 300,
    });
    await saveCallLog(res.log);

    const payload = stripUnstated(res.content);
    return Object.keys(payload).length > 0 ? payload : null;
  } catch (e) {
    // ★構造化に失敗しても取次ぎは成立する。文章は既に検査を通っている
    console.warn("[relay] 提案の構造化に失敗しました。payload なしで続行します", e);
    return null;
  }
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
