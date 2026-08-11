"use client";

import { useState } from "react";
import Image from "next/image";
import { buildInvitationMail } from "@/domain/invitation/mail";

/**
 * A-1｜招待の作成 ＋ A-2｜送信前のプレビュー
 *
 * ★2つの選択肢に主従を作らない。
 *   面積・枠線・角丸をそろえ、どちらも強調ボタンにしない。
 *   安全性の情報は選択肢の「外側」に置く。中に入れると推奨になる。
 *
 * ★プレビューは buildInvitationMail をそのまま呼ぶ。
 *   APIが送る文面と同じ関数を使うため、「見せた文面」と「送る文面」が
 *   構造上ずれない。別々に書くと、いずれ乖離する。
 *
 * @see design/README-v2.md A-1 / A-2
 */

const CARD: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-lg)",
  padding: 18,
};

export function InviteCreate({ senderName, url }: { senderName: string; url: string }) {
  const [email, setEmail] = useState("");
  const [preview, setPreview] = useState(false);
  const [reveal, setReveal] = useState(true); // 既定 ON
  const [copied, setCopied] = useState(false);

  if (preview) {
    return (
      <MailPreview
        senderName={senderName}
        url={url}
        reveal={reveal}
        onReveal={setReveal}
        onBack={() => setPreview(false)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="お相手を招待する" />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        {/* AI の一言 */}
        <div className="flex items-start gap-2.5 pt-4">
          <Image src="/character/capybara.png" alt="" width={28} height={28} className="mt-0.5 shrink-0" />
          <div
            style={{
              background: "var(--bubble-ai)",
              borderRadius: "var(--r-md)",
              padding: "11px 14px",
              fontSize: 14,
              lineHeight: 1.85,
            }}
          >
            お渡しの方法を、選んでください。
            <div style={{ fontSize: 12.5, color: "var(--text-sub)", marginTop: 2 }}>
              どちらでも、あとから変えられます。
            </div>
          </div>
        </div>

        {/* ★2枚は同じ寸法・同じ枠線。主従を作らない */}
        <div className="mt-4 flex flex-col gap-3">
          <section style={CARD}>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>リンクをコピーして、自分で渡す</h2>
            <p style={{ fontSize: 13, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 6 }}>
              アプリはお相手に連絡しません。いつ、どの手段で渡すかを、ご自身で決められます。
            </p>
            <div
              className="mt-3 flex items-center gap-2"
              style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "12px 14px" }}
            >
              <span className="min-w-0 flex-1 truncate" style={{ fontSize: 12.5, color: "var(--text-sub-2)" }}>
                {url}
              </span>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(url);
                  setCopied(true);
                }}
                style={{ fontSize: 13, color: "var(--agree-text)", fontWeight: 600 }}
              >
                {copied ? "コピー済み" : "コピー"}
              </button>
            </div>
          </section>

          <section style={CARD}>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>メールで送る</h2>
            <p style={{ fontSize: 13, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 6 }}>
              アプリが送信します。文面は決まっていて、書き換えられません。送る前に、そのままお見せします。
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス"
              className="mt-3 w-full"
              style={{
                background: "var(--surface-2)",
                borderRadius: "var(--r-md)",
                padding: "12px 14px",
                minHeight: 44,
                fontSize: 14,
              }}
            />
            <button
              type="button"
              onClick={() => setPreview(true)}
              className="mt-3"
              style={{ fontSize: 13, color: "var(--agree-text)", fontWeight: 600 }}
            >
              送られる文面を見る ▸
            </button>
          </section>
        </div>

        {/* ★安全性の情報は選択肢の外側。末尾の一文で判断を本人に戻す */}
        <div
          className="mt-4"
          style={{
            border: "1px dashed var(--border-dashed)",
            borderRadius: "var(--r-lg)",
            padding: 14,
            fontSize: 12.5,
            lineHeight: 1.95,
            color: "var(--text-sub-2)",
          }}
        >
          リンクをご自身で渡すほうが、お相手が急に連絡を受け取ることにはなりません。ただ、どちらが良いかは事情によります。
        </div>

        <div className="mt-5 text-center">
          <button type="button" style={{ fontSize: 13.5, color: "var(--text-sub)" }}>
            あとにする
          </button>
        </div>
      </div>
    </div>
  );
}

/** A-2｜送信前のプレビュー */
function MailPreview({
  senderName,
  url,
  reveal,
  onReveal,
  onBack,
}: {
  senderName: string;
  url: string;
  reveal: boolean;
  onReveal: (v: boolean) => void;
  onBack: () => void;
}) {
  // ★APIが送るのと同じ関数。見せた文面と送る文面がずれない
  const mail = buildInvitationMail({ url, senderName, revealSenderName: reveal });

  return (
    <div className="flex h-full flex-col">
      <Header title="送られる文面" onBack={onBack} />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub-2)", paddingTop: 14 }}>
          この文面がそのまま送られます。書き換えることはできません。
        </p>

        <div
          className="mt-3"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "var(--envelope-head)",
              borderBottom: "1px dashed var(--border-dashed)",
              padding: "7px 14px",
              fontSize: 11.5,
              color: "var(--text-sub)",
            }}
          >
            件名
          </div>
          <div style={{ padding: "12px 14px", fontSize: 15 }}>{mail.subject}</div>
          <div
            style={{
              background: "var(--envelope-head)",
              borderTop: "1px dashed var(--border-dashed)",
              borderBottom: "1px dashed var(--border-dashed)",
              padding: "7px 14px",
              fontSize: 11.5,
              color: "var(--text-sub)",
            }}
          >
            本文
          </div>
          <div style={{ padding: "14px", fontSize: 13.5, lineHeight: 1.95, whiteSpace: "pre-wrap" }}>
            {mail.body}
          </div>
        </div>

        {/* ★書けることは、実際に書かれていることだけにする。
             本文は「お子さまに関する取り決め」に触れているため、
             「お子さんの件だと分からない」とは書けない。 */}
        <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub-2)", marginTop: 14 }}>
          件名から用途は分かりません。離婚・養育費・調停といった語も使いません。自由に書き足せる欄もありません。
        </p>
      </div>

      <div className="shrink-0 px-4 pb-5 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <label
          className="flex items-center gap-3"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "12px 14px",
          }}
        >
          <input type="checkbox" checked={reveal} onChange={(e) => onReveal(e.target.checked)} />
          <span className="min-w-0 flex-1">
            <span style={{ fontSize: 14 }}>お名前を出す</span>
            <span style={{ display: "block", fontSize: 12, color: "var(--text-sub)", lineHeight: 1.8 }}>
              出さない場合は「ご関係の方からのご依頼で」となります。
            </span>
          </span>
        </label>

        <button
          type="button"
          className="mt-3 w-full"
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
          この内容で送る
        </button>
        <button type="button" onClick={onBack} className="mt-2 w-full" style={{ fontSize: 13.5, color: "var(--text-sub)", minHeight: 40 }}>
          戻る
        </button>
      </div>
    </div>
  );
}

function Header({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div
      className="flex shrink-0 items-center gap-3 px-4"
      style={{ minHeight: 52, borderBottom: "1px solid var(--border-subtle)" }}
    >
      <button type="button" onClick={onBack} aria-label="戻る" style={{ fontSize: 16, color: "var(--text-sub)" }}>
        ‹
      </button>
      <h1 style={{ fontSize: 15.5, fontWeight: 600 }}>{title}</h1>
    </div>
  );
}
