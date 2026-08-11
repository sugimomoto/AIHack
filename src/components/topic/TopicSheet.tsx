"use client";

import { useEffect, useState } from "react";

/**
 * 相談のきっかけ
 *
 * ★選択を必須にしない。
 *   入力欄より前に置かない。**選ばずに書き始められることが必須要件である。**
 *   強制すると、感情の受け止めが選択画面の後ろに隠れる。
 *
 * ★「テンプレート」ではなく、話のきっかけである。
 *   選んでも、その文がそのまま送られるわけではない。
 */
type Scenario = { id: string; title: string; kind: string; linkedTopic: string | null };

export function TopicSheet({ onPick }: { onPick: (s: Scenario) => void }) {
  const [items, setItems] = useState<Scenario[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetch("/api/scenarios", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: Scenario[] }) => {
        if (alive) setItems(d.items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="shrink-0 px-4 pb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ fontSize: 12.5, color: "var(--agree-text)" }}
      >
        {open ? "閉じる" : "何から話すか迷ったら ▸"}
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.slice(0, 8).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onPick(s);
                setOpen(false);
              }}
              className="rounded-full px-3.5 py-2"
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                fontSize: 12.5,
                minHeight: 38,
              }}
            >
              {s.title}
            </button>
          ))}
          <p style={{ fontSize: 11.5, lineHeight: 1.85, color: "var(--text-sub-2)", width: "100%" }}>
            選ばずに、そのまま書いていただいても構いません。
          </p>
        </div>
      )}
    </div>
  );
}
