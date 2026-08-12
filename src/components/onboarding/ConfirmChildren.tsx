"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * H-1 受諾直後の確認
 *
 * ★見て、違えば直すだけ。**新しく聞くことはしない。**
 * ★どちらが正しいかを、こちらで決めない。
 * ★「うかがうのは、ここまでです」を画面の下に必ず置く。
 *   質問がまだ続くのではという警戒を、その場で終わらせるため。
 */
type Row = { year: string; month: string };

const field: React.CSSProperties = {
  background: "var(--surface-2)",
  borderRadius: "var(--r-sm)",
  padding: "10px 12px",
  minHeight: 42,
  fontSize: 14,
};

function toRow(birthDate: string): Row {
  const [y, m] = birthDate.split("-");
  return { year: y ?? "", month: String(Number(m ?? "1")) };
}

export function ConfirmChildren({
  caseId,
  births,
  next,
  heading = "お子さんのことが、すでに登録されています",
  lead = "違っているところがあれば、直してください。合っていれば、そのまま進めます。",
  /** ★設定から開いたときは「うかがうのはここまで」を出さない（入口ではない） */
  hideClosing = false,
}: {
  caseId: string;
  births: string[];
  next: string;
  heading?: string;
  lead?: string;
  hideClosing?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(births.map(toRow));
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = rows.some((r, i) => {
    const o = toRow(births[i]!);
    return r.year !== o.year || r.month !== o.month;
  });

  const valid = rows.every(
    (r) =>
      /^\d{4}$/.test(r.year) &&
      /^\d{1,2}$/.test(r.month) &&
      Number(r.month) >= 1 &&
      Number(r.month) <= 12,
  );

  const proceed = async () => {
    if (busy || !valid) return;
    setBusy(true);
    try {
      // ★直していなければ、書き込まない。見ただけで上書きしない
      if (dirty) {
        await fetch(`/api/cases/${caseId}/children`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            children: rows.map((r) => ({
              birthDate: `${r.year}-${String(Number(r.month)).padStart(2, "0")}-01`,
            })),
          }),
        });
      }
      window.location.href = next;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={hideClosing ? "flex flex-col" : "flex h-full flex-col overflow-y-auto px-5 pb-8 pt-8"}>
      <h1 style={{ fontSize: 18, lineHeight: 1.7, fontWeight: 600 }}>{heading}</h1>
      <p style={{ fontSize: 13, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 8 }}>
        {lead}
      </p>

      {rows.map((r, i) => (
        <div
          key={i}
          className="mt-3"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: 14,
          }}
        >
          {editing === i ? (
            <div className="flex items-center gap-2">
              <input
                inputMode="numeric"
                value={r.year}
                onChange={(e) =>
                  setRows(rows.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))
                }
                aria-label={`${i + 1}人目の生まれ年`}
                style={{ ...field, width: 84 }}
              />
              <span style={{ fontSize: 13 }}>年</span>
              <input
                inputMode="numeric"
                value={r.month}
                onChange={(e) =>
                  setRows(rows.map((x, j) => (j === i ? { ...x, month: e.target.value } : x)))
                }
                aria-label={`${i + 1}人目の生まれ月`}
                style={{ ...field, width: 62 }}
              />
              <span style={{ fontSize: 13 }}>月生まれ</span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p style={{ fontSize: 12.5, color: "var(--text-sub)" }}>{i + 1}人目</p>
                <p style={{ fontSize: 15, fontWeight: 600, marginTop: 3 }}>
                  {r.year}年{r.month}月生まれ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(i)}
                style={{ fontSize: 13, color: "var(--agree-text)" }}
              >
                直す
              </button>
            </div>
          )}
        </div>
      ))}

      {/* ★どちらが正しいかを、こちらで決めない */}
      <div
        className="mt-4"
        style={{
          border: "1px dashed var(--border-strong)",
          borderRadius: "var(--r-md)",
          padding: 13,
        }}
      >
        <p style={{ fontSize: 11.5, lineHeight: 1.95, color: "var(--text-sub)" }}>
          直された場合、お相手には「変更がありました」とだけ伝わります。どちらが正しいかを、こちらで決めることはしません。
        </p>
      </div>

      <button
        type="button"
        disabled={busy || !valid}
        onClick={() => void proceed()}
        className="mt-5 w-full disabled:opacity-45"
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
        {dirty ? "直して進む" : "この内容で進む"}
      </button>

      {/* ★質問がまだ続くのではという警戒を、その場で終わらせる */}
      {!hideClosing && (
      <div
        className="mt-6 flex gap-3"
        style={{
          background: "var(--bubble-ai)",
          border: "1px dashed var(--border-strong)",
          borderRadius: "var(--r-md)",
          padding: 14,
        }}
      >
        <Image
          src="/character/capybara-sit.png"
          alt=""
          width={28}
          height={28}
          style={{ width: 28, height: 28, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.8 }}>
            うかがうのは、ここまでです。
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 5 }}>
            ご事情や、お住まいのことは、おうかがいしません。お話しになりたいことから始めていただけます。
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
