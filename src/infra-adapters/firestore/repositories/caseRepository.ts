import type {
  AgreementItemId,
  CaseId,
  ConsultationId,
  ContactInfo,
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
      toPartyId: asPartyId(d.get("toPartyId")),
      content: d.get("content"),
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

/** 相談が無ければ作る。★当事者ごとに1つ（セッションが分かれている） */
export async function ensureConsultation(
  caseId: CaseId,
  consultationId: ConsultationId,
  partyId: PartyId,
): Promise<void> {
  await caseRef(caseId)
    .collection("consultations")
    .doc(consultationId)
    .set({ partyId, updatedAt: new Date().toISOString() }, { merge: true });
}

/**
 * ★取次ぎ。`toPartyId` が宛先である。
 *   これが `scopedInbound` の拠り所になる。
 */
export async function appendMediationEvent(
  caseId: CaseId,
  e: { fromPartyId: PartyId; toPartyId: PartyId; content: string; proposalId?: string },
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
  },
): Promise<string> {
  const ref = await caseRef(caseId)
    .collection("proposals")
    .add({ ...p, effect: p.effect ?? null, createdAt: new Date().toISOString() });

  // ★新しい提案が出たら、承諾をやり直す。
  //   前回の ACCEPTED が残っていると、片側1クリックで別の内容が確定する
  //   （レビューで検出）。
  await caseRef(caseId)
    .collection("agreementItems")
    .doc(p.topic)
    .set({ topic: p.topic, consents: {}, updatedAt: new Date().toISOString() }, { merge: true });

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
      createdAt: (d.get("createdAt") ?? "") as string,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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

/** 現在の合意（版つき） */
export async function loadAgreementItem(
  caseId: CaseId,
  topic: string,
): Promise<{ version: number; payload: Record<string, unknown> } | null> {
  const d = await caseRef(caseId).collection("agreementItems").doc(topic).get();
  if (!d.exists || d.get("status") !== "AGREED") return null;
  return { version: (d.get("version") ?? 1) as number, payload: (d.get("payload") ?? {}) as Record<string, unknown> };
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

/** ケースの状況。★入口の分岐を記録する */
export async function saveSituation(caseId: CaseId, situation: string): Promise<void> {
  await caseRef(caseId).set({ situation }, { merge: true });
}

export async function loadSituation(caseId: CaseId): Promise<string | null> {
  const d = await caseRef(caseId).get();
  return (d.get("situation") ?? null) as string | null;
}
