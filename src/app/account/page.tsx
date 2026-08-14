import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { EmailLinkForm } from "@/components/auth/EmailLinkForm";
import { asCaseId, asPartyId } from "@/domain/case/types";
import { loadPartyAuthUid } from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * 次にお使いになるとき
 *
 * ★セッションは端末に残るだけである。
 *   **登録しないと、端末を変えたときに戻れない。**
 *   そのことを、隠さずに書く。
 */
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await readSession();

  // ★★ メールのリンクから戻ってきた場合は、セッションが無くても通す。
  //
  //   このリンクの continueUrl は、送信した画面（この画面）になる。
  //   だが**リンクは別のブラウザで開かれることがある**
  //   （メールアプリが内蔵ブラウザで開く／別の端末で開く）。
  //   その場合セッションが無く、以前はここで `/` へ飛ばしていた。
  //   **リンクを踏んでも入れない**という、いちばん困る形だった（実機で発生）。
  //
  //   ★セッションが無いときは、結びつけ（link）ではなく**戻る（signin）**を試す。
  const q = await searchParams;
  const fromEmailLink = typeof q.oobCode === "string" && q.mode === "signIn";
  // ★リンクに当事者を指すトークンが載っていれば、結びつけを続けられる
  const hasLinkToken = typeof q.lt === "string" && q.lt.length > 0;

  if (!s) {
    if (!fromEmailLink) redirect("/");
    return (
      <PhoneFrame>
        <div className="flex h-full flex-col overflow-y-auto px-6 pb-8 pt-10">
          <h1 style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.7 }}>お戻りになる</h1>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.95,
              color: "var(--text-sub)",
              marginTop: 8,
              marginBottom: 20,
            }}
          >
            メールのリンクを確認しています。
          </p>
          {/* ★トークンがあれば結びつけを続けられる。無ければ「戻る」を試す */}
          <EmailLinkForm mode={hasLinkToken ? "link" : "signin"} />
        </div>
      </PhoneFrame>
    );
  }

  const linked = await loadPartyAuthUid(asCaseId(s.caseId), asPartyId(s.partyId)).catch(() => null);

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col overflow-y-auto px-6 pb-8 pt-10">
        <h1 style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.7 }}>次にお使いになるとき</h1>

        {linked ? (
          <>
            <p style={{ fontSize: 13.5, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 10 }}>
              メールアドレスをご登録済みです。
              <br />
              端末を変えても、同じアドレスでお戻りいただけます。
            </p>
            <a
              href="/onboarding/invite"
              className="mt-6 grid place-items-center"
              style={{ border: "1px solid var(--border-strong)", borderRadius: "var(--r-full)", minHeight: 48, fontSize: 14.5 }}
            >
              次へ
            </a>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13.5, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 10, marginBottom: 18 }}>
              いまのままだと、<strong>この端末でしかお使いいただけません。</strong>
              <br />
              メールアドレスをご登録いただくと、端末を変えてもお戻りいただけます。
            </p>
            <EmailLinkForm mode="link" />
          </>
        )}
      </div>
    </PhoneFrame>
  );
}
