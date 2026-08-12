import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { EmailLinkForm } from "@/components/auth/EmailLinkForm";

/**
 * 別の端末から戻る
 *
 * ★未登録のアカウントでは入れません。
 *   招待かケース作成を経ていない人が、ここから入ることはできません。
 */
export const metadata = { title: "お戻りになる — Aida" };

export default function Page() {
  return (
    <PhoneFrame>
      <div className="flex h-full flex-col overflow-y-auto px-6 pb-8 pt-10">
        <h1 style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.7 }}>お戻りになる</h1>
        <p style={{ fontSize: 13, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 8, marginBottom: 20 }}>
          ご登録済みのメールアドレスにリンクをお送りします。
        </p>
        <EmailLinkForm mode="signin" />

        {/* ★「登録してから戻る」という順序を、先に伝える */}
        <div
          className="mt-7"
          style={{
            border: "1px dashed var(--border-dashed)",
            borderRadius: "var(--r-md)",
            padding: 14,
          }}
        >
          <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub-2)" }}>
            この画面は、<strong>すでにご利用中の方</strong>が別の端末からお戻りになるためのものです。
            <br />
            はじめての方は「はじめる」からお進みください。アプリの中で、メールアドレスをご登録いただけます。
          </p>
          <a
            href="/start"
            className="mt-3 grid place-items-center"
            style={{ border: "1px solid var(--border-strong)", borderRadius: "var(--r-full)", minHeight: 44, fontSize: 14 }}
          >
            はじめる
          </a>
        </div>
      </div>
    </PhoneFrame>
  );
}
