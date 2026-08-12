"use client";

import { useCallback, useEffect, useState } from "react";
import { DEVIATION_LABELS } from "@/domain/obligation/deviation";
import { describeChange } from "@/domain/adjustment/revision";

const TOPIC_LABEL: Record<string, string> = {
  CHILD_SUPPORT: "養育費のお支払い",
  VISITATION: "面会交流",
};
import { EmptyUpcoming } from "@/components/ui/EmptyState";

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
    topic: string;
    amountYen: number | null;
    isOwnObligation: boolean;
    state: string;
    label: string;
    canReport: "PAID" | "RECEIVED" | null;
  }[];
  /** ★「今回だけ」の変更。保存はしていたが読む経路が無かった */
  exceptions: { id: string; topic: string; change: Record<string, unknown> }[];
  /** ★取り決めではない軽い約束（L2）。公正証書には載らない */
  arrangements: { id: string; date: string; label: string }[];
  reminders: { dueDate: string; amountYen: number }[];
  deviations: { key: string; dueDate: string; amountYen: number; daysPast: number }[];
  enforceability: { explanation: string; caveat?: string } | null;
};

const md = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`;
/** ★年を落とさない。前年か当年か分からないと確認できない */
const ymd = (d: string) => `${d.slice(0, 4)}年${md(d)}`;

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

  // ★空白を返さない。タブを開いて何も無いのは、壊れて見える（L-3）
  if (!v) return null;
  if (v.rows.length === 0) return <EmptyUpcoming />;

  return (
    <div
      className="shrink-0 px-4 py-3"
      style={{ borderTop: "1px solid var(--border-subtle)" }}
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
          {/* ★文言は定数から取る。画面に直書きすると、語彙のテストが実画面を守らない */}
          <p style={{ fontSize: 12, lineHeight: 1.85, color: "var(--attention-text)" }}>
            {ymd(v.deviations[v.deviations.length - 1].dueDate)}分の {DEVIATION_LABELS.NOTICE}。
            {v.deviations.length > 1 && `（ほかに${v.deviations.length - 1}件）`}
            <br />
            {DEVIATION_LABELS.DETAIL}
          </p>
          {v.enforceability && (
            <p style={{ fontSize: 11.5, lineHeight: 1.85, color: "var(--text-sub-2)", marginTop: 7 }}>
              {/* ★注記は explanation に含まれている。分けて描かない */}
              <span style={{ whiteSpace: "pre-wrap" }}>{v.enforceability.explanation}</span>
            </p>
          )}
        </div>
      )}

      {/* ★取り決めではないが、了承したもの。ここにだけ載る */}
      {(v.arrangements ?? []).slice(0, 3).map((a) => (
        <div key={a.id} style={{ padding: "9px 0", borderTop: "1px solid var(--border-subtle)" }}>
          <span style={{ fontSize: 13 }}>
            {md(a.date)} ／ {a.label}
          </span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--text-sub)" }}>
            お約束として控えています
          </span>
        </div>
      ))}

      {v.rows.slice(0, 4).map((r) => (
        <div
          key={r.key}
          className="flex items-center justify-between gap-2"
          style={{ padding: "9px 0", borderTop: "1px solid var(--border-subtle)" }}
        >
          <div className="min-w-0">
            <span style={{ fontSize: 13 }}>
              {/* ★面会交流には金額が無い。無いものを 0 と書かない */}
              {md(r.dueDate)} ／{" "}
              {typeof r.amountYen === "number"
                ? `${r.amountYen.toLocaleString()}円`
                : TOPIC_LABEL[r.topic] ?? "お約束"}
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
      {/* ★「今回だけ第3土曜に変更（本来は第2土曜）」が分かる表示。
             ONE_TIME を保存していたのに、画面に出る経路がどこにも無かった。 */}
      {(v.exceptions ?? []).length > 0 && (
        <div
          className="mt-2"
          style={{ borderTop: "1px dashed var(--border-dashed)", paddingTop: 9 }}
        >
          {v.exceptions.map((e) => {
            const d = describeChange({}, e.change);
            const to = d.changed.map((c) => `${c.label} ${c.to}`).join("、");
            if (!to) return null;
            return (
              <p
                key={e.id}
                style={{ fontSize: 11.5, lineHeight: 1.85, color: "var(--attention-text)" }}
              >
                今回だけ {to} に変更（{TOPIC_LABEL[e.topic] ?? "取り決め"}）
              </p>
            );
          })}
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            取り決めそのものは変わっていません。
          </p>
        </div>
      )}
    </div>
  );
}
