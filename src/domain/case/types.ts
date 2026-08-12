/**
 * ケースと当事者の型
 *
 * ★越境できるデータを型で閉じる（→ docs/functional-design.md §4.10 INV-3）
 */

export type Party = "CUSTODIAL" | "NON_CUSTODIAL";

export type PartyId = string & { readonly __brand: "PartyId" };
export type CaseId = string & { readonly __brand: "CaseId" };
export type ConsultationId = string & { readonly __brand: "ConsultationId" };
export type ProposalId = string & { readonly __brand: "ProposalId" };
export type AgreementItemId = string & { readonly __brand: "AgreementItemId" };

export const asPartyId = (v: string) => v as PartyId;
export const asCaseId = (v: string) => v as CaseId;
export const asConsultationId = (v: string) => v as ConsultationId;
export const asProposalId = (v: string) => v as ProposalId;
export const asAgreementItemId = (v: string) => v as AgreementItemId;

// ---------------------------------------------------------------------------
// 当事者
// ---------------------------------------------------------------------------

export type PartyRecord = {
  id: PartyId;
  caseId: CaseId;
  authUid: string;
  role: Party;
  /** 相手が付けた表示名。実名は出さない（U-1） */
  displayNameForOther: string;
  /** ★算定表の帯。これだけが越える（INV-2a） */
  incomeBand: string | null;
  state: "PREPARING" | "ACTIVE" | "WITHDRAWN";
};

/**
 * ★非開示情報（SELF_ONLY）
 *
 * ケース配下に置かない。`/contactInfo/{partyId}` を独立したルートコレクションとする。
 * パスの設計そのものが FR-09 の実装である（→ docs/architecture.md §3.2）。
 *
 * ★この型は、いかなるLLMコンテキストにも含めてはならない（INV-2）。
 */
export type ContactInfo = {
  partyId: PartyId;
  address: string | null;
  phone: string | null;
  employer: string | null;
  /** ★精密な年収。越えるのは incomeBand のみ（INV-2a） */
  annualIncome: number | null;
};

// ---------------------------------------------------------------------------
// 対話
// ---------------------------------------------------------------------------

/**
 * ★メッセージ（常に PRIVATE）
 *
 * 書いた本人にしか見えない。
 * この型が他方のコンテキストに入る経路を作ってはならない（INV-1）。
 */
export type MessageRecord = {
  id: string;
  consultationId: ConsultationId;
  /** この当事者のみ閲覧可 */
  partyId: PartyId;
  role: "USER" | "AI";
  /** 原文。FR-10 で保全する */
  content: string;
  /**
   * ★取次がれたか。undefined は記録が無い（過去の発言）。
   *   届いたかどうかが画面から分からないと、
   *   「取り次いでくれたのか」を当事者が判断できない。
   */
  relayed?: boolean;
  createdAt: string;
};

export type ConsultationRecord = {
  id: ConsultationId;
  caseId: CaseId;
  scenarioId: string | null;
  initiatedByPartyId: PartyId;
  status: "OPEN" | "RESOLVED" | "ESCALATED";
};

// ---------------------------------------------------------------------------
// ★ 越境できるデータ（INV-3）
// ---------------------------------------------------------------------------

/**
 * 当事者間を越えてよいデータ。**これ以外は越えない。**
 *
 * @see docs/functional-design.md §4.10 INV-3
 */
export type CrossableData =
  | { kind: "agreement"; topic: string; payload: unknown; version: number }
  | { kind: "proposal"; payload: unknown; context?: string; rationale?: string }
  | { kind: "mediation"; content: string }
  | { kind: "notification"; content: string };

export const CROSSABLE_KINDS = [
  "agreement",
  "proposal",
  "mediation",
  "notification",
] as const;
