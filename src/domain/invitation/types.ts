import type { InvitationStatus } from "./stateMachine";

/** 招待の方式 */
export const INVITATION_METHODS = ["LINK", "EMAIL"] as const;
export type InvitationMethod = (typeof INVITATION_METHODS)[number];

/**
 * 招待の永続表現。
 *
 * ★`token` は保存するが、公開ビューへは決して出さない（→ publicView.ts）。
 */
export type InvitationRecord = {
  id: string;
  caseId: string;
  createdByPartyId: string;
  token: string;
  method: InvitationMethod;
  /** EMAIL 方式のときのみ。LINK 方式ではアプリが相手に接触しない（AC-06） */
  recipientEmail?: string;
  senderName: string;
  revealSenderName: boolean;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
  acceptedByPartyId?: string;
};
