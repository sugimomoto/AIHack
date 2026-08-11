import { authenticate, UnauthenticatedError } from "@/lib/auth";
import { resolveDevParty } from "@/lib/party";
import type { PartyId } from "@/domain/case/types";

/**
 * リクエストから当事者を解決する。
 *
 * ★認証を先に試す。開発用の切替は、認証が無いときの最後の手段である。
 *   順序を逆にすると、認証済みのユーザーがヘッダで別人になれる。
 */
export async function resolveParty(req: Request): Promise<PartyId> {
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
