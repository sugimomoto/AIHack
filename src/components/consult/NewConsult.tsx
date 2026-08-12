"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * 相談の開始（設計 #4）
 *
 * ★4つの分類 → 区切り → 自由入力への導線。
 *
 * ★選択を必須にしない。**選ばずに書き始められることが必須要件である。**
 *   強制すると、感情の受け止めが選択画面の後ろに隠れる。
 *
 * ★「テンプレート」ではなく、話のきっかけである。
 *   選んでも、その文がそのまま送られるわけではない。
 */
type Scenario = {
  id: string;
  title: string;
  categoryId: string | null;
  linkedTopic: string | null;
};
type Category = { id: string; name: string };

export function NewConsult() {
  const [items, setItems] = useState<Scenario[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [openCat, setOpenCat] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch("/api/scenarios", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [], categories: [] }))
      .then((d: { items: Scenario[]; categories: Category[] }) => {
        if (!alive) return;
        setItems(d.items ?? []);
        setCategories(d.categories ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-6">
      <Link href="/app/consult" style={{ fontSize: 13, color: "var(--text-sub)" }}>
        ‹ 相談
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <Image
          src="/character/capybara-sit.png"
          alt=""
          width={38}
          height={38}
          className="rounded-full object-cover"
          style={{ width: 38, height: 38 }}
        />
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>何について、お話ししますか</h1>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {categories.map((c) => {
          const list = items.filter((s) => s.categoryId === c.id);
          if (list.length === 0) return null;
          const open = openCat === c.id;
          return (
            <div
              key={c.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenCat(open ? null : c.id)}
                className="flex w-full items-center justify-between"
                style={{ padding: "15px 16px", fontSize: 15, minHeight: 44 }}
              >
                {c.name}
                <span style={{ color: "var(--text-sub)" }}>{open ? "⌄" : "▸"}</span>
              </button>
              {open && (
                <div className="anim-msg-in" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  {list.map((s, i) => (
                    <Link
                      key={s.id}
                      href={`/app/consult/start?s=${encodeURIComponent(s.id)}`}
                      className="block"
                      style={{
                        padding: "13px 16px",
                        fontSize: 14,
                        color: "var(--text-sub)",
                        borderTop: i === 0 ? undefined : "1px solid var(--border-subtle)",
                      }}
                    >
                      {s.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="mt-6"
        style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 18 }}
      >
        {/* ★選ばずに書き始められる。ここが必須要件 */}
        <Link
          href="/app/consult/start"
          className="flex items-center gap-3"
          style={{
            background: "var(--bubble-ai)",
            border: "1px dashed #DCC7A6",
            borderRadius: 20,
            padding: 16,
          }}
        >
          <span style={{ fontSize: 14.5, flex: 1 }}>選ばずに、そのまま書く</span>
          <span style={{ color: "var(--text-sub)" }}>▸</span>
        </Link>
        <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 10 }}>
          選ばなくてかまいません。あとから変えられます。
        </p>
      </div>
    </div>
  );
}
