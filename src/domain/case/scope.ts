import type { CaseSnapshot } from "@/domain/context/snapshot";
import type { ConsultationId, MessageRecord, PartyId } from "./types";

/**
 * ★API層のスコープ規約（A-1〜A-6）
 *
 * すべての読み取りは呼び出し元の partyId でスコープされる。
 * 他者のIDを指定しても他者のデータは返らない。
 *
 * Admin SDK は Firestore のセキュリティルールをバイパスするため、
 * **アクセス制御の責任はここにある。**
 *
 * @see docs/functional-design.md §7.6
 */

export class ScopeViolationError extends Error {
  constructor(readonly partyId: PartyId) {
    // ★エラー文言に内部の詳細を出さない（G-F）
    super("このデータにアクセスする権限がありません");
    this.name = "ScopeViolationError";
  }
}

/**
 * 呼び出し元がこのケースの当事者であることを確認する。
 *
 * ★退会済みも拒否する。
 */
export function assertOwnParty(snap: CaseSnapshot, partyId: PartyId): void {
  const p = snap.parties.find((x) => x.id === partyId);
  if (!p || p.state === "WITHDRAWN") throw new ScopeViolationError(partyId);
}

/**
 * A-2｜Message は呼び出し元自身のものしか返さない。
 *
 * ★相手のメッセージを取得する関数を作らない（G-A）。
 *   必要に見えたら設計が間違っている。
 */
export function scopedMessages(
  snap: CaseSnapshot,
  consultationId: ConsultationId,
  partyId: PartyId,
): MessageRecord[] {
  return snap.messages.filter(
    (m) => m.consultationId === consultationId && m.partyId === partyId,
  );
}

/** A-1｜取次ぎは宛先でスコープされる */
export function scopedInbound(
  snap: CaseSnapshot,
  partyId: PartyId,
  /** ★相談ごとに分ける。指定しなければ全件（一覧・件数用） */
  scenarioId?: string | null | undefined,
): { id: string; content: string; createdAt: string }[] {
  return snap.mediationEvents
    .filter((e) => e.toPartyId === partyId && matchesScenario(e, scenarioId))
    .map((e) => ({ id: e.id, content: e.content, createdAt: e.createdAt ?? "" }));
}

/**
 * ★取次ぎは、出てきた相談と同じ相談に並べる。
 *   絞らないと、**どの相談を開いても全部の取次ぎが出る。**
 *
 * ★相談を指定しない呼び出し（一覧）では全件を返す。
 */
function matchesScenario(
  e: { threadId?: string | null; scenarioId?: string | null },
  threadId: string | null | undefined,
): boolean {
  if (threadId === undefined) return true;
  // ★スレッドを持たない古い取次ぎは、シナリオから寄せる。
  //   そうしないと、過去の取次ぎが全部まとめて既定のスレッドに出る。
  const of = e.threadId ?? (e.scenarioId ? `th_${e.scenarioId}` : "th_default");
  return of === (threadId || "th_default");
}

/**
 * 自分が送った取次ぎ。
 *
 * ★「書いた言葉は届きません」だけを見せて、**何が届いたのかを見せていなかった。**
 *   否定の約束しか見えないと、AI を通すと何が起きるのか分からないままになる。
 *
 * ★これは相手の情報ではない。**自分の言葉が変換された結果**であり、
 *   本人に見せても越境にはならない。
 */
export function scopedOutbound(
  snap: CaseSnapshot,
  partyId: PartyId,
  scenarioId?: string | null | undefined,
): { id: string; content: string; createdAt: string }[] {
  return snap.mediationEvents
    .filter((e) => e.fromPartyId === partyId && matchesScenario(e, scenarioId))
    .map((e) => ({ id: e.id, content: e.content, createdAt: e.createdAt ?? "" }));
}

/**
 * 相手の当事者を返す。
 *
 * ★返すのは表示名と役割のみ。実名・非開示情報は含まない（U-1 / INV-2）。
 */
export function otherPartyView(
  snap: CaseSnapshot,
  partyId: PartyId,
): { displayName: string; role: string; hasJoined: boolean } | null {
  const other = snap.parties.find((p) => p.id !== partyId);
  if (!other) return null;
  return {
    displayName: other.displayNameForOther,
    role: other.role,
    hasJoined: other.state === "ACTIVE",
  };
}
