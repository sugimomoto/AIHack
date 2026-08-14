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
export function IncomeInput({
  caseId,
  next,
  skip,
}: {
  caseId?: string;
  next?: string;
  /** ★飛ばした先。入れないと実質的な強制になる */
  skip?: string;
}) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const yen = Number(raw.replace(/[^0-9]/g, ""));
  const band = raw !== "" && Number.isFinite(yen) && yen >= 0 ? toIncomeBand(yen) : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 pb-8 pt-6">
      {/* ★用途を見出しに置く。何のために聞かれているか分からないまま金額を書かせない */}
      <p style={{ fontSize: 12, color: "var(--text-sub-2)" }}>目安を出すために</p>
      <h1 style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.7, marginTop: 4 }}>
        年収を教えてください
      </h1>
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
          note="この金額は、お相手には知られません"
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

      {next && (
        <button
          type="button"
          disabled={band === null || busy}
          onClick={() => {
            setBusy(true);
            void fetch("/api/profile", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ annualIncomeYen: yen }),
            })
              .then(() => {
                window.location.href = next;
              })
              .finally(() => setBusy(false));
          }}
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
          次へ
        </button>
      )}

      {/* ★「あとで入力する」と「入れなくても、話し合いは続けられます」が
           両方揃っていないと、実質的な強制になる。
           目安が出ないことを、不利益として書かない。 */}
      {skip && (
        <div className="mt-5 text-center">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              window.location.href = skip;
            }}
            className="disabled:opacity-50"
            style={{ fontSize: 13, color: "var(--text-sub)", textDecoration: "underline" }}
          >
            あとで入力する
          </button>
          <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 8 }}>
            入れなくても、話し合いは続けられます。
          </p>
        </div>
      )}
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
