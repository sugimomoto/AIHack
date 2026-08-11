"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { OwnMessage } from "./OwnMessage";
import { AiMessage } from "./AiMessage";

/**
 * 対話（実装版）
 *
 * ★S4 の範囲では、書いた言葉は相手に届かない。
 *   取次ぎは S5 で追加する。この画面には「取次ぎ」がまだ現れない。
 *
 * ★入力欄は常に開いている。
 *   トピックを選ばなくても書き始められることが必須要件である。
 *   選択を強制すると、感情の受け止めが選択画面の後ろに隠れる。
 */

type Turn =
  | { kind: "own"; text: string }
  | { kind: "ai"; lines: string[]; choices: { id: string; label: string }[] };

export function LiveChat({ consultationId }: { consultationId: string }) {
  const [turns, setTurns] = useState<Turn[]>([
    {
      kind: "ai",
      lines: ["こんにちは。", "思っていることを、そのまま書いてください。", "ここに書いたことは、お相手には届きません。"],
      choices: [],
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async (t: string) => {
    const body = t.trim();
    if (!body || busy) return;
    setText("");
    setTurns((v) => [...v, { kind: "own", text: body }]);
    setBusy(true);
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));

    try {
      const res = await fetch(`/api/consultations/${consultationId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const data = (await res.json()) as {
        reply?: string;
        choices?: { id: string; label: string }[];
        error?: string;
      };
      setTurns((v) => [
        ...v,
        {
          kind: "ai",
          lines: (data.reply ?? data.error ?? "うまく応答できませんでした。").split(/\n+/).filter(Boolean),
          choices: data.choices ?? [],
        },
      ]);
    } catch {
      setTurns((v) => [
        ...v,
        { kind: "ai", lines: ["通信がうまくいきませんでした。少し待ってからお試しください。"], choices: [] },
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  };

  const last = turns[turns.length - 1];
  const choices = last?.kind === "ai" ? last.choices : [];

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center px-5"
        style={{ minHeight: 52, borderBottom: "1px solid var(--border-subtle)" }}
      >
        <h1 style={{ fontSize: 15.5, fontWeight: 600 }}>相談</h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        {turns.map((t, i) =>
          t.kind === "own" ? (
            <OwnMessage key={i} text={t.text} />
          ) : (
            <AiMessage key={i} lines={t.lines} showMark={turns[i - 1]?.kind !== "ai"} />
          ),
        )}
        {busy && (
          <div className="flex items-center gap-[9px]">
            <Image src="/character/capybara.png" alt="" width={28} height={28} />
            <span style={{ fontSize: 13, color: "var(--text-sub)" }}>考えています…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* ★選択肢は「次にできること」を示す。文面を代筆しない */}
      {choices.length > 0 && !busy && (
        <div className="flex shrink-0 flex-wrap gap-2 px-5 pb-2.5">
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => void send(c.label)}
              className="rounded-full px-[15px] py-2.5"
              style={{
                border: "1px solid #E4DACA",
                background: "var(--surface)",
                color: "var(--agree-text)",
                fontSize: "13.5px",
                minHeight: 44,
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div
        className="flex shrink-0 items-end gap-2.5 px-4 pb-3 pt-2"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(text);
          }}
          rows={1}
          placeholder="思っていることを書く"
          className="flex-1 resize-none rounded-[16px] px-[14px] py-3"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            minHeight: 44,
            fontSize: "15px",
          }}
        />
        <button
          type="button"
          onClick={() => void send(text)}
          disabled={busy || !text.trim()}
          aria-label="送信"
          className="grid shrink-0 place-items-center rounded-[20px] disabled:opacity-40"
          style={{ width: 44, height: 44, background: "var(--ai)", color: "#fff" }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
