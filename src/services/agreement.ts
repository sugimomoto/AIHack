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
import { isVisibleTo, sharingStateOf } from "@/domain/agreement/sharing";
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
  loadLiving,
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

  const [all, consents, bands, living] = await Promise.all([
    listProposalsByTopic(caseId, input.topic),
    loadConsents(caseId, input.topic),
    loadIncomeBands(caseId),
    loadLiving(caseId).catch(() => null),
  ]);

  // ★A-3：ご自身のぶんで足りないものがあるか。
  //   ★お相手のぶんは数えない。**答え終わった人に、同じ入口を出し続けない。**
  const needsIntake =
    input.topic === "CHILD_SUPPORT" &&
    (snap.children.length === 0 || !living || !bands[input.partyId]);

  // ★★ ここで落とす。画面で隠さない。
  //
  //   下書きは、相手に見えてはならない。
  //   画面側で隠す実装にすると、API を直接見れば読める。
  //   **C1（原文が渡らない）と同じ強さで守る。**
  //
  // ★取り下げたものも、相手からは見えなくなる。
  //   ただし「見なかったこと」にはならない（取り下げた事実は伝わる）。
  const proposals = all.filter((p) => isVisibleTo(p, input.partyId));

  // 当事者ごとの最新の提案
  const byParty = new Map<string, Record<string, unknown>>();
  for (const p of proposals) if (p.payload) byParty.set(p.byPartyId, p.payload); // ★作成順なので最後が最新

  // ★自分の最新の仮案が、いまどの状態か（下書き／渡してある／取り下げた）
  const mine = [...all].reverse().find((p) => p.byPartyId === input.partyId) ?? null;
  const sharing = sharingStateOf(mine);

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
  //
  // ★★ そして、双方の提案が揃うのを待たない。
  //
  //   以前は ready（双方に提案がある）を条件にしていた。
  //   LLM に「おふたりの差」を説明させていたので、両方の提案が要ったためである。
  //
  //   ★LLM をやめたいま、範囲は**年収帯と子の年齢だけ**で決まる。提案に依存しない。
  //   そして範囲がいちばん要るのは、**お相手の案を了承するか決めるとき**である。
  //   揃うまで出さないと、**判断材料が要る場面にだけ出ない。**（実機で検出）
  const draft = await buildMediationDraft({
    caseId: input.caseId,
    topic: input.topic,
    // ★義務者＝非監護親。C-01 として暫定
    payerBand: bands[nonCustodial(snap)] ?? null,
    payeeBand: bands[custodial(snap)] ?? null,
    childAges: snap.children.map((c) => ageOf(c.birthDate)),
    // ★もう使わない（説明文を作らなくなったため）。引数の互換のために残す
    proposals: [],
  });

  const payloads = parties.map((id) => byParty.get(id) ?? null);

  // ★N-1：成立した取り決めそのもの。祝うためではなく、何が決まったかを示すため
  const agreed = await loadAgreementItem(caseId, input.topic);

  // ★お相手の案。**見えるものだけ。**下書きはここに入らない
  const theirs =
    [...proposals].reverse().find((p) => p.byPartyId !== input.partyId && p.payload) ?? null;

  return {
    topic: input.topic,
    ready,
    /**
     * ★自分の仮案の中身。**下書きでも取り下げたあとでも、自分には見える。**
     *
     *   取り下げで消していたため、S-5（取り下げたあと）の画面が
     *   帯だけになり、書き直す対象が無くなっていた（実機で検出）。
     *   取り下げは「相手から見えなくする」ことであって、
     *   **自分の手元から消すことではない。**
     */
    ownPayload: mine?.payload ?? null,
    /** ★お相手の案。渡されていなければ null */
    otherPayload: theirs?.payload ?? null,
    otherSharedOn: (theirs?.sharedAt ?? "").slice(0, 10) || null,
    ownSharedOn: (mine?.sharedAt ?? "").slice(0, 10) || null,
    /** ★ご自身のぶんで、算定表に要る情報が足りていないか（A-3 の入口） */
    needsIntake,
    /** ★算定表の範囲。目盛を引くために数値で渡す（表示文は rangeText） */
    range: draft?.range ? { minYen: draft.range.minYen, maxYen: draft.range.maxYen } : null,
    agreement: agreed
      ? { payload: agreed.payload, agreedAt: (agreed.agreedAt ?? "").slice(0, 10) }
      : null,
    proposals: parties.map((id) => ({
      isOwn: id === input.partyId,
      payload: byParty.get(id) ?? null,
    })),
    // ★自分の仮案の状態。下書きが相手に見えていないことを、画面が言い切れるように
    sharing,
    ownProposalId: mine?.id ?? null,
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
  //
  // ★★ 合意になれるのは、**双方に見えている案だけ。**
  //   下書きを数えると、おたがい渡していないのに
  //   たまたま同じ内容を書いただけで合意が成立してしまう（実機で検出）。
  //   合意は、見せて、了承されて、はじめて成り立つ。
  const proposals = (await listProposalsByTopic(caseId, input.topic)).filter(
    (p) => p.sharedAt !== null && p.withdrawnAt === null,
  );
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
