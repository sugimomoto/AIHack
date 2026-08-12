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

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/start");

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
              href="/app"
              className="mt-6 grid place-items-center"
              style={{ border: "1px solid var(--border-strong)", borderRadius: "var(--r-full)", minHeight: 48, fontSize: 14.5 }}
            >
              相談に戻る
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
