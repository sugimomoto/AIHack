"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { OwnMessage } from "./OwnMessage";
import { AiMessage } from "./AiMessage";
import { RelayMessage } from "./RelayMessage";
import { TopicSheet } from "@/components/topic/TopicSheet";
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
  messages: { role: "USER" | "AI"; content: string; createdAt: string }[];
  inbound: { id: string; content: string }[];
};

export function CaseChat({
  caseId,
  partyId,
  label,
  onChanged,
  reloadKey,
}: {
  caseId: string;
  partyId: string;
  label: string;
  onChanged?: () => void;
  reloadKey?: number;
}) {
  const [view, setView] = useState<View>({ messages: [], inbound: [] });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // ★問いは「どの時点のものか」を持たせる。
  //   相手の送信で読み直したとき、前ターンの問いが残って別件に貼り付くのを防ぐ
  //   （レビューで検出）。
  const [question, setQuestion] = useState<{ key: number; text: string } | null>(null);
  const effectQuestion = question && question.key === (reloadKey ?? 0) ? question.text : null;
  const setEffectQuestion = (text: string | null) =>
    setQuestion(text ? { key: reloadKey ?? 0, text } : null);
  const endRef = useRef<HTMLDivElement>(null);

  const headers = useCallback(
    () => ({ "content-type": "application/json", "x-dev-party": partyId }),
    [partyId],
  );

  const fetchView = useCallback(async (): Promise<View | null> => {
    const res = await fetch(`/api/cases/${caseId}/view`, { headers: headers(), cache: "no-store" });
    return res.ok ? ((await res.json()) as View) : null;
  }, [caseId, headers]);

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

  const send = async (effect?: "ONE_TIME" | "PERMANENT") => {
    const body = text.trim();
    if ((!body && !effect) || busy) return;
    setText("");
    setBusy(true);
    // ★前ターンの問いを必ず消す。残ると、無関係な発言に貼り付く
    setEffectQuestion(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/messages`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ text: body || "（選択）", effect }),
      });
      // ★C3：合意を参照して立てられた問い
      const d = res.ok ? ((await res.json()) as { effectQuestion?: string | null }) : null;
      setEffectQuestion(d?.effectQuestion ?? null);
      await reload();
      onChanged?.(); // ★相手側も読み直す
    } catch {
      // ★失敗しても、問いが残ったままにしない
      setEffectQuestion(null);
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
        <span style={{ fontSize: 14.5, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{partyId}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-4">
        {/* ★自分宛の取次ぎ。相手の言葉ではないため封書として描く */}
        {view.inbound.map((e) => {
          // ★1行目が要約、2行目以降が背景（→ domain/relay/prompts.ts buildRelayText）
          const [body, ...rest] = e.content.split("\n").filter(Boolean);
          return <RelayMessage key={e.id} body={body} hearsay={rest.join("\n") || undefined} />;
        })}

        {view.messages.map((m, i) =>
          m.role === "USER" ? (
            <OwnMessage key={i} text={m.content} />
          ) : (
            <AiMessage key={i} lines={m.content.split(/\n+/).filter(Boolean)} showMark />
          ),
        )}

        {/* ★合意を参照しているからこそ立てられる問い（C3） */}
        {effectQuestion && !busy && (
          <div
            style={{
              background: "var(--bubble-ai)",
              border: "1px dashed var(--border-dashed)",
              borderRadius: "var(--r-md)",
              padding: "11px 13px",
            }}
          >
            <p style={{ fontSize: 13.5, lineHeight: 1.9 }}>{effectQuestion}</p>
            <p style={{ fontSize: 11.5, lineHeight: 1.8, color: "var(--text-sub-2)", marginTop: 6 }}>
              「今回だけ」を選んでも、取り決めは変わりません。
            </p>
            <div className="mt-2.5 flex gap-2">
              {([
                ["ONE_TIME", "今回だけ変更する"],
                ["PERMANENT", "今後も変更する"],
              ] as const).map(([e, label]) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => void send(e)}
                  className="flex-1 rounded-full"
                  style={{
                    border: "1px solid var(--border-strong)",
                    background: "var(--surface)",
                    minHeight: 38,
                    fontSize: 12.5,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {busy && (
          <div className="flex items-center gap-[9px]">
            <Image src="/character/capybara.png" alt="" width={24} height={24} />
            <span style={{ fontSize: 12.5, color: "var(--text-sub)" }}>考えています…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

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
