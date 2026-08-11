import { authenticate, UnauthenticatedError } from "@/lib/auth";
import { resolveDevParty } from "@/lib/party";
import { readSession } from "@/lib/session";
import { asPartyId, type PartyId } from "@/domain/case/types";

/**
 * リクエストから当事者を解決する。
 *
 * ★認証を先に試す。開発用の切替は、認証が無いときの最後の手段である。
 *   順序を逆にすると、認証済みのユーザーがヘッダで別人になれる。
 *
 * 順序：
 *   1. セッション Cookie（本番の主経路）
 *   2. Authorization ヘッダ（将来の外部連携用）
 *   3. 開発用の切替（★本番では常に無効）
 */
export async function resolveParty(req: Request): Promise<PartyId> {
  const s = await readSession();
  if (s) return asPartyId(s.partyId);

  try {
    return (await authenticate(req)).id;
  } catch (e) {
    if (!(e instanceof UnauthenticatedError)) throw e;
  }

  // ★本番では常に null（→ lib/party.ts）
  const dev = resolveDevParty(req.headers.get("x-dev-party"));
  if (dev) return dev;

  throw new UnauthenticatedError();
}
