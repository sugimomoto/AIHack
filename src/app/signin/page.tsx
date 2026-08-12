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
      </div>
    </PhoneFrame>
  );
}
