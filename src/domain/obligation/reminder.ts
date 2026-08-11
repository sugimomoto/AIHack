import type { Obligation } from "./schedule";

/**
 * リマインダー
 *
 * ★自分にだけ。相手には送らない。
 *   相手に送ると**催促**になる（U-5 急かさない）。
 *   予定を思い出すのは、義務を負う本人の仕事である。
 *
 * ★招待に再送APIを作らなかったのと同じ判断である。
 *   作れてしまうと、いずれ使われる。
 */

/** 何日前から出すか */
export const LEAD_DAYS = 5;

/**
 * 見る人に出すリマインダー。
 *
 * ★第2引数は「見る人」であって「送る先」ではない。
 *   誰かに送る、という形にしない。
 *
 * ★期日を過ぎたものは出さない。
 *   過ぎた分を並べると、それは催促になる。
 *   期日後の扱いは逸脱検知（S9）が担う。
 */
export function remindersFor(
  obligations: readonly Obligation[],
  viewer: { partyId: string; today: string },
): Obligation[] {
  const today = Date.parse(viewer.today);
  const limit = today + LEAD_DAYS * 86_400_000;

  return obligations.filter((o) => {
    if (o.obligorPartyId !== viewer.partyId) return false; // ★義務を負う本人にだけ
    const due = Date.parse(o.dueDate);
    return due >= today && due <= limit;
  });
}
