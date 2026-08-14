"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { OwnMessage } from "./OwnMessage";
import { AiMessage } from "./AiMessage";
import { RelayMessage } from "./RelayMessage";
import { useRefreshOnFocus } from "./useRefreshOnFocus";
import { RelaySent } from "./RelaySent";
import { TopicSheet } from "@/components/topic/TopicSheet";
import { EmptyConsult } from "@/components/ui/EmptyState";
import { RELAY_PROMISE, RELAY_PROMISE_RELAX } from "@/domain/ui/emptyState";
import { SupportLink } from "@/components/safety/SupportLink";

/**
 * ケースに接続された対話
 *
 * ★3種別が揃う。
 *   ① 自分の発言    … 相手には届かない
 *   ② AIの発言      … 本人しか読まない
 *   ③ **取次ぎ**    … 相手の言葉ではない。封書として描く
 *
 * ★開発用の当事者切替はヘッダで渡す。
 *   本番では効かない（→ lib/party.ts）。
 */

type View = {
  messages: { role: "USER" | "AI"; content: string; relayed?: boolean; createdAt: string }[];
  inbound: { id: string; content: string; createdAt?: string }[];
  /** ★自分が送ったものが、どう伝わったか */
  outbound?: { id: string; content: string; createdAt?: string }[];
};

export function CaseChat({
  caseId,
  partyId,
  label,
  onChanged,
  reloadKey,
  scenarioId = null,
  threadId = null,
  opening = null,
  examples = [],
  backHref,
}: {
  caseId: string;
  partyId: string;
  label: string;
  onChanged?: () => void;
  reloadKey?: number;
  /** ★どの相談か。未指定なら既定の相談（K-1） */
  scenarioId?: string | null;
  /** ★どのスレッドか。同じトピックでも件ごとに分かれる */
  threadId?: string | null;
  /**
   * ★書き出しの案内。何をどう書けばよいか分からないまま、
   *   空の入力欄に向かわせない。
   */
  opening?: string | null;
  examples?: string[];
  /** ★一覧に戻る導線。タブへ戻らせない（K-2） */
  backHref?: string;
}) {
  const [view, setView] = useState<View>({ messages: [], inbound: [], outbound: [] });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // ★お知らせは「どの時点のものか」を持たせる。
  //   相手の送信で読み直したとき、前ターンのものが残って別件に貼り付くのを防ぐ
  //   （レビューで検出）。
  const [notice, setNotice] = useState<{ key: number; text: string } | null>(null);
  const effectNotice = notice && notice.key === (reloadKey ?? 0) ? notice.text : null;
  const setEffectNotice = (text: string | null) =>
    setNotice(text ? { key: reloadKey ?? 0, text } : null);
  const endRef = useRef<HTMLDivElement>(null);

  const headers = useCallback(
    () => ({ "content-type": "application/json", "x-dev-party": partyId }),
    [partyId],
  );

  const fetchView = useCallback(async (): Promise<View | null> => {
    const q = threadId ? `?threadId=${encodeURIComponent(threadId)}` : "";
    const res = await fetch(`/api/cases/${caseId}/view${q}`, { headers: headers(), cache: "no-store" });
    return res.ok ? ((await res.json()) as View) : null;
  }, [caseId, headers, threadId]);

  const reload = useCallback(async () => {
    const v = await fetchView();
    if (v) setView(v);
  }, [fetchView]);

  useEffect(() => {
    // ★アンマウント後に書き込まない
    let alive = true;
    void fetchView().then((v) => {
      if (alive && v) setView(v);
    });
    return () => {
      alive = false;
    };
  }, [fetchView, reloadKey]);

  // ★★ 開いたまま置いたタブに、あとから届いたものが出なかった（実測）。
  //   届くことが主題である以上、**見ているのに古いまま**は許容できない。
  useRefreshOnFocus(reload);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setText("");
    setBusy(true);
    // ★前ターンのお知らせを必ず消す。残ると、無関係な発言に貼り付く
    setEffectNotice(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/messages`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ text: body, scenarioId, threadId, title: label }),
      });
      // ★C3：合意を参照して出されたお知らせ
      const d = res.ok ? ((await res.json()) as { effectNotice?: string | null }) : null;
      setEffectNotice(d?.effectNotice ?? null);
      await reload();
      onChanged?.(); // ★相手側も読み直す
    } catch {
      // ★失敗しても、お知らせが残ったままにしない
      setEffectNotice(null);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center justify-between px-4"
        style={{ minHeight: 48, borderBottom: "1px solid var(--border-subtle)" }}
      >
        <span className="flex items-center gap-2" style={{ fontSize: 14.5, fontWeight: 600 }}>
          {/* ★別の相談へ移るために、いちいちタブへ戻らせない（K-2） */}
          {backHref && (
            <Link href={backHref} aria-label="相談の一覧へ" style={{ color: "var(--text-sub)" }}>
              ‹
            </Link>
          )}
          {label}
        </span>
        {/* ★内部の識別子を画面に出さない。
             開発中の確認用に出していたものが、そのまま本番の画面に残っていた。 */}
        {process.env.NODE_ENV !== "production" && (
          <span style={{ fontSize: 11, color: "var(--muted)" }}>{partyId}</span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-4">
        {/* ★1件目を書くときがいちばん怖い。
               「お相手には届きません」は、書いたあとではなく**書く前**に要る（L-1） */}
        {view.inbound.length === 0 && view.messages.length === 0 && (
          opening ? (
            <div className="anim-msg-in">
              <div className="flex gap-2.5">
                <Image
                  src="/character/capybara-sit.png"
                  alt=""
                  width={26}
                  height={26}
                  style={{ width: 26, height: 26, flexShrink: 0 }} />
                <div className="min-w-0">
                  <p style={{ fontSize: 13.5, lineHeight: 1.95 }}>{opening}</p>
                  <p
                    style={{
                      fontSize: 12,
                      lineHeight: 1.95,
                      color: "var(--text-sub)",
                      marginTop: 6,
                    }}
                  >
                    {RELAY_PROMISE}
                    {RELAY_PROMISE_RELAX}
                  </p>
                </div>
              </div>

              {/* ★選ぶと入力欄に入るだけ。**そのまま送らない。**
                     直してから送れることが分かる形にする。 */}
              {examples.length > 0 && (
                <div className="mt-3" style={{ paddingLeft: 37 }}>
                  <p style={{ fontSize: 11.5, color: "var(--text-sub-2)" }}>書き出しの例</p>
                  <div className="mt-1.5 flex flex-col items-start gap-1.5">
                    {examples.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setText(e)}
                        className="text-left"
                        style={{
                          fontSize: 12.5,
                          lineHeight: 1.7,
                          padding: "8px 12px",
                          borderRadius: "var(--r-md)",
                          border: "1px solid var(--border)",
                          background: "var(--surface)",
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                    選ぶと入力欄に入ります。直してからお送りいただけます。
                  </p>
                </div>
              )}
            </div>
          ) : (
            <EmptyConsult />
          )
        )}

        {/* ★3種を時系列で混ぜる。
               「書いた → こう伝わった」が並んで初めて、
               **AI を通すと何が起きるのかが分かる。** */}
        {timeline(view).map((t) =>
          t.kind === "INBOUND" ? (
            // ★相手の言葉ではないため封書として描く
            (() => {
              const [body, ...rest] = t.content.split("\n").filter(Boolean);
              return (
                <RelayMessage key={t.key} body={body} hearsay={rest.join("\n") || undefined} />
              );
            })()
          ) : t.kind === "OUTBOUND" ? (
            <RelaySent key={t.key} text={t.content} />
          ) : t.kind === "USER" ? (
            <div key={t.key} className="flex flex-col items-end gap-1">
              <OwnMessage text={t.content} />
              {/* ★届かなかったことも、届いたことと同じだけ明示する。
                     何も書かないと「取り次いでくれたのか」が判断できない。 */}
              {t.relayed === false && (
                <p style={{ fontSize: 11, lineHeight: 1.8, color: "var(--muted)", maxWidth: "86%" }}>
                  {/* ★理由を決めつけない。
                         事実の連絡にも「お気持ちを受け止めるだけ」と出ていた。 */}
                  これは、お相手にはお渡ししていません。お渡しが要るときは、いつでもおっしゃってください。
                </p>
              )}
            </div>
          ) : (
            <AiMessage key={t.key} lines={t.content.split(/\n+/).filter(Boolean)} showMark />
          ),
        )}

        {/* ★合意を参照しているからこそ出せるお知らせ（C3）。
               ★以前はここで「今回だけ／今後も」を選ばせていた。
                 取り決めを対話から動かさなくなったので、「今後も」は行き先を失った。
                 選べるように見せたまま何も起きないほうが、選べないことより悪い。 */}
        {effectNotice && !busy && (
          <div
            style={{
              background: "var(--bubble-ai)",
              border: "1px dashed var(--border-dashed)",
              borderRadius: "var(--r-md)",
              padding: "11px 13px",
            }}
          >
            <p style={{ fontSize: 13.5, lineHeight: 1.9 }}>{effectNotice}</p>
          </div>
        )}

        {busy && (
          <div className="flex items-center gap-[9px]">
            <Image src="/character/capybara.png" alt="" width={24} height={24} style={{ width: 24, height: 24, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "var(--text-sub)" }}>考えています…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* ★済んだものが残り続けると、対応が要るものが埋もれる。
             ただし消さない。沈めるだけで、あとから戻せる。 */}
      {threadId && (
        <div className="shrink-0 px-4 pb-1 text-right">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void fetch(`/api/cases/${caseId}/consultations/close`, {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({ threadId, status: "CLOSED" }),
              })
                .then(() => {
                  window.location.href = "/app/consult";
                })
                .finally(() => setBusy(false));
            }}
            style={{ fontSize: 12, color: "var(--text-sub)", textDecoration: "underline" }}
          >
            このご相談を、済んだことにする
          </button>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
            一覧の下に移ります。あとから戻せます。
          </p>
        </div>
      )}

      {/* ★入力欄より前に置かない。選ばずに書き始められることが必須要件 */}
      <TopicSheet onPick={(sc) => setText((t) => t || `${sc.title}について相談したいです。`)} />

      <div
        className="relative flex shrink-0 items-end gap-2 px-3 pb-3 pt-2"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        {/* ★常設。検知に一切反応しない（案2） */}
        <SupportLink />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder="思っていることを書く"
          className="flex-1 resize-none rounded-[14px] px-3 py-2.5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", minHeight: 40, fontSize: 14 }}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || !text.trim()}
          aria-label="送信"
          className="grid shrink-0 place-items-center rounded-[18px] disabled:opacity-40"
          style={{ width: 40, height: 40, background: "var(--ai)", color: "#fff" }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

/**
 * 発言・取次ぎを時系列に並べる。
 *
 * ★createdAt が無い古い記録は末尾に落とさず、その場の順を保つ。
 */
type Row = {
  key: string;
  kind: "USER" | "AI" | "INBOUND" | "OUTBOUND";
  content: string;
  at: string;
  relayed?: boolean;
};

function timeline(v: View): Row[] {
  const rows: Row[] = [
    ...v.messages.map((m, i) => ({
      key: `m${i}`,
      kind: m.role as "USER" | "AI",
      content: m.content,
      relayed: m.relayed,
      at: m.createdAt ?? "",
    })),
    ...v.inbound.map((e) => ({
      key: `i${e.id}`,
      kind: "INBOUND" as const,
      content: e.content,
      at: e.createdAt ?? "",
    })),
    ...(v.outbound ?? []).map((e) => ({
      key: `o${e.id}`,
      kind: "OUTBOUND" as const,
      content: e.content,
      at: e.createdAt ?? "",
    })),
  ];
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.at === b.r.at ? a.i - b.i : a.r.at.localeCompare(b.r.at)))
    .map((x) => x.r);
}
