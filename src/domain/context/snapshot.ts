import type {
  AgreementItemId,
  CaseId,
  ConsultationId,
  ConsultationRecord,
  ContactInfo,
  MessageRecord,
  PartyId,
  PartyRecord,
  ProposalId,
} from "@/domain/case/types";

/**
 * ケースの読み取り結果
 *
 * リポジトリ層が組み立て、ContextBuilder はこれだけを入力とする。
 * ドメイン層を外部依存から独立させるため（→ docs/development-guidelines.md §2.4）。
 *
 * ★contactInfos は任意（二重の防御）
 *
 *   本番のLLM経路では **読み込まない**（リポジトリが取得しない）。
 *   一方、不変条件テストでは **意図的に混入させ、それでも漏れないこと** を検証する。
 *
 *   - 読み込まない  … 漏れる材料がそもそも無い
 *   - 漏らさない    … 材料があっても出さない（INV-2 が検証）
 *
 *   片方が破れても、もう片方が残る。
 */
export type CaseSnapshot = {
  caseId: CaseId;
  parties: PartyRecord[];
  /** ★本番のLLM経路では設定しない。テストでのみ混入させる（上記参照） */
  contactInfos?: ContactInfo[];
  children: { id: string; birthDate: string }[];
  consultations: ConsultationRecord[];
  messages: MessageRecord[];
  agreementItems: {
    id: AgreementItemId;
    topic: string;
    status: string;
    payload: unknown;
    version: number;
  }[];
  proposals: {
    id: ProposalId;
    agreementItemId: AgreementItemId;
    proposedByPartyId: PartyId | null;
    payload: unknown;
    context?: string;
    rationale?: string;
    status: string;
  }[];
  mediationEvents: {
    id: string;
    fromPartyId?: PartyId;
    toPartyId: PartyId;
    content: string;
    scenarioId?: string | null;
    createdAt?: string;
  }[];
  notifications?: { id: string; toPartyId: PartyId; content: string }[];
};

export type { ConsultationId };
