"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DiscardDrafts } from "./DiscardDrafts";

/**
 * 設定
 *
 * ★「お相手の呼び方」を最上部に置く。**変更できることは機能要件である。**
 *   画面に出る呼び方を、自分が落ち着くものに変えられる。
 *   これは**自分の画面だけのもので、相手には渡らない。**
 *
 * ★通知に本文を出すのは既定 OFF。DV・つきまといの文脈がある。
 */
type Settings = {
  partnerAlias: string | null;
  notifyBody: boolean;
  /** ★お相手が参加しているか。★状態だけで、識別子は返らない */
  partnerJoined?: boolean;
};

export function SettingsView({ caseId, partyId }: { caseId: string; partyId: string }) {
  const [s, setS] = useState<Settings | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  /**
   * ★★ いま、どのアドレスで入っているか。
   *
   *   打ち間違えたアドレスで入ると、**新しい空のケースになる。**
   *   「データが消えた」ように見えるが、実際は**別人として入っている。**
   *   ★見えないと、本人にも気づけない。
   */
  const [email, setEmail] = useState<string | null>(null);

  const headers = { "content-type": "application/json", "x-dev-party": partyId };

  useEffect(() => {
    let alive = true;
    void fetch(`/api/cases/${caseId}/settings`, { headers, cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Settings>) : null))
      .then((r) => alive && r && setS(r));
    void fetch("/api/session", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ email?: string | null }>) : null))
      .then((r) => alive && setEmail(r?.email ?? null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, partyId]);

  const save = async (patch: Partial<Settings>) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/cases/${caseId}/settings`, {
        method: "POST",
        headers,
        body: JSON.stringify(patch),
      });
      if (r.ok) setS((await r.json()) as Settings);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-6">
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>設定</h1>

      {/* ★最上部・重要機能 */}
      <div
        className="mt-4"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: 16,
        }}
      >
        <p style={{ fontSize: 11.5, color: "var(--text-sub)" }}>お相手の呼び方</p>
        {editing ? (
          <>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={20}
              placeholder="お相手"
              className="mt-2 w-full"
              style={{
                background: "var(--surface-2)",
                borderRadius: "var(--r-sm)",
                padding: "10px 12px",
                minHeight: 44,
                fontSize: 16,
              }}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void save({ partnerAlias: draft })}
                className="rounded-full px-4 disabled:opacity-40"
                style={{ border: "1px solid var(--border-strong)", minHeight: 40, fontSize: 13.5 }}
              >
                これにする
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full px-4"
                style={{ border: "1px solid var(--border)", minHeight: 40, fontSize: 13.5 }}
              >
                やめる
              </button>
            </div>
          </>
        ) : (
          <div className="mt-1 flex items-center justify-between gap-3">
            <span style={{ fontSize: 16 }}>{s?.partnerAlias || "お相手"}</span>
            <button
              type="button"
              onClick={() => {
                setDraft(s?.partnerAlias ?? "");
                setEditing(true);
              }}
              style={{ fontSize: 12.5, color: "var(--agree-text)" }}
            >
              変更する
            </button>
          </div>
        )}
        <p style={{ fontSize: 12, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 8 }}>
          画面に出る呼び方を、ご自身が落ち着くものに変えられます。
          <br />
          {/* ★落ち着くために付けた呼び名が相手に届いてはいけない */}
          この呼び方は、お相手には伝わりません。
        </p>
      </div>

      {/* ★既定 OFF */}
      <div
        className="mt-3"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: 16,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span style={{ fontSize: 15 }}>通知に本文を出す</span>
          <button
            type="button"
            role="switch"
            aria-checked={s?.notifyBody === true}
            disabled={busy || !s}
            onClick={() => void save({ notifyBody: !s?.notifyBody })}
            style={{
              width: 50,
              height: 30,
              borderRadius: 15,
              border: "1px solid var(--border-strong)",
              background: s?.notifyBody ? "var(--agree-bg)" : "var(--surface-2)",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: s?.notifyBody ? 23 : 3,
                width: 22,
                height: 22,
                borderRadius: 11,
                background: s?.notifyBody ? "var(--agree)" : "var(--muted)",
                transition: "left .2s ease",
              }}
            />
          </button>
        </div>
        <p style={{ fontSize: 12, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 8 }}>
          切ると、ロック画面には「お知らせがあります」とだけ表示されます。
        </p>
      </div>

      <div
        className="mt-3 overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
        }}
      >
        {[
          { href: "/app/settings/registered", label: "登録した内容" },
          { href: "/knowledge", label: "制度のこと" },
          { href: "/context", label: "AIに渡しているもの" },
          { href: "/account", label: "次に使うときのために" },
        ].map((l, i) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center justify-between"
            style={{
              padding: "14px 16px",
              fontSize: 15,
              borderTop: i === 0 ? undefined : "1px solid var(--border-subtle)",
            }}
          >
            {l.label}
            <span style={{ color: "var(--text-sub)" }}>▸</span>
          </Link>
        ))}
      </div>

      {/* ★★ お相手とつながっているか。
             「つながっているのか分からない」という状態を残さない。
             ★状態だけ。お相手のアドレスも識別子も出さない（C1）。 */}
      {s && (
        <div
          className="mt-3"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "13px 15px",
          }}
        >
          <p style={{ fontSize: 11.5, color: "var(--text-sub-2)" }}>お相手のご参加</p>
          <p
            style={{
              fontSize: 14.5,
              marginTop: 4,
              color: s.partnerJoined ? "var(--agree-text)" : "var(--text)",
            }}
          >
            {s.partnerJoined ? "つながっています" : "まだご参加いただいていません"}
          </p>
          <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 6 }}>
            {s.partnerJoined
              ? "お相手にお渡しになった内容だけが、届いています。"
              : "ご案内をお渡しになるまで、お相手には何も届きません。急かすご連絡はしません。"}
          </p>
          {!s.partnerJoined && (
            <Link
              href="/onboarding/invite"
              className="mt-2 inline-block"
              style={{ fontSize: 12.5, color: "var(--text-sub)", textDecoration: "underline" }}
            >
              ご案内を用意する
            </Link>
          )}
        </div>
      )}

      {/* ★★ いま入っているアドレス。打ち間違いは、ここでも気づける */}
      {email && (
        <div
          className="mt-3"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "13px 15px",
          }}
        >
          <p style={{ fontSize: 11.5, color: "var(--text-sub-2)" }}>お入りのアドレス</p>
          <p style={{ fontSize: 14.5, marginTop: 4, wordBreak: "break-all" }}>{email}</p>
          <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 6 }}>
            ★このアドレスは、お相手には知られません。
          </p>
        </div>
      )}

      {/* ★消せるのは、渡していない自分の下書きだけ */}
      <DiscardDrafts caseId={caseId} partyId={partyId} />

      <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 18 }}>
        アプリ名・アイコン・通知文のいずれからも、内容が推測されないようにしています。
      </p>
    </div>
  );
}
