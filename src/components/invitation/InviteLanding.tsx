"use client";

import Image from "next/image";
import type { InvitationPublicView } from "@/domain/invitation/publicView";

/**
 * A-3｜招待を受け取った側の最初の画面
 *
 * 相手にとっては「元配偶者から何か来た」という状態である。
 * ★勧誘の言葉を置かない。
 *
 * ★4行はすべて「〜しません／〜見えません」の形にしている。
 *   機能の説明ではなく、安全の説明である。
 *
 * @see design/README-v2.md A-3
 */

const ASSURANCES = [
  "おふたりが直接やりとりすることには、なりません。",
  "書いた言葉は、お相手には届きません。合意できた事項だけが共有されます。",
  "連絡先も、入力した内容も、お相手には見えません。",
  "参加しない選択もできます。期限はありません。",
];

export function InviteLanding({ view }: { view: InvitationPublicView }) {
  if (view.state !== "OPEN") return <Unavailable />;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 pb-6 pt-8">
      <div className="flex flex-col items-center text-center">
        <div
          className="grid place-items-center overflow-hidden"
          style={{ width: 76, height: 76, borderRadius: 22, background: "var(--bubble-ai)" }}
        >
          <Image src="/character/capybara-sit.png" alt="" width={62} height={62} />
        </div>
        <h1 style={{ fontSize: 20, lineHeight: 1.7, fontWeight: 600, marginTop: 16 }}>
          Aida は、おふたりのあいだに
          <br />
          立つためのサービスです。
        </h1>
        {view.senderName && (
          <p style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 10, lineHeight: 1.8 }}>
            {view.senderName}さまからのご依頼です。
          </p>
        )}
      </div>

      <div
        className="mt-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "0 16px" }}
      >
        {ASSURANCES.map((t, i) => (
          <p
            key={t}
            style={{
              padding: "15px 0",
              fontSize: 14.5,
              lineHeight: 1.9,
              borderTop: i === 0 ? undefined : "1px solid var(--border-subtle)",
            }}
          >
            {t}
          </p>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        <button
          type="button"
          style={{
            background: "var(--agree-bg)",
            border: "1px solid var(--agree)",
            borderRadius: "var(--r-full)",
            minHeight: 50,
            fontSize: 15,
            fontWeight: 600,
            color: "var(--agree-text)",
          }}
        >
          内容を見てみる
        </button>
        <button
          type="button"
          style={{
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-full)",
            minHeight: 50,
            fontSize: 15,
            color: "var(--text)",
          }}
        >
          いまは決めない
        </button>
      </div>

      {/* ★この一文は必須 */}
      <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 14, textAlign: "center" }}>
        お断りになった場合、その旨はお相手に伝わりません。
      </p>
    </div>
  );
}

/**
 * ★期限切れ・使用済みを区別して表示しない。
 *   区別すると、有効なトークンの探索の手がかりになる。
 */
function Unavailable() {
  return (
    <div className="grid h-full place-items-center px-8 text-center">
      <p style={{ fontSize: 14, lineHeight: 1.95, color: "var(--text-sub)" }}>
        このリンクは、現在ご利用いただけません。
        <br />
        お心当たりのある方にご確認ください。
      </p>
    </div>
  );
}
