import { asCaseId, type PartyId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import { transition, type AgreementStatus } from "@/domain/agreement/stateMachine";
import { describeChange, reasonTextOf, type RevisionAction } from "@/domain/adjustment/revision";
import { applyAdjustment } from "@/domain/adjustment/flow";
import { isHearsay } from "@/domain/relay/guard";
import {
  appendRevision,
  clearRevisionRequest,
  finalizeAgreement,
  loadAgreementItem,
  loadForLlm,
  loadRevisionRequest,
  saveRevisionRequest,
} from "@/infra-adapters/firestore/repositories/caseRepository";
import { findPublishedPayloadSchema } from "@/infra-adapters/firestore/repositories/masterRepository";

/**
 * K-6 変更申請
 *
 * ★状態機械に遷移があっても、押す場所が無ければ戻れなかった。
 *   REVISION_REQUESTED から出る操作が、どこにも実装されていなかった。
 */

/**
 * 申し出の背景。
 *
 * ★原文は一文字も越えない（C1）。
 *   自由記述を取次ぎの検査に通す実装を最初に書いたが、**必ず落ちた。**
 *   本人が書いた文を「原文と一致しないこと」で検査すれば、当然すべて落ちる。
 *   **書いたものが黙って消える経路を残さない。**
 *
 * ★選ばれたカテゴリに対応する定型文だけを返す（R-3 のホワイトリスト）。
 *   念のため、返す文が伝聞形であることも確かめる（R-2）。
 */
export function reasonFor(code: string | null | undefined): string | null {
  const text = reasonTextOf(code);
  if (!text) return null;
  // ★定型文の書き換えで断定形が混ざったら、越えさせない
  return isHearsay(text) ? text : null;
}

/** 変更を申し出る。★合意の payload には触れない */
export async function requestRevision(input: {
  caseId: string;
  partyId: PartyId;
  topic: string;
  change: Record<string, unknown>;
  /** ★自由記述ではない。越えてよいカテゴリのコード */
  reasonCode?: string | null;
}) {
  const caseId = asCaseId(input.caseId);
  const snap = await loadForLlm(caseId);
  assertOwnParty(snap, input.partyId);

  const current = await loadAgreementItem(caseId, input.topic);
  // ★合意が無ければ変えるものが無い。状態機械にも AGREED からの遷移しかない
  if (!current) throw new Error("合意がありません");
  transition("AGREED", "REQUEST_REVISION");

  await saveRevisionRequest(caseId, input.topic, {
    byPartyId: input.partyId,
    change: input.change,
    relayedReason: reasonFor(input.reasonCode),
  });

  return describeChange(current.payload, input.change);
}

/** 申し出の内容。★申し出た本人には出さない（自分に同意を求めない） */
export async function pendingRevisionFor(input: {
  caseId: string;
  partyId: PartyId;
  topic: string;
}) {
  const caseId = asCaseId(input.caseId);
  const snap = await loadForLlm(caseId);
  assertOwnParty(snap, input.partyId);

  const req = await loadRevisionRequest(caseId, input.topic);
  if (!req) return null;

  const current = await loadAgreementItem(caseId, input.topic);
  if (!current) return null;

  return {
    isOwn: req.byPartyId === input.partyId,
    reason: req.relayedReason,
    current: current.payload,
    proposed: { ...current.payload, ...req.change },
    description: describeChange(current.payload, req.change),
  };
}

/**
 * 申し出に答える。
 *
 * ★「いまの取り決めのままにしたい」で、いまの取り決めに戻る。
 *   これを IN_NEGOTIATION に落とすと、**断った人が現在の取り決めを失う。**
 */
export async function respondToRevision(input: {
  caseId: string;
  partyId: PartyId;
  topic: string;
  action: RevisionAction;
}) {
  const caseId = asCaseId(input.caseId);
  const snap = await loadForLlm(caseId);
  assertOwnParty(snap, input.partyId);

  const req = await loadRevisionRequest(caseId, input.topic);
  if (!req) throw new Error("申し出がありません");
  // ★申し出た本人が承諾できてしまうと、双方の一致という前提が崩れる
  if (req.byPartyId === input.partyId) throw new Error("ご自身の申し出には答えられません");

  const current = await loadAgreementItem(caseId, input.topic);
  if (!current) throw new Error("合意がありません");

  const event =
    input.action === "ACCEPT"
      ? "AGREE_REVISION"
      : input.action === "KEEP"
        ? "DECLINE_REVISION"
        : "REVISION_FAILED";
  const next: AgreementStatus = transition("REVISION_REQUESTED", event);

  if (input.action === "ACCEPT") {
    const r = applyAdjustment("PERMANENT", { agreement: current, change: req.change });
    if (r.revision) await appendRevision(caseId, input.topic, r.revision);
    const master = await findPublishedPayloadSchema(input.topic);
    await finalizeAgreement(
      caseId,
      input.topic,
      r.agreement.payload,
      master?.id ?? "unknown",
      r.agreement.version,
    );
    await clearRevisionRequest(caseId, input.topic, next);
    return { status: next, payload: r.agreement.payload };
  }

  // ★KEEP も COUNTER も、合意の payload には触れない。
  //   KEEP は AGREED のまま。COUNTER は話し合いに戻る。
  await clearRevisionRequest(caseId, input.topic, next);
  return { status: next, payload: current.payload };
}
