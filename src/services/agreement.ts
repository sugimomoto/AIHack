// ★このファイルは LLM を呼ばない。
//   取り決めに関わる経路から、AI を完全に外した（P3）。
import { findSupportTable } from "@/infra-adapters/firestore/repositories/masterRepository";
import {
  childrenKeyOf,
  formatRange,
  lookupChildSupport,
  type SupportRange,
} from "@/domain/support/table";
import {
  canFinalizeAgreement,
  consentStateOf,
  payloadsAgree,
  type Consents,
} from "@/domain/agreement/consent";

import { asCaseId, type PartyId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import { applyAdjustment, parseEffect } from "@/domain/adjustment/flow";
import {
  appendException,
  appendRevision,
  finalizeAgreement,
  loadAgreementItem,
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
  /**
   * ★算定表が引けないときのお知らせ。**LLM を通さない定型文。**
   *   以前は LLM に「おふたりの差」を説明させていた（explanation）。
   */
  notice: string | null;
  /** ★未検証の表を使ったか */
  unverified: boolean;
};

/** ★年収帯が揃っていないときのお知らせ。定型文 */
const RANGE_UNAVAILABLE =
  "算定表の目安をお示しできる情報がまだ揃っていません。" +
  "おふたりの年収の帯が登録されると、目安をご案内できます。";

export async function buildMediationDraft(input: {
  caseId: string;
  topic: string;
  payerBand: string | null;
  payeeBand: string | null;
  /** 子の年齢。★表の選択に使う */
  childAges?: number[];
  proposals: { payload: Record<string, unknown> }[];
}): Promise<MediationDraft> {
  const range = await lookupRange(input.topic, input.payerBand, input.payeeBand, input.childAges ?? []);

  // ★★ LLM を呼ばない。
  //
  //   以前はここで LARGE モデルに「おふたりのご提案の差」を説明させていた。
  //   生成後の検査（verifyMediationText）で守ってはいたが、
  //   **AI が金額に触れる経路が残っている**ことに変わりはなかった。
  //
  //   P3（数字と条項を LLM に作らせない）を例外なく守るため、範囲の提示だけにする。
  //   lookupChildSupport は決定的で、誤りようがない。
  return {
    range,
    // ★算定表の提示は LLM を通さない。formatRange が注記を必ず含める
    rangeText: range ? formatRange(range) : null,
    notice: range ? null : RANGE_UNAVAILABLE,
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
 * ★★ 調停案の生成（explain）は、丸ごと外した。
 *
 *   LARGE モデルに「おふたりのご提案の差」を説明させ、
 *   生成後に verifyMediationText で検査していた。
 *
 *   検査は効いていたが、**AI が金額に触れる経路が残っていた**ことに変わりはない。
 *   相談から取り決めを作るのをやめた以上、ここだけ例外にする理由が無い。
 *
 * ★domain 側（MEDIATION_SYSTEM_PROMPT / buildMediationInput / verifyMediationText）は
 *   残してある。検査のロジックは、いつか調停の支援を作るときに要る。
 *
 * @see .steering/20260812-feedback-pivot/design.md §6
 */

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
  for (const p of proposals) if (p.payload) byParty.set(p.byPartyId, p.payload); // ★作成順なので最後が最新

  const parties = snap.parties.map((p) => p.id);
  const ready = parties.length === 2 && parties.every((id) => byParty.has(id));

  const c = {
    a: (consents[parties[0]] ?? "PENDING") as "PENDING" | "ACCEPTED" | "REJECTED",
    b: (consents[parties[1]] ?? "PENDING") as "PENDING" | "ACCEPTED" | "REJECTED",
  };

  // ★★ キャッシュをやめた。
  //
  //   LARGE モデルを呼んでいたころは、画面を開くたびの生成で CT-1 が想定の4倍になり、
  //   同じ提案の組み合わせなら作り直さない仕組みが要った。
  //
  //   いまは LLM を呼ばない。算定表を引くだけで、決定的である。
  //   **キャッシュは、正しさを固定する側にしか働かない。**
  //   （実際、鍵の設計を誤って「情報が揃っていません」が恒久的に残る不具合を出した）
  const draft = ready
    ? await buildMediationDraft({
        caseId: input.caseId,
        topic: input.topic,
        // ★義務者＝非監護親。C-01 として暫定
        payerBand: bands[nonCustodial(snap)] ?? null,
        payeeBand: bands[custodial(snap)] ?? null,
        childAges: snap.children.map((c) => ageOf(c.birthDate)),
        // ★閲覧者に依存しない。誰の案かは構造化表示（proposals[].isOwn）が担う
        proposals: parties.map((id) => ({ payload: byParty.get(id)! })),
      })
    : null;

  const payloads = parties.map((id) => byParty.get(id) ?? null);

  // ★N-1：成立した取り決めそのもの。祝うためではなく、何が決まったかを示すため
  const agreed = await loadAgreementItem(caseId, input.topic);

  return {
    topic: input.topic,
    ready,
    agreement: agreed
      ? { payload: agreed.payload, agreedAt: (agreed.agreedAt ?? "").slice(0, 10) }
      : null,
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
  const byParty = new Map<string, (typeof proposals)[number]>();
  for (const p of proposals) if (p.payload) byParty.set(p.byPartyId, p); // ★作成順なので最後が最新
  const payloads = parties.map((id) => byParty.get(id)?.payload ?? null);

  if (canFinalizeAgreement(c, payloads)) {
    // ★C3：今回だけか、今後もかで、起きることが変わる。
    //   ここを分岐させないと、一時的な融通が合意そのものを書き換える。
    const effect =
      parseEffect(parties.map((id) => byParty.get(id)?.effect).find((e) => e) ?? null) ?? "PERMANENT";
    const change = payloads[0]!;
    const current = (await loadAgreementItem(caseId, input.topic)) ?? { version: 0, payload: {} };

    const r = applyAdjustment(effect, { agreement: current, change });

    if (r.exception) {
      // ★合意に触れない。その回の義務にだけ効く例外として残す
      await appendException(caseId, input.topic, { change: r.exception, byPartyId: input.partyId });
    } else {
      const master = await findPublishedPayloadSchema(input.topic);
      if (r.revision && current.version > 0) {
        await appendRevision(caseId, input.topic, r.revision);
      }
      await finalizeAgreement(
        caseId,
        input.topic,
        r.agreement.payload,
        master?.id ?? "unknown",
        r.agreement.version,
      );
    }
  }

  return viewOfConsents(c, payloads);
}
