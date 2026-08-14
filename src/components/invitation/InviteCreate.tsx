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

export function InviteCreate({ senderName: initialName }: { senderName?: string }) {
  const [senderName, setSenderName] = useState(initialName ?? "");
  const [url, setUrl] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  /**
   * ★リンクは発行して初めて存在する。
   *   画面を開いただけでは招待を作らない。
   *   作った時点で、相手に渡りうるものが生まれる。
   */
  const issue = async (method: "LINK" | "EMAIL", recipientEmail?: string) => {
    if (issuing) return null;
    setIssuing(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method, recipientEmail, revealSenderName: reveal, senderName }),
      });
      if (!res.ok) return null;
      const d = (await res.json()) as { url: string };
      setUrl(d.url);
      return d.url;
    } finally {
      setIssuing(false);
    }
  };

  const [preview, setPreview] = useState(false);
  const [reveal, setReveal] = useState(true); // 既定 ON
  const [copied, setCopied] = useState(false);

  if (preview) {
    return (
      <MailPreview
        senderName={senderName || "ご関係の方"}
        url={url ?? ""}
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
          <Image src="/character/capybara.png" alt="" width={28} height={28} className="mt-0.5 shrink-0" style={{ width: 28, height: 28, flexShrink: 0 }} />
          <div
            style={{
              background: "var(--bubble-ai)",
              borderRadius: "var(--r-md)",
              padding: "11px 14px",
              fontSize: 14,
              lineHeight: 1.85,
            }}
          >
            ご案内のリンクをお作りします。
            <div style={{ fontSize: 12.5, color: "var(--text-sub)", marginTop: 2 }}>
              いつ、どの方法でお渡しになるかは、ご自身で決められます。
            </div>
          </div>
        </div>

        {/* ★名乗りは任意。実名でなくてよい */}
        <div className="mt-4" style={CARD}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>お相手に伝えるお名前</h2>
          <p style={{ fontSize: 13, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 6 }}>
            実名でなくても構いません。空欄なら「ご関係の方」となります。
          </p>
          <input
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="例：太郎"
            className="mt-3 w-full"
            style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "12px 14px", minHeight: 44, fontSize: 14 }}
          />
        </div>

        {/* ★お渡しの方法は1つだけ。**作れていない機能を並べない** */}
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
                {url ?? "まだ発行していません"}
              </span>
              <button
                type="button"
                disabled={issuing}
                onClick={async () => {
                  const u = url ?? (await issue("LINK"));
                  if (!u) return;
                  void navigator.clipboard?.writeText(u);
                  setCopied(true);
                }}
                style={{ fontSize: 13, color: "var(--agree-text)", fontWeight: 600 }}
              >
                {copied ? "コピー済み" : url ? "コピー" : "リンクを作る"}
              </button>
            </div>
          </section>

        </div>

        {/* ★★ 「メールで送る」を外した（2026-08-14）。
               送信基盤が無く、ボタンは無効のままだった。
               **作れていない機能を、選択肢として並べておかない。**
               お渡しの方法は、ご自身で選んでいただく。 */}

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
          ★アプリからお相手に連絡することはありません。お渡しになるまで、お相手には何も届きません。
          お渡しの方法（メッセージ・口頭など）と時期は、ご自身でお選びいただけます。
        </div>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => (window.location.href = "/app")}
            style={{ fontSize: 13.5, color: "var(--text-sub)" }}
          >
            あとにする
          </button>
          <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 6 }}>
            お相手を待つあいだも、ひとりで進められます。
          </p>
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

        {/* ★送信基盤は未接続（C-02）。作れていない機能を、動くように見せない */}
        <button
          type="button"
          disabled
          className="mt-3 w-full disabled:opacity-45"
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
        <p style={{ fontSize: 11.5, lineHeight: 1.85, color: "var(--text-sub-2)", marginTop: 6, textAlign: "center" }}>
          メールの送信はまだご利用いただけません。上のリンクをご自身でお渡しください。
        </p>
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
