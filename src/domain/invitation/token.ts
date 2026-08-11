import { createHash, randomBytes } from "node:crypto";

/**
 * 招待トークン
 *
 * ★推測可能なトークンは、第三者にケースを開かせる。
 *   ケースには非開示情報こそ含まれないが、
 *   当事者であるという事実自体が機微な情報である。
 */

const BYTES = 32;

/** URL に安全な乱数トークンを生成する */
export function generateInvitationToken(): string {
  return randomBytes(BYTES).toString("base64url");
}

/** 形式として妥当か（推測されやすい短い値を弾く） */
export function isWellFormedToken(token: string): boolean {
  return token.length >= 32 && /^[A-Za-z0-9_-]+$/.test(token);
}

/** 既定の有効期限（7日） */
export const INVITATION_TTL_DAYS = 7;

export function expiresAt(now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() + INVITATION_TTL_DAYS);
  return d.toISOString();
}

/**
 * トークンのハッシュ
 *
 * ★平文を保存しない。
 *   招待文書が漏れても、そこから有効なリンクを復元できない。
 *   照会はハッシュ同士の比較で行う（→ invitationRepository.findByToken）。
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
