import { callLlm, callLlmStructured } from "@/infra-adapters/llm/router";
import { saveCallLog } from "@/infra-adapters/firestore/repositories/llmCallLogRepository";
import { INTENT_SCHEMA, normalizeIntents, type Intent } from "@/domain/dialogue/intent";
import { INTENT_SYSTEM_PROMPT, RECEPTION_SYSTEM_PROMPT } from "@/domain/dialogue/prompts";
import { sanitizeReception } from "@/domain/dialogue/vocabulary";
import { detectInjection } from "@/domain/security/guard";
import { redactPii } from "@/domain/security/guard";
import { choicesFor } from "@/domain/dialogue/choices";
import { ADJUSTMENT_QUESTION, needsEffectQuestion } from "@/domain/adjustment/flow";
import { EFFECT_LABEL } from "@/domain/adjustment/effect";

/**
 * 対話
 *
 * ★分類 → 受け止め の順に呼ぶが、**分類の失敗で止めない。**
 *   分類は補助であり、分類できないことは話を聞かない理由にならない。
 *
 * ★S4 の範囲は「自分の側」まで。
 *   取次ぎの生成は S5。ここでは相手に何も起きない。
 */

export type DialogueResult = {
  intents: Intent[];
  topic: string | null;
  reply: string;
  choices: { id: string; label: string }[];
  /** ★合意がある論点への変更希望のとき、AIが立てる問い（C3） */
  effectQuestion: string | null;
};

export async function respondTo(input: {
  caseId: string;
  consultationId: string;
  text: string;
  /** 分類後の話題に対応する取り決めを引く。★これがあるからこそ「今回だけ？」と問える */
  resolveAgreement?: (topic: string | null) => Promise<{ topic: string; summary: string } | null>;
}): Promise<DialogueResult> {
  // ★検知は記録であって拒否ではない。
  //   そして止めなくても、コンテキストに無いものは出ない（二重の防御の外側）。
  const hit = detectInjection(input.text);
  if (hit) console.warn(`[security] インジェクションらしい入力を検知: ${hit.pattern}`);

  const { intents, topic } = await classify(input);

  const res = await callLlm({
    tier: "MEDIUM",
    purpose: "EMOTION_RECEPTION",
    system: RECEPTION_SYSTEM_PROMPT,
    user: input.text,
    caseId: input.caseId,
    consultationId: input.consultationId,
    maxOutputTokens: 400,
  });
  await saveCallLog(res.log);

  // ★プロンプトで指示するだけでは漏れる。生成後に言い換える。
  //   語彙の問題で応答を捨てると、当事者を待たせることになる。
  // ★最後の網。ContextBuilder が渡していない以上、本来は何も引っかからない
  const reply = redactPii(sanitizeReception(res.content.trim()));

  // ★C3：合意を参照しているからこそ立てられる問い
  const agreement = input.resolveAgreement ? await input.resolveAgreement(topic) : null;
  const effectQuestion =
    agreement && agreement.topic === topic && needsEffectQuestion({ hasAgreement: true, intents })
      ? ADJUSTMENT_QUESTION.replace("{{current}}", agreement.summary)
      : null;

  const choices = effectQuestion
    ? [
        { id: "one_time", label: EFFECT_LABEL.ONE_TIME },
        { id: "permanent", label: EFFECT_LABEL.PERMANENT },
      ]
    : choicesFor(intents);

  return { intents, topic, reply, choices, effectQuestion };
}

/** ★失敗しても落とさない。分類なしとして受け止めに進む */
async function classify(input: {
  caseId: string;
  consultationId: string;
  text: string;
}): Promise<{ intents: Intent[]; topic: string | null }> {
  try {
    const res = await callLlmStructured<{ intents: string[]; topic: string }>({
      tier: "SMALL",
      purpose: "INTENT_CLASSIFICATION",
      system: INTENT_SYSTEM_PROMPT,
      user: input.text,
      caseId: input.caseId,
      consultationId: input.consultationId,
      schema: INTENT_SCHEMA,
      maxOutputTokens: 200,
    });
    await saveCallLog(res.log);
    return { intents: normalizeIntents(res.content.intents), topic: res.content.topic ?? null };
  } catch (e) {
    // ★分類できないことは、話を聞かない理由にならない
    console.warn("[dialogue] 意図分類に失敗しました。分類なしで続行します", e);
    return { intents: [], topic: null };
  }
}
