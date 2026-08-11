import type { PartyId } from "@/domain/case/types";
import { asPartyId } from "@/domain/case/types";

/**
 * 当事者の解決
 *
 * ★本番では認証のみ（→ lib/auth.ts）。
 *
 * 開発用の切替は、**二重の条件を満たしたときだけ**効く。
 *
 *   1. NODE_ENV が production でない
 *   2. ALLOW_DEV_PARTY_SWITCH が正確に "true"
 *
 * どちらか一方でも欠ければ効かない。
 * **本番で通ると、誰でも他人の当事者になれる。C1 が無意味になる。**
 *
 * ★"1" や "yes" を通さないのは、意図しない有効化を防ぐため。
 *   曖昧な真値を受け入れると、設定ミスで開いてしまう。
 */
export function isDevPartySwitchEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.ALLOW_DEV_PARTY_SWITCH === "true";
}

export function resolveDevParty(raw: string | null | undefined): PartyId | null {
  if (!isDevPartySwitchEnabled()) return null;
  if (!raw) return null;
  return asPartyId(raw);
}
