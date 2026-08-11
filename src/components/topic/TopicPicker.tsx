"use client";

import { useState } from "react";
import { TOPIC_CATEGORIES } from "@/mock/scenario";

/**
 * 相談の開始（トピック選択）
 *
 * ★選択を必須にしてはならない。
 *   「まず愚痴りたい」人に選択を強いると、感情の受け止めが選択画面の後ろに隠れる。
 *   入力欄は常に開いておき、「選ばずに書く」を必ず用意する。
 */
export function TopicPicker() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-5 pt-6 pb-4">
      <p style={{ fontSize: "20px", fontWeight: 500, lineHeight: 1.6 }}>
        何について相談しますか？
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {TOPIC_CATEGORIES.map((c) => (
          <div key={c.id}>
            <button
              type="button"
              onClick={() => setOpen(open === c.id ? null : c.id)}
              className="w-full rounded-[20px] px-4 py-4 text-left"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                fontSize: "16.5px",
                minHeight: 44,
              }}
            >
              {c.label}
            </button>
            {open === c.id && (
              <div className="anim-fade mt-2 flex flex-col gap-2 pl-2">
                {[...c.scenarios, "その他（自由に書く）"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-[16px] px-4 py-3 text-left"
                    style={{
                      background: "var(--surface-2)",
                      fontSize: "14.5px",
                      color: "var(--text-sub-2)",
                      minHeight: 44,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        className="mt-6 pt-4"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <button
          type="button"
          className="w-full text-left"
          style={{ fontSize: "15px", color: "var(--agree-text)", minHeight: 44 }}
        >
          選ばずに書く ▸
        </button>
      </div>
    </div>
  );
}
