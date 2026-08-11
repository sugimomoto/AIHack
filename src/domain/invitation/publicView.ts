import type { InvitationRecord } from "./types";

/**
 * 招待の公開ビュー
 *
 * ★A-6｜このAPIは未認証で呼ばれる。
 *   トークンさえ知っていれば誰でも叩けるため、返す情報を最小化する。
 *
 * 返さないもの：
 *   caseId / partyId / token / 宛先メールアドレス
 *   ★revealSenderName が false のときの送信者名
 *
 * ★状態を3値に丸めるのも意図的である。
 *   DECLINED をそのまま返すと、辞退したことが招待した側に伝わる。
 *   「使えないリンク」という以上の情報を渡さない。
 */

export type InvitationPublicState = "OPEN" | "EXPIRED" | "USED";

export type InvitationPublicView = {
  state: InvitationPublicState;
  /** revealSenderName が true のときのみ */
  senderName?: string;
};

export function toPublicView(inv: InvitationRecord, now: Date): InvitationPublicView {
  const view: InvitationPublicView = { state: resolveState(inv, now) };
  if (inv.revealSenderName) view.senderName = inv.senderName;
  return view;
}

function resolveState(inv: InvitationRecord, now: Date): InvitationPublicState {
  if (inv.status !== "PENDING") {
    // ★ACCEPTED も DECLINED も EXPIRED も「使えない」に丸める
    return inv.status === "EXPIRED" ? "EXPIRED" : "USED";
  }
  // ★保存された status が PENDING でも、期限を過ぎていれば期限切れとして扱う。
  //   期限切れの書き戻しを待たない。
  return new Date(inv.expiresAt).getTime() <= now.getTime() ? "EXPIRED" : "OPEN";
}
