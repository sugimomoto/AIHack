/**
 * 合意の状態機械
 *
 * ★状態変更は必ずこのモジュールを経由する。
 *   個々の画面や API で status を直接書き換えない。
 *   合意は法的文書の基礎であり、不正な遷移を許すと整合が壊れる。
 *
 * @see docs/functional-design.md §4.8
 * @see docs/development-guidelines.md §2.2
 */

export const AGREEMENT_STATUSES = [
  "NOT_STARTED",
  "IN_NEGOTIATION",
  "AGREED",
  "REVISION_REQUESTED",
  "DEVIATED",
  "ESCALATED",
] as const;

export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

export const STATUS_LABEL: Record<AgreementStatus, string> = {
  NOT_STARTED: "未着手",
  IN_NEGOTIATION: "係争中",
  AGREED: "合意済",
  REVISION_REQUESTED: "変更申請中",
  DEVIATED: "逸脱",
  ESCALATED: "調停へ",
};

export const AGREEMENT_EVENTS = [
  "PROPOSE",
  "COUNTER",
  "ACCEPT",
  "ESCALATE",
  "REQUEST_REVISION",
  "AGREE_REVISION",
  "REVISION_FAILED",
  "DETECT_DEVIATION",
  "RECOVER",
] as const;

export type AgreementEvent = (typeof AGREEMENT_EVENTS)[number];

/**
 * 遷移表
 *
 * ここに無い組み合わせは、すべて不正な遷移である。
 */
const TRANSITIONS: Record<AgreementStatus, Partial<Record<AgreementEvent, AgreementStatus>>> = {
  NOT_STARTED: {
    PROPOSE: "IN_NEGOTIATION",
  },
  IN_NEGOTIATION: {
    COUNTER: "IN_NEGOTIATION",
    ACCEPT: "AGREED",
    ESCALATE: "ESCALATED",
  },
  AGREED: {
    REQUEST_REVISION: "REVISION_REQUESTED",
    DETECT_DEVIATION: "DEVIATED",
  },
  REVISION_REQUESTED: {
    AGREE_REVISION: "AGREED",
    REVISION_FAILED: "IN_NEGOTIATION",
  },
  DEVIATED: {
    RECOVER: "AGREED",
  },
  // 終端。調停・専門家へ引き継いだ後はアプリ内で状態を戻さない
  ESCALATED: {},
};

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: AgreementStatus,
    readonly event: AgreementEvent,
  ) {
    super(`不正な状態遷移です: ${from} --${event}-->`);
    this.name = "InvalidTransitionError";
  }
}

/** 遷移可能か */
export function canTransition(from: AgreementStatus, event: AgreementEvent): boolean {
  return TRANSITIONS[from][event] !== undefined;
}

/** 遷移する。不正な場合は例外を投げる */
export function transition(from: AgreementStatus, event: AgreementEvent): AgreementStatus {
  const next = TRANSITIONS[from][event];
  if (next === undefined) throw new InvalidTransitionError(from, event);
  return next;
}

/** その状態から可能なイベント一覧 */
export function allowedEvents(from: AgreementStatus): AgreementEvent[] {
  return Object.keys(TRANSITIONS[from]) as AgreementEvent[];
}

/** 終端状態か */
export function isTerminal(s: AgreementStatus): boolean {
  return allowedEvents(s).length === 0;
}

/** 公正証書の原案に載る状態か */
export function isDocumentable(s: AgreementStatus): boolean {
  return s === "AGREED" || s === "DEVIATED";
}
