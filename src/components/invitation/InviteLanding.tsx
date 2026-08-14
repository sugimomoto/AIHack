"use client";

import { useState } from "react";
import Image from "next/image";
import type { InvitationPublicView } from "@/domain/invitation/publicView";
import { EmailLinkForm } from "@/components/auth/EmailLinkForm";

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
  "書いた言葉そのままでは届きません。整えたうえで、お伝えします。",
  "連絡先も、入力した内容も、お相手には見えません。",
  "参加しない選択もできます。期限はありません。",
];

export function InviteLanding({ view, token }: { view: InvitationPublicView; token: string }) {
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);
  // ★参加には本人確認が要る（招待した側と同じ扱い）
  //
  // ★★ メールのリンクから戻ってきたときは、**最初からこの画面**にする。
  //
  //   以前は false 固定だった。戻ってくると通常の選択画面が描かれ、
  //   **リンクを処理する画面が出ないまま止まっていた**（実機で発生）。
  //   押した本人にとっては「リンクを踏んだのに何も起きない」形になる。
  const [needsAuth, setNeedsAuth] = useState(() => {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search);
    return q.get("mode") === "signIn" && Boolean(q.get("oobCode"));
  });

  if (view.state !== "OPEN") return <Unavailable />;
  if (declined) return <Declined />;

  const respond = async (action: "ACCEPT" | "DECLINE") => {
    if (busy) return;
    setBusy(true);
    try {
      // ★★ 参加するには、メールアドレスのご確認が要る。
      //   招待した側と同じ扱いにする。**片側だけ辿れない状態を残さない。**
      //   ★辞退には要らない。**断るのに、アカウントを作らせない。**
      if (action === "ACCEPT") {
        setNeedsAuth(true);
        return;
      }
      const res = await fetch(`/api/invite/${token}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) return;
      setDeclined(true);
    } finally {
      setBusy(false);
    }
  };

  // ★メールのリンクから戻ってきたら、ここで受諾が成立する
  if (needsAuth) {
    return (
      <div className="flex h-full flex-col overflow-y-auto px-5 pb-8 pt-8">
        <h1 style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.75 }}>
          ご参加の前に、メールアドレスをうかがいます
        </h1>
        <p style={{ fontSize: 13, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 8 }}>
          次にお戻りいただくために使います。<strong>お相手には知られません。</strong>
          <br />
          お名前は要りません。
        </p>
        <div className="mt-5">
          <EmailLinkForm mode="accept" acceptToken={token} />
        </div>
        <button
          type="button"
          onClick={() => setNeedsAuth(false)}
          className="mt-4"
          style={{ fontSize: 13, color: "var(--text-sub)", minHeight: 44 }}
        >
          戻る
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 pb-6 pt-8">
      <div className="flex flex-col items-center text-center">
        <div
          className="grid place-items-center overflow-hidden"
          style={{ width: 76, height: 76, borderRadius: 22, background: "var(--bubble-ai)" }}
        >
          <Image src="/character/capybara-sit.png" alt="" width={62} height={62} style={{ width: 62, height: 62, flexShrink: 0 }} />
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
          disabled={busy}
          onClick={() => void respond("ACCEPT")}
          className="disabled:opacity-50"
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
          disabled={busy}
          onClick={() => void respond("DECLINE")}
          className="disabled:opacity-50"
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

/** ★辞退したことは相手に伝わらない。そのことを本人に伝える */
function Declined() {
  return (
    <div className="grid h-full place-items-center px-8 text-center">
      <p style={{ fontSize: 14, lineHeight: 1.95, color: "var(--text-sub)" }}>
        承知しました。
        <br />
        このことが、お相手に伝わることはありません。
      </p>
    </div>
  );
}
