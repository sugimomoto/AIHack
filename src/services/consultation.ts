import { asCaseId, asConsultationId, type PartyId } from "@/domain/case/types";
import { respondTo } from "./dialogue";
import { buildRelay } from "./relay";
import {
  appendMediationEvent,
  appendSafetyEvent,
  appendMessage,
  appendProposal,
  ensureConsultation,
  findOtherPartyId,
  loadForLlm,
} from "@/infra-adapters/firestore/repositories/caseRepository";
import { assertOwnParty, scopedInbound, scopedMessages } from "@/domain/case/scope";
import { parseEffect } from "@/domain/adjustment/flow";
import { requiresAgreement } from "@/domain/topic/level";
import { detectSafetyFlags, needsHumanReview, toSafetyEvent } from "@/domain/safety/detect";

/**
 * 相談の1往復
 *
 * ★保存の順序に意味がある。
 *
 *   1. 自分の発言を保存        … 相手からは読めない（partyId でスコープ）
 *   2. 受け止めを保存          … 同上
 *   3. 取次ぎを検査して保存    … ★ここで初めて相手側に現れる
 *
 * 3 が失敗しても 1・2 は残る。**受け止めは取次ぎに依存しない。**
 */

/** 合意済みの論点を、問いに差し込める形にする */
async function currentAgreementOf(
  caseId: ReturnType<typeof asCaseId>,
  topic: string | null,
): Promise<{ topic: string; summary: string } | null> {
  const { listAgreementItems } = await import(
    "@/infra-adapters/firestore/repositories/caseRepository"
  );
  const items = await listAgreementItems(caseId);
  // ★話題に対応する合意を選ぶ。最古の1件しか見ないと、別の論点で問いが消える
  const agreed = items.find((i) => i.status === "AGREED" && i.payload && (!topic || i.topic === topic));
  if (!agreed) return null;

  const p = agreed.payload!;
  if (agreed.topic === "CHILD_SUPPORT" && typeof p.monthlyAmount === "number") {
    return { topic: agreed.topic, summary: `養育費は月額${p.monthlyAmount.toLocaleString()}円` };
  }
  if (agreed.topic === "VISITATION" && typeof p.frequency === "string") {
    const { CODE_LABELS } = await import("@/domain/document/builder");
    const f = CODE_LABELS.frequency?.[p.frequency] ?? null;
    if (f) return { topic: agreed.topic, summary: `面会交流は${f}` };
  }
  return null;
}

export type TurnResult = {
  reply: string;
  choices: { id: string; label: string }[];
  /** ★C3：合意を参照して立てた問い */
  effectQuestion: string | null;
  /** ★相手に届いた内容。届かなかった場合は null */
  relayed: string | null;
};

export async function postMessage(input: {
  caseId: string;
  partyId: PartyId;
  text: string;
  /** ★「今回だけ」「今後も」の選択。判定できないうちは未指定 */
  effect?: string | null;
}): Promise<TurnResult> {
  const caseId = asCaseId(input.caseId);
  // ★当事者であることを先に確かめる（A-1）
  const snap = await loadForLlm(caseId);
  assertOwnParty(snap, input.partyId);

  // ★相談は当事者ごとに分かれている。セッションが跨がらない構造そのもの
  const consultationId = asConsultationId(`cons_${input.partyId}`);
  await ensureConsultation(caseId, consultationId, input.partyId);
  await appendMessage(caseId, consultationId, {
    partyId: input.partyId,
    role: "USER",
    content: input.text,
  });

  // ★現在の取り決めを渡す。これがあるからこそ「今回だけ？」と問える（C3）
  // ★先に分類して、その話題の合意を渡す
  // ★フラグを立てて記録するだけ。応答も画面も変えない。
  //   変えると「見抜かれた」という監視感が生まれる（§5.9）。
  //   通告するかどうかは、記録を読んだ人が決める。
  const flags = detectSafetyFlags(input.text);
  if (needsHumanReview(flags)) {
    await appendSafetyEvent(
      toSafetyEvent({
        caseId,
        partyId: input.partyId,
        flags,
        rawText: input.text, // ★原文を保全（FR-10）。G-F の意図的な例外
        createdAt: new Date().toISOString(),
      }),
    );
  }

  const r = await respondTo({
    caseId,
    consultationId,
    text: input.text,
    resolveAgreement: (topic) => currentAgreementOf(caseId, topic),
  });
  await appendMessage(caseId, consultationId, {
    partyId: input.partyId,
    role: "AI",
    content: r.reply,
  });

  const relayed = await relayIfNeeded({
    caseId,
    consultationId,
    partyId: input.partyId,
    raw: input.text,
    intents: r.intents,
    topic: r.topic,
    effect: parseEffect(input.effect),
  });

  return { reply: r.reply, choices: r.choices, effectQuestion: r.effectQuestion, relayed };
}

/** ★取次ぎの失敗で受け止めを巻き戻さない */
async function relayIfNeeded(input: {
  caseId: ReturnType<typeof asCaseId>;
  consultationId: ReturnType<typeof asConsultationId>;
  partyId: PartyId;
  raw: string;
  intents: Parameters<typeof buildRelay>[0]["intents"];
  topic: string | null;
  effect: "ONE_TIME" | "PERMANENT" | null;
}): Promise<string | null> {
  try {
    const relay = await buildRelay({
      caseId: input.caseId,
      consultationId: input.consultationId,
      raw: input.raw,
      intents: input.intents,
      topic: input.topic,
    });
    if (!relay) return null;

    const to = await findOtherPartyId(input.caseId, input.partyId);
    if (!to) return null;

    // ★日常連絡（L3）は合意を求めない。提案を作らない。
    //   作ると、連絡のたびに承諾を求めることになる。
    //   ただし取次ぎは起きる。**C1 の扱いは変わらない。**
    //
    // ★payload が無ければ、合意する内容が無い。
    //   分類を誤って L1 になっても、中身の無い提案を作らない。
    //   承諾を求める対象が空になり、片側の承諾で確定しうる。
    const proposalId = requiresAgreement(input.topic ?? "OTHER") && relay.payload
      ? await appendProposal(input.caseId, {
          byPartyId: input.partyId,
          topic: input.topic ?? "OTHER",
          payload: relay.payload,
          context: relay.context,
          contextCategories: relay.categories,
          status: "PENDING",
          effect: input.effect,
        })
      : undefined;

    await appendMediationEvent(input.caseId, {
      fromPartyId: input.partyId,
      toPartyId: to, // ★宛先。scopedInbound の拠り所
      content: relay.content,
      ...(proposalId ? { proposalId } : {}),
    });

    return relay.content;
  } catch (e) {
    console.error("[consultation] 取次ぎの保存に失敗しました", e);
    return null;
  }
}

/**
 * 画面の再現。
 *
 * ★自分のメッセージと、自分宛の取次ぎだけを返す。
 *   相手の原文へ到達する経路が、この関数にも存在しない。
 */
export async function loadView(input: { caseId: string; partyId: PartyId }) {
  const caseId = asCaseId(input.caseId);
  const snap = await loadForLlm(caseId);
  assertOwnParty(snap, input.partyId);

  const consultationId = asConsultationId(`cons_${input.partyId}`);
  return {
    messages: scopedMessages(snap, consultationId, input.partyId).map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
    inbound: scopedInbound(snap, input.partyId),
  };
}
