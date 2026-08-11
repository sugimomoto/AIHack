/**
 * 合意の成立
 *
 * ★片方の承諾では確定しない。
 *   合意とは双方の意思の一致である。
 */

export type ConsentStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type Consents = { a: ConsentStatus; b: ConsentStatus };

export type ConsentState = "WAITING_BOTH" | "WAITING_OTHER" | "AGREED" | "REJECTED";

export function canFinalize(c: Consents): boolean {
  return c.a === "ACCEPTED" && c.b === "ACCEPTED";
}

export function consentStateOf(c: Consents): ConsentState {
  if (c.a === "REJECTED" || c.b === "REJECTED") return "REJECTED";
  if (canFinalize(c)) return "AGREED";
  if (c.a === "ACCEPTED" || c.b === "ACCEPTED") return "WAITING_OTHER";
  return "WAITING_BOTH";
}
