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
