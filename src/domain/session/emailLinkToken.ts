import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * メールのリンクを、別のブラウザで開いても結びつけられるようにする
 *
 * ★★ なぜ要るか
 *
 *   メールアドレスの登録は、こういう順序で起きる。
 *
 *     1. アプリの中で「リンクを送る」を押す（★このときセッションがある）
 *     2. メールが届く
 *     3. リンクを開く                      ← ★ここが別のブラウザになりうる
 *     4. 当事者と Firebase の識別子を結びつける
 *
 *   3 でメールアプリが内蔵ブラウザを使ったり、別の端末で開いたりすると、
 *   **セッションの Cookie が無い。**すると 4 で「誰の当事者か」が分からない。
 *
 *   実機で起きた：リンクを踏んでも入口に戻され、**登録が完了しなかった。**
 *
 * ★だからリンクに、当事者を指す短命のトークンを載せる。
 *   Cookie の代わりに、これで「誰の当事者か」を運ぶ。
 *
 * ★★ 悪用の範囲を、狭く保つ
 *
 *   このトークンだけでは何もできない。**必ず2つ揃わないと結びつかない。**
 *
 *     ・このトークン（当事者を指す）
 *     ・メールに届いた oobCode（本人であることの確認）
 *
 *   さらに：
 *     ・**用途を署名に含める**（セッションや確認用リンクの署名を流用できない）
 *     ・**1時間で切れる**（確認用リンクの「日」単位より短い）
 *     ・すでに別の識別子が紐づいていれば、結びつけない（canLinkAuthUid）
 *
 *   ★このトークンでセッションは発行されない。**結びつけにしか使えない。**
 */
const USE = "EMAIL_LINK";

/** ★短く保つ。メールを開くまでの時間で足りる */
const TTL_MS = 60 * 60 * 1000;

export type EmailLinkPayload = { partyId: string; caseId: string };
type Stored = EmailLinkPayload & { use: string; exp: number };

export function signEmailLink(
  p: EmailLinkPayload,
  opts: { key: string; now: number },
): string {
  if (!opts.key) throw new Error("SESSION_SECRET が設定されていません");
  const stored: Stored = {
    use: USE,
    partyId: p.partyId,
    caseId: p.caseId,
    exp: opts.now + TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(stored)).toString("base64url");
  return `${body}.${sign(body, opts.key)}`;
}

export function verifyEmailLink(
  token: string,
  opts: { key: string; now: number },
): EmailLinkPayload | null {
  if (!opts.key || !token) return null;

  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!equals(sign(body, opts.key), sig)) return null;

  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Stored;
    // ★用途が違うトークンを受け付けない
    if (s.use !== USE) return null;
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

/** ★長さが違うと timingSafeEqual が投げる */
function equals(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
