import { asCaseId, asConsultationId, type PartyId } from "@/domain/case/types";
import { respondTo } from "./dialogue";
import { buildRelay } from "./relay";
import {
  appendMediationEvent,
  appendMessage,
  appendProposal,
  ensureConsultation,
  findOtherPartyId,
  loadForLlm,
} from "@/infra-adapters/firestore/repositories/caseRepository";
import { assertOwnParty, scopedInbound, scopedMessages } from "@/domain/case/scope";

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

export type TurnResult = {
  reply: string;
  choices: { id: string; label: string }[];
  /** ★相手に届いた内容。届かなかった場合は null */
  relayed: string | null;
};

export async function postMessage(input: {
  caseId: string;
  partyId: PartyId;
  text: string;
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

  const r = await respondTo({ caseId, consultationId, text: input.text });
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
  });

  return { reply: r.reply, choices: r.choices, relayed };
}

/** ★取次ぎの失敗で受け止めを巻き戻さない */
async function relayIfNeeded(input: {
  caseId: ReturnType<typeof asCaseId>;
  consultationId: ReturnType<typeof asConsultationId>;
  partyId: PartyId;
  raw: string;
  intents: Parameters<typeof buildRelay>[0]["intents"];
  topic: string | null;
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

    const proposalId = await appendProposal(input.caseId, {
      byPartyId: input.partyId,
      topic: input.topic ?? "OTHER",
      payload: relay.payload,
      context: relay.context,
      contextCategories: relay.categories,
      status: "PENDING",
    });

    await appendMediationEvent(input.caseId, {
      fromPartyId: input.partyId,
      toPartyId: to, // ★宛先。scopedInbound の拠り所
      content: relay.content,
      proposalId,
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
