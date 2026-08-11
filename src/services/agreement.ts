import { callLlm } from "@/infra-adapters/llm/router";
import { saveCallLog } from "@/infra-adapters/firestore/repositories/llmCallLogRepository";
import { findSupportTable } from "@/infra-adapters/firestore/repositories/masterRepository";
import { lookupChildSupport, formatRange, type SupportRange } from "@/domain/support/table";
import { MEDIATION_SYSTEM_PROMPT, buildMediationInput } from "@/domain/support/mediation";
import { canFinalize, consentStateOf, type Consents } from "@/domain/agreement/consent";

import { asCaseId, type PartyId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import {
  finalizeAgreement,
  listProposalsByTopic,
  loadConsents,
  loadForLlm,
  loadIncomeBands,
  setConsent,
} from "@/infra-adapters/firestore/repositories/caseRepository";
import { findPublishedPayloadSchema } from "@/infra-adapters/firestore/repositories/masterRepository";

/**
 * 合意形成
 *
 * ★金額は算定表から決定的に取得する。LLM は説明だけを生成する（P3）。
 *
 * ★算定表が未検証のとき、注記は `SupportRange.caveat` に入っている。
 *   ここで**必ず戻り値に載せる**。LLM が無視しても、注記は消えない。
 */

export type MediationDraft = {
  /** 算定表から決定的に取得したレンジ。★LLM を通していない */
  range: SupportRange | null;
  /** 算定表の提示文。★注記を含む */
  rangeText: string | null;
  /** LLM が生成した説明 */
  explanation: string;
  /** ★未検証の表を使ったか */
  unverified: boolean;
};

export async function buildMediationDraft(input: {
  caseId: string;
  topic: string;
  payerBand: string | null;
  payeeBand: string | null;
  proposals: { partyLabel: string; payload: Record<string, unknown> }[];
}): Promise<MediationDraft> {
  const range = await lookupRange(input.topic, input.payerBand, input.payeeBand);

  const explanation = await explain({
    caseId: input.caseId,
    topicLabel: "養育費",
    range,
    proposals: input.proposals,
  });

  return {
    range,
    // ★算定表の提示は LLM を通さない。formatRange が注記を必ず含める
    rangeText: range ? formatRange(range) : null,
    explanation,
    unverified: range?.caveat !== undefined,
  };
}

async function lookupRange(
  topic: string,
  payerBand: string | null,
  payeeBand: string | null,
): Promise<SupportRange | null> {
  // ★年収帯が揃っていなければ引かない。片方だけで推定しない
  if (topic !== "CHILD_SUPPORT" || !payerBand || !payeeBand) return null;
  const table = await findSupportTable(topic);
  if (!table) return null;
  return lookupChildSupport(table, { payerBand, payeeBand });
}

/**
 * ★レンジが引けないときは LLM を呼ばない。
 *   目安が無い状態で説明させると、**モデルが金額を作る余地ができる。**
 */
async function explain(input: {
  caseId: string;
  topicLabel: string;
  range: SupportRange | null;
  proposals: { partyLabel: string; payload: Record<string, unknown> }[];
}): Promise<string> {
  if (!input.range) {
    return "算定表の目安をお示しできる情報がまだ揃っていません。おふたりの年収の帯が登録されると、目安をご案内できます。";
  }

  const res = await callLlm({
    tier: "LARGE",
    purpose: "MEDIATION_DRAFT",
    system: MEDIATION_SYSTEM_PROMPT,
    user: buildMediationInput({
      topicLabel: input.topicLabel,
      range: input.range,
      proposals: input.proposals,
    }),
    caseId: input.caseId,
    maxOutputTokens: 900,
  });
  await saveCallLog(res.log);
  return res.content.trim();
}

// ---------------------------------------------------------------------------

export type AgreementView = {
  state: ReturnType<typeof consentStateOf>;
  canFinalize: boolean;
};

export function viewOfConsents(c: Consents): AgreementView {
  return { state: consentStateOf(c), canFinalize: canFinalize(c) };
}

// ---------------------------------------------------------------------------
// ケースに接続した合意形成
// ---------------------------------------------------------------------------

/**
 * 論点の合意状況。
 *
 * ★双方の提案が揃ったときにのみ調停案を作る。
 *   片方だけで作ると、もう一方の意向を推測することになる。
 */
export async function loadAgreementView(input: {
  caseId: string;
  partyId: PartyId;
  topic: string;
}) {
  const caseId = asCaseId(input.caseId);
  const snap = await loadForLlm(caseId);
  assertOwnParty(snap, input.partyId);

  const [proposals, consents, bands] = await Promise.all([
    listProposalsByTopic(caseId, input.topic),
    loadConsents(caseId, input.topic),
    loadIncomeBands(caseId),
  ]);

  // 当事者ごとの最新の提案
  const byParty = new Map<string, Record<string, unknown>>();
  for (const p of proposals) if (p.payload) byParty.set(p.byPartyId, p.payload);

  const parties = snap.parties.map((p) => p.id);
  const ready = parties.length === 2 && parties.every((id) => byParty.has(id));

  const c = {
    a: (consents[parties[0]] ?? "PENDING") as "PENDING" | "ACCEPTED" | "REJECTED",
    b: (consents[parties[1]] ?? "PENDING") as "PENDING" | "ACCEPTED" | "REJECTED",
  };

  const draft = ready
    ? await buildMediationDraft({
        caseId: input.caseId,
        topic: input.topic,
        // ★義務者＝非監護親。C-01 として暫定
        payerBand: bands[nonCustodial(snap)] ?? null,
        payeeBand: bands[custodial(snap)] ?? null,
        proposals: parties.map((id) => ({
          partyLabel: id === input.partyId ? "あなた" : "お相手",
          payload: byParty.get(id)!,
        })),
      })
    : null;

  return {
    topic: input.topic,
    ready,
    proposals: parties.map((id) => ({
      isOwn: id === input.partyId,
      payload: byParty.get(id) ?? null,
    })),
    draft,
    ...viewOfConsents(c),
    ownConsent: consents[input.partyId] ?? "PENDING",
  };
}

function custodial(snap: { parties: { id: string; role: string }[] }): string {
  return snap.parties.find((p) => p.role === "CUSTODIAL")?.id ?? snap.parties[0]?.id ?? "";
}
function nonCustodial(snap: { parties: { id: string; role: string }[] }): string {
  return snap.parties.find((p) => p.role === "NON_CUSTODIAL")?.id ?? snap.parties[1]?.id ?? "";
}

/**
 * 承諾・拒否。
 *
 * ★双方が承諾したときにのみ確定する。
 *   確定時に payloadSchemaId を記録する（どの版のスキーマで合意したか）。
 */
export async function recordConsent(input: {
  caseId: string;
  partyId: PartyId;
  topic: string;
  status: "ACCEPTED" | "REJECTED";
}) {
  const caseId = asCaseId(input.caseId);
  const snap = await loadForLlm(caseId);
  assertOwnParty(snap, input.partyId);

  await setConsent(caseId, input.topic, input.partyId, input.status);

  const consents = await loadConsents(caseId, input.topic);
  const parties = snap.parties.map((p) => p.id);
  const c: Consents = {
    a: (consents[parties[0]] ?? "PENDING") as Consents["a"],
    b: (consents[parties[1]] ?? "PENDING") as Consents["b"],
  };

  if (canFinalize(c)) {
    const proposals = await listProposalsByTopic(caseId, input.topic);
    const master = await findPublishedPayloadSchema(input.topic);
    // ★合意した内容と、その版のスキーマIDを残す
    const merged = proposals.reduce<Record<string, unknown>>((acc, p) => ({ ...acc, ...(p.payload ?? {}) }), {});
    await finalizeAgreement(caseId, input.topic, merged, master?.id ?? "unknown");
  }

  return viewOfConsents(c);
}
