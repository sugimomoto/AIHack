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
 * ★ここには非開示情報も含まれる。ContextBuilder が「渡さない」ことで守る。
 */
export type CaseSnapshot = {
  caseId: CaseId;
  parties: PartyRecord[];
  contactInfos: ContactInfo[];
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
  mediationEvents: { id: string; toPartyId: PartyId; content: string }[];
  notifications?: { id: string; toPartyId: PartyId; content: string }[];
};

export type { ConsultationId };
