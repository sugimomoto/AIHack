import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { InviteLanding } from "@/components/invitation/InviteLanding";
import { isWellFormedToken } from "@/domain/invitation/token";
import { toPublicView, type InvitationPublicView } from "@/domain/invitation/publicView";
import { findByToken } from "@/infra-adapters/firestore/repositories/invitationRepository";

/**
 * ★この画面は未認証で開かれる。
 *   受け取った側はまだアカウントを持っていない。
 *
 * ★toPublicView を必ず経由する。招待の記録をそのまま渡さない。
 */
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let view: InvitationPublicView = { state: "EXPIRED" };
  if (isWellFormedToken(token)) {
    try {
      const inv = await findByToken(token);
      if (inv) view = toPublicView(inv, new Date());
    } catch (e) {
      // ★失敗の詳細は画面に出さない。ただしサーバー側には残す。
      //   握り潰すと、接続不良と「無効なリンク」が区別できなくなる。
      //   ★トークンはログに出さない（G-F）。
      console.error("[invite] 招待の照会に失敗しました", e);
    }
  }

  return (
    <PhoneFrame>
      <InviteLanding view={view} token={token} />
    </PhoneFrame>
  );
}
