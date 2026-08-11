/**
 * 招待の状態遷移
 *
 * ★受諾・辞退・期限切れはいずれも終端。
 *   一度確定した意思表示を、アプリ側で覆さない。
 */

export const INVITATION_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const INVITATION_EVENTS = ["ACCEPT", "DECLINE", "EXPIRE"] as const;
export type InvitationEvent = (typeof INVITATION_EVENTS)[number];

const TRANSITIONS: Record<
  InvitationStatus,
  Partial<Record<InvitationEvent, InvitationStatus>>
> = {
  PENDING: { ACCEPT: "ACCEPTED", DECLINE: "DECLINED", EXPIRE: "EXPIRED" },
  // 以下は終端
  ACCEPTED: {},
  DECLINED: {},
  EXPIRED: {},
};

export class InvalidInvitationTransitionError extends Error {
  constructor(from: InvitationStatus, event: InvitationEvent) {
    super(`不正な状態遷移です: ${from} --${event}-->`);
    this.name = "InvalidInvitationTransitionError";
  }
}

export function canTransition(from: InvitationStatus, event: InvitationEvent): boolean {
  return TRANSITIONS[from][event] !== undefined;
}

export function transition(from: InvitationStatus, event: InvitationEvent): InvitationStatus {
  const next = TRANSITIONS[from][event];
  if (next === undefined) throw new InvalidInvitationTransitionError(from, event);
  return next;
}

/** まだ結果が確定していない状態か */
export function isOpen(s: InvitationStatus): boolean {
  return s === "PENDING";
}
