"use client";

import { useState } from "react";
import { toIncomeBand, INCOME_BAND_NOTE } from "@/domain/income/band";

/**
 * 前提情報｜年収の入力
 *
 * ★入力した瞬間、相手に見える形をその場で示す。
 *
 *   入力: 4,380,000円  ← ここに書いたことは、お相手には届きません
 *     ↓
 *   相手に見える: 425〜450万円
 *
 * 「安全です」と書く代わりに、**何が越えるのかを実物で見せる。**
 * 第1弾の「ここに書いたことは、お相手には届きません」と同じ役割の表示である。
 *
 * @see docs/product-requirements.md FR-16a
 * @see docs/ui-design.md §5.1
 */
export function IncomeInput() {
  const [raw, setRaw] = useState("");
  const yen = Number(raw.replace(/[^0-9]/g, ""));
  const band = raw !== "" && Number.isFinite(yen) && yen >= 0 ? toIncomeBand(yen) : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 pb-8 pt-6">
      <h1 style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.7 }}>年収を教えてください</h1>
      <p style={{ fontSize: 13, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 8 }}>
        養育費の目安を出すために使います。源泉徴収票の「支払金額」をご覧ください。
      </p>

      <input
        inputMode="numeric"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="4380000"
        className="mt-5 w-full"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "14px 16px",
          minHeight: 52,
          fontSize: 17,
        }}
      />

      {/* ★何が越えるのかを実物で見せる */}
      <div
        className="mt-4"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        <Row
          label="入力した金額"
          note="ここに書いたことは、お相手には届きません"
          value={raw === "" ? "—" : `${yen.toLocaleString()}円`}
          muted
        />
        <Row
          label="お相手に見える形"
          note="養育費の目安を出すために、この幅だけが共有されます"
          value={band === null ? "—" : `${band.replace("-", "〜")}万円`}
          highlight
        />
      </div>

      <p style={{ fontSize: 12, lineHeight: 1.95, color: "var(--text-sub-2)", marginTop: 14 }}>
        金額そのものが共有されることはありません。勤務先や住所も同様です。
      </p>

      {/* ★区分は暫定である。実装にもテストにも同じ注記を持たせている */}
      <p style={{ fontSize: 11, lineHeight: 1.9, color: "var(--muted)", marginTop: 10 }}>
        {INCOME_BAND_NOTE}
      </p>
    </div>
  );
}

function Row({
  label,
  note,
  value,
  muted,
  highlight,
}: {
  label: string;
  note: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderTop: highlight ? "1px solid var(--border-subtle)" : undefined,
        background: highlight ? "var(--agree-bg)" : undefined,
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span style={{ fontSize: 12.5, color: "var(--text-sub)" }}>{label}</span>
        <span
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: muted ? "var(--muted)" : highlight ? "var(--agree-text)" : "var(--text)",
          }}
        >
          {value}
        </span>
      </div>
      <p style={{ fontSize: 11.5, lineHeight: 1.85, color: "var(--text-sub-2)", marginTop: 5 }}>{note}</p>
    </div>
  );
}
