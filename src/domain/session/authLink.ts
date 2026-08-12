/**
 * Firebase の識別子と当事者の結びつけ
 *
 * ★Firebase Authentication は「この人が誰か」を確かめるだけである。
 *   **どの当事者か**は、こちらで決める。
 *   ここを誤ると、他人のケースに入れる。
 *
 * ★パスワードは保持しない（メールリンク方式）。
 *   このアプリは住所・年収・子の情報を持つ。
 *   漏れて困るものを、そもそも預からない。
 */

export type LinkVerdict = { ok: true } | { ok: false; reason: "ALREADY_LINKED" | "EMPTY_UID" };

/**
 * ★既に別の識別子が紐づいていたら、付け替えない。
 *   付け替えを許すと、識別子を奪われた時点でケースごと奪われる。
 */
export function canLinkAuthUid(input: { partyAuthUid: string | null; uid: string }): LinkVerdict {
  if (!input.uid) return { ok: false, reason: "EMPTY_UID" };
  if (input.partyAuthUid && input.partyAuthUid !== input.uid) {
    return { ok: false, reason: "ALREADY_LINKED" };
  }
  return { ok: true };
}

export type PartyRef = { id: string; caseId: string; authUid: string | null; state: string };

/**
 * 識別子から当事者を引く。
 *
 * ★未登録なら返さない。勝手にケースを作らない。
 * ★複数に紐づいていたら返さない。曖昧な状態で入れない。
 */
export function resolvePartyForUid(
  parties: readonly PartyRef[],
  uid: string,
): { partyId: string; caseId: string } | null {
  if (!uid) return null;
  const hit = parties.filter((p) => p.authUid === uid && p.state !== "WITHDRAWN");
  if (hit.length !== 1) return null;
  return { partyId: hit[0].id, caseId: hit[0].caseId };
}
