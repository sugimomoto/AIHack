import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  cookieOptions,
  signSession,
  verifySession,
  type SessionPayload,
} from "@/domain/session/token";

/**
 * セッションの読み書き
 *
 * ★鍵が無ければ何もしない。既定値を持たせない。
 */
function key(): string {
  return process.env.SESSION_SECRET ?? "";
}

export async function readSession(): Promise<SessionPayload | null> {
  const c = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!c) return null;
  return verifySession(c, { key: key(), now: Date.now() });
}

export async function writeSession(p: SessionPayload): Promise<void> {
  const token = signSession(p, { key: key(), now: Date.now() });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions({ secure: process.env.NODE_ENV === "production" }));
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
