import { callLlm } from "@/infra-adapters/llm/router";
import { saveCallLog } from "@/infra-adapters/firestore/repositories/llmCallLogRepository";
import { findSupportTable } from "@/infra-adapters/firestore/repositories/masterRepository";
import {
  childrenKeyOf,
  formatRange,
  lookupChildSupport,
  type SupportRange,
} from "@/domain/support/table";
import { MEDIATION_SYSTEM_PROMPT, buildMediationInput } from "@/domain/support/mediation";
import {
  canFinalizeAgreement,
  consentStateOf,
  payloadsAgree,
  type Consents,
} from "@/domain/agreement/consent";

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
  /** 子の年齢。★表の選択に使う */
  childAges?: number[];
  proposals: { partyLabel: string; payload: Record<string, unknown> }[];
}): Promise<MediationDraft> {
  const range = await lookupRange(input.topic, input.payerBand, input.payeeBand, input.childAges ?? []);

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
  childAges: number[],
): Promise<SupportRange | null> {
  // ★年収帯が揃っていなければ引かない。片方だけで推定しない
  if (topic !== "CHILD_SUPPORT" || !payerBand || !payeeBand) return null;

  const childrenKey = childrenKeyOf(childAges);
  if (!childrenKey) return null; // 子の情報が無い／公表された表が無い

  const table = await findSupportTable(topic, childrenKey);
  if (!table) return null;

  // ★帯の下端を代表値として引く（帯は算定表の行そのもの）
  const payerMan = bandLowerMan(payerBand);
  const payeeMan = bandLowerMan(payeeBand);
  if (payerMan === null || payeeMan === null) return null;

  return lookupChildSupport(table, { payerMan, payeeMan });
}

/** "425-450" → 425 */
function bandLowerMan(band: string): number | null {
  const n = Number(band.split("-")[0]);
  return Number.isFinite(n) ? n : null;
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
    // ★推論モデルでは、思考トークンも出力枠を消費する（→ architecture.md §4.1a）。
    //   900 では枠を使い切って本文が空になった。実測して余裕を持たせる。
    maxOutputTokens: 3000,
  });
  await saveCallLog(res.log);
  return res.content.trim();
}

// ---------------------------------------------------------------------------

export type AgreementView = {
  state: ReturnType<typeof consentStateOf>;
  canFinalize: boolean;
};

export function viewOfConsents(
  c: Consents,
  payloads?: (Record<string, unknown> | null)[],
): AgreementView {
  return {
    state: consentStateOf(c, payloads),
    canFinalize: payloads ? canFinalizeAgreement(c, payloads) : false,
  };
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
        childAges: snap.children.map((c) => ageOf(c.birthDate)),
        proposals: parties.map((id) => ({
          partyLabel: id === input.partyId ? "あなた" : "お相手",
          payload: byParty.get(id)!,
        })),
      })
    : null;

  const payloads = parties.map((id) => byParty.get(id) ?? null);

  return {
    topic: input.topic,
    ready,
    proposals: parties.map((id) => ({
      isOwn: id === input.partyId,
      payload: byParty.get(id) ?? null,
    })),
    draft,
    // ★提案が一致しているかも状態に含める
    converged: payloadsAgree(payloads),
    ...viewOfConsents(c, payloads),
    ownConsent: consents[input.partyId] ?? "PENDING",
  };
}

/** ★生年月日から年齢。表の選択にのみ使う */
function ageOf(birthDate: string | null | undefined): number {
  if (!birthDate) return 0;
  const b = new Date(birthDate);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return Math.max(0, a);
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

  // ★提案が一致していなければ確定しない。
  //   合成すると、誰も合意していない内容が確定する。
  const proposals = await listProposalsByTopic(caseId, input.topic);
  const byParty = new Map<string, Record<string, unknown>>();
  for (const p of proposals) if (p.payload) byParty.set(p.byPartyId, p.payload);
  const payloads = parties.map((id) => byParty.get(id) ?? null);

  if (canFinalizeAgreement(c, payloads)) {
    const master = await findPublishedPayloadSchema(input.topic);
    // ★一致しているので、どれを取っても同じ
    await finalizeAgreement(caseId, input.topic, payloads[0]!, master?.id ?? "unknown");
  }

  return viewOfConsents(c, payloads);
}
