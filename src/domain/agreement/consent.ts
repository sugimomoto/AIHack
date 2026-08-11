/**
 * 合意の成立
 *
 * ★片方の承諾では確定しない。合意とは双方の意思の一致である。
 *
 * ★そして「双方が承諾した」だけでも足りない。
 *   **何に承諾したのかが定まっていなければ、承諾は意味を持たない。**
 *
 *   実機で欠陥を検出した：
 *     Aの提案 3万円 ／ Bの提案 4万円 で双方が承諾
 *     → 誰も合意していない 3万円が確定した
 *
 *   P3 により、AIが中間の金額を決めることもできない。
 *   **一致は当事者が作るしかない。**
 */

export type ConsentStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type Consents = { a: ConsentStatus; b: ConsentStatus };

export type ConsentState =
  | "WAITING_BOTH"
  | "WAITING_OTHER"
  | "NEEDS_CONVERGENCE"
  | "AGREED"
  | "REJECTED";

type Payload = Record<string, unknown> | null | undefined;

/** 双方の承諾があるか。★これだけでは確定できない */
export function canFinalize(c: Consents): boolean {
  return c.a === "ACCEPTED" && c.b === "ACCEPTED";
}

/**
 * 提案が一致しているか。
 *
 * ★項目が欠けていても一致とみなさない。
 *   「支払日は決めていない」状態を合意にすると、後で解釈が割れる。
 */
export function payloadsAgree(payloads: readonly Payload[]): boolean {
  if (payloads.length < 2) return false;
  if (payloads.some((p) => p === null || p === undefined)) return false;

  const norm = (p: Record<string, unknown>) =>
    JSON.stringify(Object.fromEntries(Object.entries(p).sort(([x], [y]) => x.localeCompare(y))));

  const first = norm(payloads[0] as Record<string, unknown>);
  return payloads.every((p) => norm(p as Record<string, unknown>) === first);
}

/** ★確定できるのは、双方が承諾し、かつ提案が一致しているときだけ */
export function canFinalizeAgreement(c: Consents, payloads: readonly Payload[]): boolean {
  return canFinalize(c) && payloadsAgree(payloads);
}

export function consentStateOf(c: Consents, payloads?: readonly Payload[]): ConsentState {
  if (c.a === "REJECTED" || c.b === "REJECTED") return "REJECTED";

  if (canFinalize(c)) {
    // ★提案が渡されない呼び出しでは、承諾の有無だけを見る
    if (payloads === undefined) return "AGREED";
    return payloadsAgree(payloads) ? "AGREED" : "NEEDS_CONVERGENCE";
  }

  if (c.a === "ACCEPTED" || c.b === "ACCEPTED") return "WAITING_OTHER";
  return "WAITING_BOTH";
}
