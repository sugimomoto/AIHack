import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * セッション
 *
 * ★パスワードを一切保持しない。
 *   このアプリは住所・年収・子の情報を持つ。
 *   **漏れて困るものを、そもそも預からない。**
 *
 * ★セッションが偽造できれば、誰でも他人の当事者になれる。
 *   S19 で開発用切替を厳しくしたのと同じ理由である。
 *
 * @see .steering/20260811-s20-session/requirements.md
 */

/** ★名前から用途が推測されないようにする */
export const SESSION_COOKIE = "aida_s";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionPayload = { partyId: string; caseId: string };
type Stored = SessionPayload & { exp: number };

/**
 * ★鍵が無ければ署名しない。既定値を持たせない。
 *   既定値は、いつか本番で使われる。
 */
export function signSession(p: SessionPayload, opts: { key: string; now: number }): string {
  if (!opts.key) throw new Error("SESSION_SECRET が設定されていません");

  // ★入れるのは partyId・caseId・期限のみ。名前や連絡先を入れない
  const stored: Stored = { partyId: p.partyId, caseId: p.caseId, exp: opts.now + SESSION_TTL_MS };
  const body = Buffer.from(JSON.stringify(stored)).toString("base64url");
  return `${body}.${sign(body, opts.key)}`;
}

export function verifySession(
  token: string,
  opts: { key: string; now: number },
): SessionPayload | null {
  if (!opts.key || !token) return null;

  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  // ★比較は定数時間で行う
  const expected = sign(body, opts.key);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Stored;
    if (typeof s.exp !== "number" || s.exp <= opts.now) return null;
    if (!s.partyId || !s.caseId) return null;
    return { partyId: s.partyId, caseId: s.caseId };
  } catch {
    return null;
  }
}

function sign(body: string, key: string): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

export type CookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

/**
 * ★HttpOnly：JS から読めない（XSS でセッションを持ち出させない）
 * ★SameSite=Lax：他サイトからの遷移で送られない
 */
export function cookieOptions(opts: { secure: boolean }): CookieOptions {
  return {
    httpOnly: true,
    secure: opts.secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}
