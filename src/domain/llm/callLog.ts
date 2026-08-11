/**
 * LLM 呼び出しの記録
 *
 * ★G-F｜原文・非開示情報をログに出さない。
 *
 *   ContextBuilder が相手の原文を防いでも、
 *   プロンプトをそのままログに残せば、ログ経由で漏れる。
 *
 * ★トークン数は残す。
 *   CT-4（ルーティングなしとの比較）に必要であり、原文の復元はできない。
 *
 * @see docs/architecture.md §4.3
 */

import type { ModelTier } from "./tier";

/** 用途。CT-1 の内訳を出すために記録する */
export const LLM_PURPOSES = [
  "INTENT_CLASSIFICATION",
  "RISK_DETECTION",
  "EMOTION_RECEPTION",
  "CIRCUMSTANCE_EXTRACTION",
  "NEUTRAL_TEXT",
  "PROPOSAL_STRUCTURING",
  "MEDIATION_DRAFT",
] as const;
export type LlmPurpose = (typeof LLM_PURPOSES)[number];

/** ★記録として保存する形。prompt / completion というキーが存在しない */
export type LlmCallLog = {
  caseId: string;
  consultationId: string | null;
  purpose: LlmPurpose | string;
  tier: ModelTier;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costJpy: number;
  durationMs: number;
  createdAt: string;
};

/** 呼び出しの全情報。★これはメモリ上にしか存在しない */
export type LlmCallRecord = LlmCallLog & {
  prompt: string;
  completion: string;
};

/**
 * 記録用に絞り込む。
 *
 * ★prompt / completion を「取り除く」のではなく、必要なキーだけを「積む」。
 *   分割代入で残りを渡す形にすると、フィールドが増えたとき自動的に混入する。
 */
export function toCallLog(r: LlmCallRecord): LlmCallLog {
  return {
    caseId: r.caseId,
    consultationId: r.consultationId,
    purpose: r.purpose,
    tier: r.tier,
    model: r.model,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    costJpy: r.costJpy,
    durationMs: r.durationMs,
    createdAt: r.createdAt,
  };
}
