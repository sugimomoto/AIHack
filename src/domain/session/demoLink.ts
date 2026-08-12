import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 継続的に使える確認用リンク
 *
 * ★リンクを持っている人は、その当事者になれる。
 *   **範囲を絞らなければ「誰でも他人になれる」仕組みそのものである。**
 *
 *   絞り方：
 *     ・確認用と印を付けたケースにしか効かない（→ services/demoSession.ts）
 *     ・印を付けられるのは、運営トークンを持つ人だけ
 *     ・期限がある
 *     ・改竄できない
 *
 * ★署名の対象に用途を含める。
 *   セッションの署名を流用できないようにする。
 */
const USE = "DEMO_LINK";

export type DemoPayload = { partyId: string; caseId: string };
type Stored = DemoPayload & { use: string; exp: number };

export function signDemoLink(
  p: DemoPayload,
  opts: { key: string; now: number; days: number },
): string {
  if (!opts.key) throw new Error("DEMO_LINK_SECRET が設定されていません");
  const stored: Stored = {
    use: USE,
    partyId: p.partyId,
    caseId: p.caseId,
    exp: opts.now + opts.days * 86_400_000,
  };
  const body = Buffer.from(JSON.stringify(stored)).toString("base64url");
  return `${body}.${sign(body, opts.key)}`;
}

export function verifyDemoLink(
  token: string,
  opts: { key: string; now: number },
): DemoPayload | null {
  if (!opts.key || !token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body, opts.key));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Stored;
    if (s.use !== USE) return null; // ★他の用途の署名を流用させない
    if (typeof s.exp !== "number" || s.exp <= opts.now) return null;
    if (!s.partyId || !s.caseId) return null;
    return { partyId: s.partyId, caseId: s.caseId };
  } catch {
    return null;
  }
}

function sign(body: string, key: string): string {
  return createHmac("sha256", `${USE}:${key}`).update(body).digest("base64url");
}
