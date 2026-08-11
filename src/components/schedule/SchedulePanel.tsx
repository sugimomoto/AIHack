"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 予定と履行
 *
 * ★「まだ記録がありません」は「支払われていません」ではない。
 *   アプリは入金を観測できない。観測できないことを断定しない。
 *
 * ★リマインダーは自分の義務のぶんだけ現れる。相手には出ない。
 */

type View = {
  rows: {
    key: string;
    dueDate: string;
    amountYen: number;
    isOwnObligation: boolean;
    state: string;
    label: string;
    canReport: "PAID" | "RECEIVED" | null;
  }[];
  reminders: { dueDate: string; amountYen: number }[];
  deviations: { key: string; dueDate: string; amountYen: number; daysPast: number }[];
  enforceability: { explanation: string; caveat?: string } | null;
};

const md = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`;

export function SchedulePanel({
  caseId,
  partyId,
  reloadKey,
}: {
  caseId: string;
  partyId: string;
  reloadKey?: number;
}) {
  const [v, setV] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchView = useCallback(async (): Promise<View | null> => {
    const res = await fetch(`/api/cases/${caseId}/schedule`, {
      headers: { "x-dev-party": partyId },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as View) : null;
  }, [caseId, partyId]);

  useEffect(() => {
    let alive = true;
    void fetchView().then((r) => {
      if (alive && r) setV(r);
    });
    return () => {
      alive = false;
    };
  }, [fetchView, reloadKey]);

  const report = async (key: string, kind: "PAID" | "RECEIVED") => {
    setBusy(true);
    try {
      await fetch(`/api/cases/${caseId}/schedule`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-dev-party": partyId },
        body: JSON.stringify({ key, kind }),
      });
      const r = await fetchView();
      if (r) setV(r);
    } finally {
      setBusy(false);
    }
  };

  if (!v || v.rows.length === 0) return null;

  return (
    <div
      className="shrink-0 overflow-y-auto px-4 py-3"
      style={{ borderTop: "1px solid var(--border-subtle)", maxHeight: "36%" }}
    >
      <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>予定</p>

      {/* ★自分の義務のぶんだけ。相手には出ない */}
      {v.reminders.map((r) => (
        <p
          key={r.dueDate}
          style={{
            fontSize: 12,
            lineHeight: 1.85,
            color: "var(--ai-text)",
            background: "var(--bubble-ai)",
            borderRadius: "var(--r-sm)",
            padding: "7px 10px",
            marginBottom: 8,
          }}
        >
          {md(r.dueDate)}に {r.amountYen.toLocaleString()}円のお支払いの予定があります。
        </p>
      ))}

      {/* ★「支払われていません」ではない。行き違いの可能性を先に置く */}
      {v.deviations.length > 0 && (
        <div
          style={{
            background: "var(--attention-bg)",
            border: "1px solid var(--attention)",
            borderRadius: "var(--r-sm)",
            padding: "9px 11px",
            marginBottom: 8,
          }}
        >
          <p style={{ fontSize: 12, lineHeight: 1.85, color: "var(--attention-text)" }}>
            {md(v.deviations[0].dueDate)}分の お支払いの記録が確認できていません。
            <br />
            行き違いの可能性もあります。まずは記録をご確認ください。
          </p>
          {v.enforceability && (
            <p style={{ fontSize: 11.5, lineHeight: 1.85, color: "var(--text-sub-2)", marginTop: 7 }}>
              {v.enforceability.explanation}
              {v.enforceability.caveat && (
                <>
                  <br />
                  <span style={{ color: "var(--muted)" }}>{v.enforceability.caveat}</span>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {v.rows.slice(0, 4).map((r) => (
        <div
          key={r.key}
          className="flex items-center justify-between gap-2"
          style={{ padding: "9px 0", borderTop: "1px solid var(--border-subtle)" }}
        >
          <div className="min-w-0">
            <span style={{ fontSize: 13 }}>
              {md(r.dueDate)} ／ {r.amountYen.toLocaleString()}円
            </span>
            <span
              style={{
                display: "block",
                fontSize: 11.5,
                color: r.state === "CONFIRMED" ? "var(--agree-text)" : "var(--text-sub)",
              }}
            >
              {r.label}
            </span>
          </div>
          {r.canReport && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void report(r.key, r.canReport!)}
              className="shrink-0 rounded-full px-3 disabled:opacity-40"
              style={{ border: "1px solid var(--border-strong)", minHeight: 34, fontSize: 12.5 }}
            >
              {r.canReport === "PAID" ? "支払いました" : "入金を確認しました"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
