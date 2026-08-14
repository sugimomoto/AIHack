import type {
  AgreementItemId,
  CaseId,
  ConsultationId,
  ContactInfo,
  Party,
  PartyId,
  PartyRecord,
} from "@/domain/case/types";
import { asAgreementItemId, asCaseId, asConsultationId, asPartyId, asProposalId } from "@/domain/case/types";
import type { CaseSnapshot } from "@/domain/context/snapshot";
import { getDb } from "../client";

/**
 * ケースの読み取り
 *
 * ★loadForLlm は非開示情報を読み込まない。
 *   ContextBuilder が渡さないことに加え、そもそも取得しない。
 *   二重の防御（→ docs/domain/context/snapshot.ts のコメント）。
 */

const caseRef = (caseId: CaseId) => getDb().collection("cases").doc(caseId);

/**
 * LLM 経路用のスナップショット。
 *
 * ★contactInfos を読み込まない。
 *   住所・電話・勤務先・年収は、そもそもメモリに載せない。
 */
export async function loadForLlm(caseId: CaseId): Promise<CaseSnapshot> {
  const root = caseRef(caseId);

  const [parties, children, consultations, agreementItems, proposals, mediationEvents] =
    await Promise.all([
      root.collection("parties").get(),
      root.collection("children").get(),
      root.collection("consultations").get(),
      root.collection("agreementItems").get(),
      root.collection("proposals").get(),
      root.collection("mediationEvents").get(),
    ]);

  // メッセージは相談ごとのサブコレクション
  const messages = (
    await Promise.all(
      consultations.docs.map(async (c) => {
        const snap = await c.ref.collection("messages").orderBy("createdAt").get();
        return snap.docs.map((m) => ({
          id: m.id,
          consultationId: asConsultationId(c.id),
          partyId: asPartyId(m.get("partyId")),
          role: m.get("role") as "USER" | "AI",
          content: m.get("content") as string,
          // ★取次ぎの有無。undefined は「まだ記録が無い」（過去の発言）
          relayed: m.get("relayed") as boolean | undefined,
          createdAt: m.get("createdAt") as string,
        }));
      }),
    )
  ).flat();

  return {
    caseId,
    // ★contactInfos は設定しない
    parties: parties.docs.map((d) => ({
      id: asPartyId(d.id),
      caseId,
      authUid: d.get("authUid"),
      role: d.get("role"),
      displayNameForOther: d.get("displayNameForOther") ?? "お相手",
      incomeBand: d.get("incomeBand") ?? null,
      state: d.get("state") ?? "ACTIVE",
    })),
    children: children.docs.map((d) => ({ id: d.id, birthDate: d.get("birthDate") })),
    consultations: consultations.docs.map((d) => ({
      id: asConsultationId(d.id),
      caseId,
      scenarioId: d.get("scenarioId") ?? null,
      initiatedByPartyId: asPartyId(d.get("initiatedByPartyId")),
      status: d.get("status") ?? "OPEN",
    })),
    messages,
    agreementItems: agreementItems.docs.map((d) => ({
      id: asAgreementItemId(d.id),
      topic: d.get("topic"),
      status: d.get("status"),
      payload: d.get("payload"),
      version: d.get("version") ?? 1,
    })),
    proposals: proposals.docs.map((d) => ({
      id: asProposalId(d.id),
      agreementItemId: asAgreementItemId(d.get("agreementItemId")),
      proposedByPartyId: d.get("proposedByPartyId") ? asPartyId(d.get("proposedByPartyId")) : null,
      payload: d.get("payload"),
      context: d.get("context") ?? undefined,
      rationale: d.get("rationale") ?? undefined,
      status: d.get("status") ?? "PENDING",
    })),
    mediationEvents: mediationEvents.docs.map((d) => ({
      id: d.id,
      // ★差出人。**送った本人に「何が伝わったか」を見せるために要る**
      fromPartyId: d.get("fromPartyId") ? asPartyId(d.get("fromPartyId")) : undefined,
      toPartyId: asPartyId(d.get("toPartyId")),
      content: d.get("content"),
      scenarioId: (d.get("scenarioId") ?? null) as string | null,
      threadId: (d.get("threadId") ?? null) as string | null,
      createdAt: (d.get("createdAt") ?? "") as string,
    })),
  };
}

/** 認証UIDから当事者を引く */
export async function findPartyByAuthUid(authUid: string): Promise<PartyRecord | null> {
  const snap = await getDb()
    .collectionGroup("parties")
    .where("authUid", "==", authUid)
    .limit(1)
    .get();

  const d = snap.docs[0];
  if (!d) return null;

  return {
    id: asPartyId(d.id),
    caseId: asCaseId(d.ref.parent.parent!.id),
    authUid,
    role: d.get("role"),
    displayNameForOther: d.get("displayNameForOther") ?? "お相手",
    incomeBand: d.get("incomeBand") ?? null,
    state: d.get("state") ?? "ACTIVE",
  };
}

/**
 * ★本人の非開示情報。
 *
 * `/contactInfo/{partyId}` はケース配下に置かない（→ architecture.md §3.2）。
 * この関数は **本人の設定画面でのみ** 使う。LLM 経路からは呼ばない（G-B）。
 */
export async function loadOwnContactInfo(partyId: PartyId): Promise<ContactInfo | null> {
  const d = await getDb().collection("contactInfo").doc(partyId).get();
  if (!d.exists) return null;
  return {
    partyId,
    address: d.get("address") ?? null,
    phone: d.get("phone") ?? null,
    employer: d.get("employer") ?? null,
    annualIncome: d.get("annualIncome") ?? null,
  };
}

/**
 * 本人の非開示情報を保存する。
 *
 * ★書き先は `/contactInfo/{partyId}`。ケース配下ではない。
 *   パスの設計そのものが FR-09 の実装である。
 *   ここをケース配下に移した瞬間、INV-2 の前提が崩れる。
 */
export async function saveOwnContactInfo(
  partyId: PartyId,
  patch: Partial<ContactInfo>,
): Promise<void> {
  const { partyId: _ignored, ...fields } = patch;
  if (Object.keys(fields).length === 0) return;
  await getDb().collection("contactInfo").doc(partyId).set(fields, { merge: true });
}

/**
 * ケース配下の Party を更新する。
 *
 * ★ここに精密な年収を書いてはならない（INV-2a）。
 *   書いてよいのは planProfileWrite が partyPatch に入れた値だけである。
 */
export async function patchParty(
  caseId: CaseId,
  partyId: PartyId,
  patch: { incomeBand?: string; state?: PartyRecord["state"] },
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await caseRef(caseId).collection("parties").doc(partyId).set(patch, { merge: true });
}

// ---------------------------------------------------------------------------
// 書き込み
// ---------------------------------------------------------------------------

/**
 * ★メッセージは相談のサブコレクションに置く。
 *   `partyId` を必ず持たせる。これが `scopedMessages` の拠り所になる。
 */
export async function appendMessage(
  caseId: CaseId,
  consultationId: ConsultationId,
  m: { partyId: PartyId; role: "USER" | "AI"; content: string },
): Promise<string> {
  const ref = await caseRef(caseId)
    .collection("consultations")
    .doc(consultationId)
    .collection("messages")
    .add({ ...m, createdAt: new Date().toISOString() });
  return ref.id;
}

/**
 * ★その発言が取次がれたかを記録する。
 *
 *   届いたか届かなかったかが画面から分からないと、
 *   **「取り次いでくれたのか」が最後まで判断できない。**
 *   届かなかったことも、届いたことと同じだけ明示する。
 */
export async function markMessageRelay(
  caseId: CaseId,
  consultationId: ConsultationId,
  messageId: string,
  relayed: boolean,
): Promise<void> {
  await caseRef(caseId)
    .collection("consultations")
    .doc(consultationId)
    .collection("messages")
    .doc(messageId)
    .set({ relayed }, { merge: true });
}

/** 相談が無ければ作る。★当事者ごとに1つ（セッションが分かれている） */
export async function ensureConsultation(
  caseId: CaseId,
  consultationId: ConsultationId,
  partyId: PartyId,
  meta?: {
    scenarioId?: string | null;
    threadId?: string | null;
    title?: string | null;
    /** ★どちらから始まったか。**立てたときだけ記録する** */
    initiatedBy?: "SELF" | "OTHER";
  },
): Promise<void> {
  const ref = caseRef(caseId).collection("consultations").doc(consultationId);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { partyId, updatedAt: now };

  // ★題は最初に立てたときだけ入れる。あとから上書きして消さない
  if (meta?.scenarioId) patch.scenarioId = meta.scenarioId;
  if (meta?.threadId) patch.threadId = meta.threadId;
  if (meta?.title) patch.title = meta.title;

  // ★始まりは一度だけ。あとから書き換えると、
  //   相手から来た相談が自分発のものに化ける。
  const exists = (await ref.get()).exists;
  if (!exists) {
    patch.createdAt = now;
    patch.initiatedBy = meta?.initiatedBy ?? "SELF";
  }
  await ref.set(patch, { merge: true });
}

/**
 * 相談を閉じる／戻す。
 *
 * ★済んだものが残り続けると、**対応が要るものが埋もれる。**
 * ★消さない。沈めるだけ。あとから戻せる。
 */
export async function setConsultationStatus(
  caseId: CaseId,
  consultationId: ConsultationId,
  status: "OPEN" | "CLOSED",
): Promise<void> {
  await caseRef(caseId)
    .collection("consultations")
    .doc(consultationId)
    .set(
      {
        status,
        // ★いつ閉じたかを持つ。**閉じたあとに届いたものを埋もれさせないため。**
        closedAt: status === "CLOSED" ? new Date().toISOString() : null,
      },
      { merge: true },
    );
}

/**
 * 相談の一覧（K-1）
 *
 * ★自分の相談だけ。**未読の印も件数バッジも持たない。**
 * ★並び順は更新の新しい順。上から片づけるものに見せない。
 */
export async function listConsultations(
  caseId: CaseId,
  partyId: PartyId,
): Promise<
  {
    id: string;
    title: string | null;
    scenarioId: string | null;
    threadId: string | null;
    status: string;
    closedAt: string | null;
    initiatedBy: "SELF" | "OTHER" | null;
    createdAt: string | null;
    updatedAt: string;
  }[]
> {
  const snap = await caseRef(caseId).collection("consultations").where("partyId", "==", partyId).get();
  return snap.docs
    .map((d) => ({
      id: d.id,
      title: (d.get("title") ?? null) as string | null,
      scenarioId: (d.get("scenarioId") ?? null) as string | null,
      threadId: (d.get("threadId") ?? null) as string | null,
      status: (d.get("status") ?? "OPEN") as string,
      closedAt: (d.get("closedAt") ?? null) as string | null,
      initiatedBy: (d.get("initiatedBy") ?? null) as "SELF" | "OTHER" | null,
      createdAt: (d.get("createdAt") ?? null) as string | null,
      updatedAt: (d.get("updatedAt") ?? "") as string,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * ★取次ぎ。`toPartyId` が宛先である。
 *   これが `scopedInbound` の拠り所になる。
 */
export async function appendMediationEvent(
  caseId: CaseId,
  e: {
    fromPartyId: PartyId;
    toPartyId: PartyId;
    content: string;
    proposalId?: string;
    /** ★どの相談から出たか。相手側でも同じ相談に並べるために要る */
    scenarioId?: string | null;
    threadId?: string | null;
  },
): Promise<string> {
  const ref = await caseRef(caseId)
    .collection("mediationEvents")
    .add({ ...e, createdAt: new Date().toISOString() });
  return ref.id;
}

/** 提案。★payload と context を分けて保存する */
export async function appendProposal(
  caseId: CaseId,
  p: {
    byPartyId: PartyId;
    topic: string;
    payload: Record<string, unknown> | null;
    context: string;
    contextCategories: string[];
    status: string;
    /** ★今回だけか、今後もか。判定できないうちは null */
    effect?: "ONE_TIME" | "PERMANENT" | null;
    /**
     * ★どの相談から出た提案か。
     *   これが無かったため、**混ざっても気づく手段が無かった。**
     *   「進学費用」から養育費への提案が出ていたことを、
     *   実データから追えなかった。
     */
    threadId?: string | null;
    scenarioId?: string | null;
    /**
     * ★相手に渡したか。**既定は下書き（null）。**
     *   下書きは相手から見えない（domain/agreement/sharing）。
     */
    sharedAt?: string | null;
    /**
     * ★承諾をやり直さない。**了承の経路だけで使う。**
     *
     *   了承では、相手の案を**サーバ側で複製**して積む。
     *   内容が同じなのに承諾をやり直すと、
     *   了承した瞬間に相手の承諾が消え、いつまでも合意にならない（実機で検出）。
     *
     *   ★内容が違いうる経路（下書きの保存）では、必ずやり直すこと。
     *     前回の ACCEPTED が残っていると、片側1クリックで別の内容が確定する。
     */
    keepConsents?: boolean;
  },
): Promise<string> {
  const ref = await caseRef(caseId)
    .collection("proposals")
    .add({
      ...p,
      effect: p.effect ?? null,
      // ★既定で下書き。書いた時点で相手に見えることは無い
      sharedAt: p.sharedAt ?? null,
      withdrawnAt: null,
      createdAt: new Date().toISOString(),
    });

  // ★新しい提案が出たら、承諾をやり直す。
  //   前回の ACCEPTED が残っていると、片側1クリックで別の内容が確定する
  //   （レビューで検出）。
  await caseRef(caseId)
    .collection("agreementItems")
    .doc(p.topic)
    .set(
      {
        topic: p.topic,
        ...(p.keepConsents ? {} : { consents: {} }),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

  return ref.id;
}

/** ★相手の当事者ID。取次ぎの宛先を決めるために使う */
export async function findOtherPartyId(caseId: CaseId, partyId: PartyId): Promise<PartyId | null> {
  const snap = await caseRef(caseId).collection("parties").get();
  const other = snap.docs.find((d) => d.id !== partyId);
  return other ? asPartyId(other.id) : null;
}

/** ★論点ごとの提案。合意形成に使う */
/** ★作成順に返す。順序が不定だと「最新の提案」が決まらない（レビューで検出） */
export async function listProposalsByTopic(
  caseId: CaseId,
  topic: string,
): Promise<
  {
    id: string;
    byPartyId: PartyId;
    payload: Record<string, unknown> | null;
    effect: "ONE_TIME" | "PERMANENT" | null;
    /** ★渡した時刻。null なら下書き（相手に見えていない） */
    sharedAt: string | null;
    /** ★取り下げた時刻 */
    withdrawnAt: string | null;
    createdAt: string;
  }[]
> {
  const snap = await caseRef(caseId).collection("proposals").where("topic", "==", topic).get();
  return snap.docs
    .map((d) => ({
      id: d.id,
      byPartyId: asPartyId(d.get("byPartyId")),
      payload: (d.get("payload") ?? null) as Record<string, unknown> | null,
      effect: (d.get("effect") ?? null) as "ONE_TIME" | "PERMANENT" | null,
      sharedAt: (d.get("sharedAt") ?? null) as string | null,
      withdrawnAt: (d.get("withdrawnAt") ?? null) as string | null,
      createdAt: (d.get("createdAt") ?? "") as string,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * ★仮案をお相手に渡す。
 *
 *   渡すまで相手には見えない。渡して初めて、相手の画面に現れる。
 */
export async function shareProposal(caseId: CaseId, proposalId: string): Promise<string> {
  const at = new Date().toISOString();
  await caseRef(caseId).collection("proposals").doc(proposalId).update({ sharedAt: at });
  return at;
}

/**
 * ★仮案を取り下げる。
 *
 *   **「見ていない状態」には戻せない。**
 *   取り下げたことは相手にも見える（domain/agreement/sharing）。
 */
export async function withdrawProposal(caseId: CaseId, proposalId: string): Promise<string> {
  const at = new Date().toISOString();
  await caseRef(caseId).collection("proposals").doc(proposalId).update({ withdrawnAt: at });
  return at;
}

/** 合意の改訂履歴。★PERMANENT のときだけ積まれる */
export async function appendRevision(
  caseId: CaseId,
  topic: string,
  rev: { fromVersion: number; previousPayload: Record<string, unknown> },
): Promise<void> {
  await caseRef(caseId)
    .collection("agreementItems")
    .doc(topic)
    .collection("revisions")
    .add({ ...rev, createdAt: new Date().toISOString() });
}

/**
 * 変更の申し出（K-6）
 *
 * ★ここに入れてよいのは、取次ぎの検査を通った文だけである。
 *   原文をそのまま置くと、相手の画面に出た瞬間に C1 が破れる。
 *
 * ★合意の payload には触れない。**承諾されるまで、いまの取り決めが続く。**
 */
export async function saveRevisionRequest(
  caseId: CaseId,
  topic: string,
  req: { byPartyId: PartyId; change: Record<string, unknown>; relayedReason: string | null },
): Promise<void> {
  await caseRef(caseId)
    .collection("agreementItems")
    .doc(topic)
    .set(
      {
        status: "REVISION_REQUESTED",
        revisionRequest: { ...req, createdAt: new Date().toISOString() },
      },
      { merge: true },
    );
}

export async function loadRevisionRequest(
  caseId: CaseId,
  topic: string,
): Promise<{
  byPartyId: string;
  change: Record<string, unknown>;
  relayedReason: string | null;
  createdAt: string;
} | null> {
  const d = await caseRef(caseId).collection("agreementItems").doc(topic).get();
  if (d.get("status") !== "REVISION_REQUESTED") return null;
  return (d.get("revisionRequest") ?? null) as never;
}

/** 申し出を取り下げる。★status は呼び出し側が状態機械を通して決める */
export async function clearRevisionRequest(
  caseId: CaseId,
  topic: string,
  status: string,
): Promise<void> {
  await caseRef(caseId)
    .collection("agreementItems")
    .doc(topic)
    .set({ status, revisionRequest: null }, { merge: true });
}

/** ★ONE_TIME の例外。合意は変えず、その回の義務にだけ効く */
export async function appendException(
  caseId: CaseId,
  topic: string,
  ex: { change: Record<string, unknown>; byPartyId: PartyId },
): Promise<void> {
  await caseRef(caseId)
    .collection("adjustments")
    .add({ topic, effect: "ONE_TIME", ...ex, createdAt: new Date().toISOString() });
}

/**
 * 今回だけの変更（ONE_TIME）
 *
 * ★保存はしていたが、**読む経路がどこにも無かった。**
 *   「今回だけ日曜に変えましょう」と合意しても、
 *   その回だけ変わったことが「これから」に出ていなかった。
 */
export async function listExceptions(
  caseId: CaseId,
): Promise<{ id: string; topic: string; change: Record<string, unknown>; createdAt: string }[]> {
  const snap = await caseRef(caseId)
    .collection("adjustments")
    .where("effect", "==", "ONE_TIME")
    .get();
  return snap.docs
    .map((d) => ({
      id: d.id,
      topic: (d.get("topic") ?? "") as string,
      change: (d.get("change") ?? {}) as Record<string, unknown>,
      createdAt: (d.get("createdAt") ?? "") as string,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * 調整（Adjustment）
 *
 * ★設計は kind=ADJUSTMENT の帰結を「Adjustment を作る」と決めていた。
 *   実装に行き先が無く、**養育費への提案になっていた。**
 *
 * ★双方の合意を要するが、公正証書には載らない。
 */
export async function appendAdjustment(
  caseId: CaseId,
  a: {
    threadId: string;
    scenarioId: string | null;
    topic: string;
    byPartyId: PartyId;
    change: Record<string, unknown>;
    effect: "ONE_TIME" | "PERMANENT" | null;
  },
): Promise<void> {
  await caseRef(caseId)
    .collection("adjustments")
    .add({ ...a, kind: "ADJUSTMENT", createdAt: new Date().toISOString() });
}

/** ★そのスレッドの調整だけ。作成順（最後が最新） */
export async function listAdjustmentsByThread(
  caseId: CaseId,
  threadId: string,
): Promise<{ byPartyId: string; change: Record<string, unknown>; createdAt: string }[]> {
  const snap = await caseRef(caseId)
    .collection("adjustments")
    .where("kind", "==", "ADJUSTMENT")
    .where("threadId", "==", threadId)
    .get();
  return snap.docs
    .map((d) => ({
      byPartyId: (d.get("byPartyId") ?? "") as string,
      change: (d.get("change") ?? {}) as Record<string, unknown>,
      createdAt: (d.get("createdAt") ?? "") as string,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * 軽い約束（L2）
 *
 * ★取り決めではない。**公正証書には載らない。**
 *   だが「8月22日でOKです」と了承したものが、どこにも残らないのはおかしい。
 *   「これから」にだけ載せる。
 */
export async function appendArrangement(
  caseId: CaseId,
  a: { threadId: string | null; date: string; label: string; byPartyId: PartyId },
): Promise<void> {
  await caseRef(caseId)
    .collection("arrangements")
    .add({ ...a, createdAt: new Date().toISOString() });
}

export async function listArrangements(
  caseId: CaseId,
): Promise<{ id: string; date: string; label: string }[]> {
  const snap = await caseRef(caseId).collection("arrangements").get();
  return snap.docs
    .map((d) => ({
      id: d.id,
      date: (d.get("date") ?? "") as string,
      label: (d.get("label") ?? "") as string,
    }))
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 合意項目の承諾状態 */
export async function setConsent(
  caseId: CaseId,
  topic: string,
  partyId: PartyId,
  status: "ACCEPTED" | "REJECTED",
): Promise<void> {
  await caseRef(caseId)
    .collection("agreementItems")
    .doc(topic)
    .set({ topic, consents: { [partyId]: status }, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function loadConsents(
  caseId: CaseId,
  topic: string,
): Promise<Record<string, "ACCEPTED" | "REJECTED">> {
  const d = await caseRef(caseId).collection("agreementItems").doc(topic).get();
  return (d.get("consents") ?? {}) as Record<string, "ACCEPTED" | "REJECTED">;
}

/** ★合意の確定。payloadSchemaId を必ず記録する（どの版のスキーマで合意したか） */
export async function finalizeAgreement(
  caseId: CaseId,
  topic: string,
  payload: Record<string, unknown>,
  payloadSchemaId: string,
  version = 1,
): Promise<void> {
  await caseRef(caseId)
    .collection("agreementItems")
    .doc(topic)
    .set(
      { status: "AGREED", payload, payloadSchemaId, version, agreedAt: new Date().toISOString() },
      { merge: true },
    );
}

/**
 * 現在の合意（版つき）
 *
 * ★変更申請中でも読める。**変更を申し出ただけでは、いまの取り決めは失効しない。**
 *   ここで null を返すと、K-6 の「いまの取り決め」を並べられない。
 */
export async function loadAgreementItem(
  caseId: CaseId,
  topic: string,
): Promise<{
  version: number;
  payload: Record<string, unknown>;
  status: string;
  agreedAt: string | null;
} | null> {
  const d = await caseRef(caseId).collection("agreementItems").doc(topic).get();
  const status = d.get("status");
  if (!d.exists || (status !== "AGREED" && status !== "REVISION_REQUESTED")) return null;
  return {
    version: (d.get("version") ?? 1) as number,
    payload: (d.get("payload") ?? {}) as Record<string, unknown>,
    status: status as string,
    agreedAt: (d.get("agreedAt") ?? null) as string | null,
  };
}

/** 当事者の年収帯。★これだけが越える（INV-2a） */
export async function loadIncomeBands(caseId: CaseId): Promise<Record<string, string | null>> {
  const snap = await caseRef(caseId).collection("parties").get();
  return Object.fromEntries(snap.docs.map((d) => [d.id, (d.get("incomeBand") ?? null) as string | null]));
}

/**
 * 合意項目の一覧。★status と payload のみ
 *
 * ★同じ論点に複数の項目があると、文書に入る内容が不定になる。
 *   合意時刻の昇順で返し、後のものが採用されるようにする。
 *   （改訂を重ねた場合、最新の合意が文書になる）
 */
export async function listAgreementItems(
  caseId: CaseId,
): Promise<
  { topic: string; status: string; payload: Record<string, unknown> | null; agreedAt: string }[]
> {
  const snap = await caseRef(caseId).collection("agreementItems").get();
  return snap.docs
    .map((d) => ({
      topic: (d.get("topic") ?? d.id) as string,
      status: (d.get("status") ?? "PENDING") as string,
      payload: (d.get("payload") ?? null) as Record<string, unknown> | null,
      agreedAt: (d.get("agreedAt") ?? "") as string,
    }))
    // ★agreedAt を捨てない。合意の始期が分からないと、
    //   存在しなかった義務を「守られていない」と言ってしまう。
    .sort((a, b) => a.agreedAt.localeCompare(b.agreedAt));
}

/** 履行の申告。★自己申告であり、アプリは入金を観測しない */
export async function reportFulfillment(
  caseId: CaseId,
  key: string,
  partyId: PartyId,
  kind: "PAID" | "RECEIVED",
): Promise<void> {
  await caseRef(caseId)
    .collection("fulfillments")
    .doc(key)
    .set({ [kind === "PAID" ? "paidBy" : "receivedBy"]: partyId, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function loadFulfillments(
  caseId: CaseId,
): Promise<Record<string, { paidBy?: string; receivedBy?: string }>> {
  const snap = await caseRef(caseId).collection("fulfillments").get();
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as { paidBy?: string; receivedBy?: string }]));
}

/** ケースを作る。★冪等ではない。呼ぶたびに新しいケースになる */
export async function createCase(seed: {
  case: { id: string; status: string };
  parties: { id: string; role: string; state: string; displayNameForOther: string; incomeBand: string | null }[];
}): Promise<void> {
  const db = getDb();
  const root = db.collection("cases").doc(seed.case.id);
  const batch = db.batch();
  batch.set(root, { status: seed.case.status, createdAt: new Date().toISOString() });
  for (const p of seed.parties) {
    batch.set(root.collection("parties").doc(p.id), {
      role: p.role,
      state: p.state,
      displayNameForOther: p.displayNameForOther,
      incomeBand: p.incomeBand,
    });
  }
  await batch.commit();
}

/** 全ケースのID。★日次ジョブ用 */
export async function listCaseIds(): Promise<string[]> {
  const snap = await getDb().collection("cases").select().get();
  return snap.docs.map((d) => d.id);
}

/**
 * 調停案のキャッシュ
 *
 * ★同じ提案の組み合わせに対して、毎回 LARGE を呼び直さない。
 *   画面を開くたびに再生成しており、実測で CT-1 が想定の4倍になっていた。
 *   説明文が毎回変わることも、当事者から見れば不安の材料になる。
 */
export async function loadMediationDraft(
  caseId: CaseId,
  key: string,
): Promise<Record<string, unknown> | null> {
  const d = await caseRef(caseId).collection("mediationDrafts").doc(key).get();
  return d.exists ? (d.data() as Record<string, unknown>) : null;
}

export async function saveMediationDraft(
  caseId: CaseId,
  key: string,
  draft: Record<string, unknown>,
): Promise<void> {
  await caseRef(caseId).collection("mediationDrafts").doc(key).set(draft);
}

import type { SafetyEvent } from "@/domain/safety/detect";

/**
 * ★安全に関する記録
 *
 *   ケース配下に置かない。`/safetyEvents` を独立させる。
 *   **原文を含むため、ケースの読み取り経路（loadForLlm）から
 *   構造的に外す。**パスの設計そのものが防御である。
 */
export async function appendSafetyEvent(e: SafetyEvent): Promise<void> {
  await getDb().collection("safetyEvents").add(e);
}

/** ★本人に検知があったか。★フラグの内容は返さない */
export async function hasPendingSafetyEvent(partyId: PartyId): Promise<boolean> {
  const snap = await getDb()
    .collection("safetyEvents")
    .where("partyId", "==", partyId)
    .where("status", "==", "PENDING_REVIEW")
    .limit(1)
    .get();
  return !snap.empty;
}

/** ★運営が読む。当事者には決して返さない */
export async function listPendingSafetyEvents(limit = 50): Promise<SafetyEvent[]> {
  const snap = await getDb()
    .collection("safetyEvents")
    .where("status", "==", "PENDING_REVIEW")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as SafetyEvent);
}

import type { PartyRef } from "@/domain/session/authLink";

/** ★全ケースから識別子で引く。ケースIDを知らなくても復帰できるようにする */
export async function findPartiesByAuthUid(uid: string): Promise<PartyRef[]> {
  const snap = await getDb().collectionGroup("parties").where("authUid", "==", uid).get();
  return snap.docs.map((d) => ({
    id: d.id,
    caseId: d.ref.parent.parent?.id ?? "",
    authUid: (d.get("authUid") ?? null) as string | null,
    state: (d.get("state") ?? "ACTIVE") as string,
  }));
}

/** 当事者に識別子を結びつける */
export async function linkAuthUid(caseId: CaseId, partyId: PartyId, uid: string): Promise<void> {
  await caseRef(caseId).collection("parties").doc(partyId).set({ authUid: uid }, { merge: true });
}

export async function loadPartyAuthUid(caseId: CaseId, partyId: PartyId): Promise<string | null> {
  const d = await caseRef(caseId).collection("parties").doc(partyId).get();
  return (d.get("authUid") ?? null) as string | null;
}

/**
 * ★確認用のケースかどうか
 *
 *   継続リンクは、この印が付いたケースにしか効かない。
 *   印を付けられるのは運営トークンを持つ人だけである（→ /api/demo-session）。
 *   **実在の当事者が入っているケースに、リンクで入れるようにしない。**
 */
export async function isDemoCase(caseId: CaseId): Promise<boolean> {
  const d = await caseRef(caseId).get();
  return d.get("demo") === true;
}

export async function markDemoCase(caseId: CaseId): Promise<void> {
  await caseRef(caseId).set({ demo: true }, { merge: true });
}

/** 子の登録。★算定表は人数と年齢で表を選ぶ。これが無いと目安が出せない */
export async function saveChildren(
  caseId: CaseId,
  children: { birthDate: string; name?: string }[],
): Promise<void> {
  const db = getDb();
  const col = caseRef(caseId).collection("children");
  const existing = await col.get();
  const batch = db.batch();
  existing.docs.forEach((d) => batch.delete(d.ref));
  children.forEach((c, i) =>
    // ★名前は任意。入れなくても算定表は引ける
    batch.set(col.doc(`child_${i + 1}`), { birthDate: c.birthDate, name: c.name ?? null }),
  );
  await batch.commit();
}

/**
 * 生まれ年月だけを読む。
 *
 * ★名前は返さない。**名前は共有しない情報である。**
 *   受諾した側に相手の付けた呼び名を見せると、そこから越えてしまう。
 *   算定表に要るのは年齢と人数だけなので、返さなくても困らない。
 */
export async function loadChildBirthDates(caseId: CaseId): Promise<string[]> {
  const snap = await caseRef(caseId).collection("children").get();
  return snap.docs
    .map((d) => d.get("birthDate") as string)
    .filter(Boolean)
    .sort();
}

/**
 * 画面の設定
 *
 * ★「お相手の呼び方」は**見ている本人の画面だけのもの。**
 *   自分の当事者レコードに置き、相手には渡さない。
 *   `displayNameForOther`（相手に見える自分の名）とは向きが逆であり、
 *   混同すると、落ち着くために付けた呼び名が相手に届く。
 *
 * ★通知に本文を出すかは既定 OFF。DV・つきまといの文脈がある。
 */
export async function saveViewerSettings(
  caseId: CaseId,
  partyId: PartyId,
  s: { partnerAlias?: string | null; notifyBody?: boolean },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (s.partnerAlias !== undefined) patch.partnerAlias = s.partnerAlias || null;
  if (s.notifyBody !== undefined) patch.notifyBody = s.notifyBody;
  if (Object.keys(patch).length === 0) return;
  await caseRef(caseId).collection("parties").doc(partyId).set(patch, { merge: true });
}

export async function loadViewerSettings(
  caseId: CaseId,
  partyId: PartyId,
): Promise<{ partnerAlias: string | null; notifyBody: boolean }> {
  const d = await caseRef(caseId).collection("parties").doc(partyId).get();
  return {
    partnerAlias: (d.get("partnerAlias") ?? null) as string | null,
    // ★既定 OFF。読めなかったときも OFF に倒す
    notifyBody: d.get("notifyBody") === true,
  };
}

/** ケースの状況。★入口の分岐を記録する */
export async function saveSituation(caseId: CaseId, situation: string): Promise<void> {
  await caseRef(caseId).set({ situation }, { merge: true });
}

export async function loadSituation(caseId: CaseId): Promise<string | null> {
  const d = await caseRef(caseId).get();
  return (d.get("situation") ?? null) as string | null;
}

/**
 * 同居の状況と、そこから決まる役割。
 *
 * ★役割が決まらないとき（お子さんによって違う／あとで答える）は、
 *   **当てずっぽうで書き換えない。** 同居の記録だけを残す。
 */
export async function saveLiving(
  caseId: CaseId,
  input: { living: string; ownPartyId: string; role: Party | null },
): Promise<void> {
  const root = caseRef(caseId);
  const batch = getDb().batch();
  batch.set(root, { living: input.living, roleConfirmed: input.role !== null }, { merge: true });

  if (input.role) {
    const other: Party = input.role === "CUSTODIAL" ? "NON_CUSTODIAL" : "CUSTODIAL";
    const parties = await root.collection("parties").get();
    for (const p of parties.docs) {
      batch.set(p.ref, { role: p.id === input.ownPartyId ? input.role : other }, { merge: true });
    }
  }
  await batch.commit();
}

export async function loadLiving(caseId: CaseId): Promise<string | null> {
  const d = await caseRef(caseId).get();
  return (d.get("living") ?? null) as string | null;
}

/**
 * おふたりで決めたこと（House Rule）
 *
 * ★公正証書には載らない。条項にもならない。
 *   当事者が自分で決め、自分で直す。**片方だけでは決まらない。**
 *
 * ★`adjustments` と分けている。あちらは相談の帰結（スレッドに紐づく）で、
 *   こちらは**スレッドに属さない、ずっと続くもの**である。
 */
export async function appendRule(
  caseId: CaseId,
  r: { kind: string; byPartyId: PartyId; value: Record<string, unknown> },
): Promise<void> {
  await caseRef(caseId)
    .collection("rules")
    .add({ ...r, createdAt: new Date().toISOString() });
}

/** ★作成順（最後が最新）。当事者ごとの最新だけを見る側で判定する */
export async function listRules(
  caseId: CaseId,
): Promise<{ kind: string; byPartyId: string; value: Record<string, unknown>; createdAt: string }[]> {
  const snap = await caseRef(caseId).collection("rules").get();
  return snap.docs
    .map((d) => ({
      kind: (d.get("kind") ?? "") as string,
      byPartyId: (d.get("byPartyId") ?? "") as string,
      value: (d.get("value") ?? {}) as Record<string, unknown>,
      createdAt: (d.get("createdAt") ?? "") as string,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * ★ご自身の下書きを消す。
 *
 *   消せるのは**渡していない自分の仮案だけ。**
 *
 *   ・お渡ししたもの      … 消さない。相手が見ている
 *   ・合意済みのもの      … 消さない。**双方が合意したものを、片方が消せてはいけない**
 *                          （変えるときは K-6 の変更の申し出を通る）
 *   ・お相手の仮案        … 触れない
 */
export async function discardOwnDrafts(
  caseId: CaseId,
  partyId: PartyId,
): Promise<number> {
  const snap = await caseRef(caseId)
    .collection("proposals")
    .where("byPartyId", "==", partyId)
    .get();

  const targets = snap.docs.filter(
    (d) => (d.get("sharedAt") ?? null) === null && (d.get("withdrawnAt") ?? null) === null,
  );
  if (targets.length === 0) return 0;

  const batch = getDb().batch();
  for (const d of targets) batch.delete(d.ref);
  await batch.commit();
  return targets.length;
}

/**
 * ケース全体の調整（相談の帰結）
 *
 * ★`kind == "ADJUSTMENT"` だけ。**お知らせ（NOTIFICATION）は控えを作らない。**
 * ★スレッドごとに揃ったかを判定するため、`threadId` を返す。
 */
export async function listAdjustments(
  caseId: CaseId,
): Promise<
  {
    id: string;
    threadId: string | null;
    topic: string;
    byPartyId: string;
    change: Record<string, unknown>;
    effect: "ONE_TIME" | "PERMANENT" | null;
    createdAt: string;
  }[]
> {
  const snap = await caseRef(caseId).collection("adjustments").where("kind", "==", "ADJUSTMENT").get();
  return snap.docs
    .map((d) => ({
      id: d.id,
      threadId: (d.get("threadId") ?? null) as string | null,
      topic: (d.get("topic") ?? "OTHER") as string,
      byPartyId: (d.get("byPartyId") ?? "") as string,
      change: (d.get("change") ?? {}) as Record<string, unknown>,
      effect: (d.get("effect") ?? null) as "ONE_TIME" | "PERMANENT" | null,
      createdAt: (d.get("createdAt") ?? "") as string,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
