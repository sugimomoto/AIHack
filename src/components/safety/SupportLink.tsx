"use client";

import { useEffect, useState } from "react";

/**
 * 相談できる公的な窓口（案2：常設）
 *
 * ★検知に一切反応しない。
 *   反応すると、何も検知されなかった場合との差が生まれ、
 *   **「見抜かれた」という監視感になる。**
 *
 * ★誰が開いたかを記録しない。
 *   開いたこと自体が、その人の状況を示してしまう。
 *
 * @see docs/ui-design.md §5.2（案2＋案3）
 */
type Resource = {
  id: string;
  name: string;
  contact: string;
  note: string;
  url: string;
  verified: boolean;
  operator?: string;
};

export function SupportLink() {
  const [items, setItems] = useState<Resource[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetch("/api/support-resources", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: Resource[] }) => {
        if (alive) setItems(d.items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="相談できる公的な窓口"
        className="grid shrink-0 place-items-center rounded-full"
        style={{ width: 36, height: 36, border: "1px solid var(--border)", fontSize: 15 }}
      >
        🛡
      </button>

      {open && (
        <div
          className="absolute bottom-16 left-3 right-3 z-10"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: 14,
            boxShadow: "0 6px 24px rgba(0,0,0,.08)",
          }}
        >
          <p style={{ fontSize: 13.5, fontWeight: 600 }}>相談できる公的な窓口</p>

          {/* ★躊躇の理由に、公的資料の事実で答える。
                「確証がなくても」「誤りでも責任は問われない」「匿名でよい」は
                いずれも厚生労働省・文部科学省の手引きに原文がある。
                本プロダクトが提供できる最も確実な価値である。 */}
          <ul
            style={{
              fontSize: 11.5,
              lineHeight: 1.95,
              color: "var(--text-sub-2)",
              background: "var(--muted-bg)",
              borderRadius: "var(--r-sm)",
              padding: "9px 11px",
              marginTop: 8,
            }}
          >
            <li>・確かでなくても、連絡して構いません</li>
            <li>・結果として違っていても、責任を問われることは基本的にありません</li>
            <li>・判断するのは専門の機関です</li>
            <li>・匿名でも構いません。連絡した人が誰かは、法律で守られます</li>
          </ul>
          {items.map((r) => (
            <div key={r.id} style={{ padding: "10px 0", borderTop: "1px solid var(--border-subtle)" }}>
              <p style={{ fontSize: 13 }}>
                {r.name}　<span style={{ fontWeight: 600 }}>{r.contact}</span>
              </p>
              <p style={{ fontSize: 11.5, lineHeight: 1.8, color: "var(--text-sub)" }}>{r.note}</p>
              {r.operator && (
                <p style={{ fontSize: 11, color: "var(--muted)" }}>{r.operator}</p>
              )}
            </div>
          ))}
          {items.some((r) => !r.verified) && (
            <p style={{ fontSize: 11, lineHeight: 1.8, color: "var(--muted)", marginTop: 8 }}>
              ※一部の番号は未検証です。お使いになる前にご確認ください。
            </p>
          )}
          <p style={{ fontSize: 11, lineHeight: 1.8, color: "var(--text-sub-2)", marginTop: 8 }}>
            この画面を開いたことは、記録されません。お相手にも伝わりません。
          </p>
        </div>
      )}
    </>
  );
}
