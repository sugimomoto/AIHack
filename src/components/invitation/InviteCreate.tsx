"use client";

import { useState } from "react";
import Image from "next/image";
/**
 * A-1｜招待の作成
 *
 * ★★ 送信前のプレビュー（A-2）を消した（2026-08-14）。
 *   メール送信をやめたのに画面だけが残り、**`setPreview(true)` が
 *   どこからも呼ばれていなかった。**開くことのできない画面である。
 *   その中に「お名前を出す」の切り替えが閉じ込められていた。
 *
 * ★安全性の情報は選択肢の「外側」に置く。中に入れると推奨になる。
 *
 * @see design/README-v2.md A-1
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
        // ★★ `revealSenderName` の切り替えを外した（2026-08-14）。
        //   チェックボックスは MailPreview の中にあり、**どこからも開けなかった。**
        //   そもそも欄と役割が重なる。**空欄にすれば名乗らない**のだから、
        //   同じことを決める操作を2つ置かない。
        body: JSON.stringify({ method, recipientEmail, revealSenderName: true, senderName }),
      });
      if (!res.ok) return null;
      const d = (await res.json()) as { url: string };
      setUrl(d.url);
      return d.url;
    } finally {
      setIssuing(false);
    }
  };

  const [copied, setCopied] = useState(false);

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
          {/* ★★ 何のための欄かが分からなくなっていた（2026-08-14）。
                 メールをやめたので、**文面に入る名前ではなくなった。**
                 いまは**お相手がリンクを開いた画面**に出る。
                 ★どこに出るかを書かないと、要否を判断できない。 */}
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>お相手に伝えるお名前</h2>
          <p style={{ fontSize: 13, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 6 }}>
            お相手がリンクを開いたときに、
            <strong>「◯◯さまからのご依頼です」</strong>と表示されます。
            <br />
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

        {/* ★★ リンクを作ったあとに「あとにする」と出ていた（2026-08-14）。
               ★**渡した人にとっては、後回しではなく、済ませたことである。**
               やることをやった人に「あとにする」と言わせるのは筋が通らない。

               ★ただし「渡しました」とも書かない。
               コピーしたことは分かるが、**渡したかどうかは分からない。**
               分からないことを、こちらが決めつけない。 */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => (window.location.href = "/app")}
            style={{ fontSize: 13.5, color: "var(--text-sub)" }}
          >
            {url ? "次へ進む" : "あとにする"}
          </button>
          <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 6 }}>
            {url
              ? "お渡しになるのは、いつでも構いません。お相手を待つあいだも、ひとりで進められます。"
              : "お相手を待つあいだも、ひとりで進められます。"}
          </p>
        </div>
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
