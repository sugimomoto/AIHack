"use client";

import { useState } from "react";

/**
 * お子さんの登録
 *
 * ★算定表に必要なのは「人数」と「年齢」だけである。
 *   名前は任意にする。**必要のない情報を求めない。**
 *
 * ★公表されている算定表は3人まで。
 *   4人以上は目安を出せないため、入力も受け付けない。
 */
type Row = { year: string; month: string; name: string };
const EMPTY: Row = { year: "", month: "", name: "" };

const field: React.CSSProperties = {
  background: "var(--surface-2)",
  borderRadius: "var(--r-sm)",
  padding: "10px 12px",
  minHeight: 42,
  fontSize: 14,
};

export function ChildrenForm({ caseId, next }: { caseId: string; next: string }) {
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = rows.every(
    (r) => /^\d{4}$/.test(r.year) && /^\d{1,2}$/.test(r.month) && Number(r.month) >= 1 && Number(r.month) <= 12,
  );

  const set = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/children`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          children: rows.map((r) => ({
            birthDate: `${r.year}-${String(Number(r.month)).padStart(2, "0")}-01`,
            name: r.name.trim() || undefined,
          })),
        }),
      });
      if (res.ok) window.location.href = next;
      else setError("登録できませんでした。入力をご確認ください。");
    } catch {
      setError("通信がうまくいきませんでした");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
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
          <p style={{ fontSize: 12.5, color: "var(--text-sub)" }}>{i + 1}人目</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              inputMode="numeric"
              value={r.year}
              onChange={(e) => set(i, { year: e.target.value })}
              placeholder="2015"
              aria-label={`${i + 1}人目の生まれ年`}
              style={{ ...field, width: 84 }}
            />
            <span style={{ fontSize: 13 }}>年</span>
            <input
              inputMode="numeric"
              value={r.month}
              onChange={(e) => set(i, { month: e.target.value })}
              placeholder="4"
              aria-label={`${i + 1}人目の生まれ月`}
              style={{ ...field, width: 62 }}
            />
            <span style={{ fontSize: 13 }}>月生まれ</span>
          </div>
          <input
            value={r.name}
            onChange={(e) => set(i, { name: e.target.value })}
            placeholder="呼び名（任意）"
            className="mt-2 w-full"
            style={field}
          />
        </div>
      ))}

      <div className="mt-3 flex gap-4">
        {rows.length < 3 && (
          <button
            type="button"
            onClick={() => setRows([...rows, { ...EMPTY }])}
            style={{ fontSize: 13, color: "var(--agree-text)" }}
          >
            ＋ お子さんを追加
          </button>
        )}
        {rows.length > 1 && (
          <button
            type="button"
            onClick={() => setRows(rows.slice(0, -1))}
            style={{ fontSize: 13, color: "var(--text-sub)" }}
          >
            − 減らす
          </button>
        )}
      </div>

      <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--text-sub-2)", marginTop: 14 }}>
        生まれ月までしか伺いません。養育費の目安は、15歳以上かどうかで変わります。
      </p>
      {/* ★エラーにも警告にもしない。
           算定表の対象外であることを、本人の責任のように見せないため。
           「話し合いは、そのまま進められます」まで書いて、はじめて中立になる。 */}
      {rows.length === 3 && (
        <div
          className="anim-msg-in mt-3"
          style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: 12 }}
        >
          <p style={{ fontSize: 11.5, lineHeight: 1.95, color: "var(--text-sub)" }}>
            4人目以降は、目安の表が公表されていないため、金額の目安をお出しできません。話し合いは、そのまま進められます。
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={!valid || busy}
        onClick={() => void submit()}
        className="mt-4 w-full disabled:opacity-45"
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
      {error && <p style={{ fontSize: 12.5, color: "var(--attention-text)", marginTop: 10 }}>{error}</p>}
    </>
  );
}
