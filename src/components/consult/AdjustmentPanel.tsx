"use client";

import { useEffect, useState } from "react";
import { ADJUSTMENT_LABEL, ADJUSTMENT_NOTE, type AdjustmentState } from "@/domain/adjustment/record";
import { describeChange } from "@/domain/adjustment/revision";

/**
 * 調整（ADJUSTMENT の相談の帰結）
 *
 * ★設計は kind=ADJUSTMENT の帰結を「Adjustment を作る」と決めていた。
 *   行き先が無かったため、養育費への提案になっていた。
 *
 * ★公正証書には載らない。取り決めにも触れない。**それを画面に書く。**
 *   書かないと、条項になると思ってしまう。
 */
type View = {
  state: AdjustmentState;
  ownChange: Record<string, unknown> | null;
  agreedChange: Record<string, unknown> | null;
};

export function AdjustmentPanel({
  caseId,
  partyId,
  threadId,
  reloadKey,
}: {
  caseId: string;
  partyId: string;
  threadId: string;
  reloadKey?: number;
}) {
  const [v, setV] = useState<View | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/cases/${caseId}/adjustment?threadId=${encodeURIComponent(threadId)}`, {
      headers: { "x-dev-party": partyId },
      cache: "no-store",
    })
      .then((r) => (r.ok ? (r.json() as Promise<View>) : null))
      .then((r) => alive && r && setV(r));
    return () => {
      alive = false;
    };
  }, [caseId, partyId, threadId, reloadKey]);

  // ★まだ何も出していないうちは、枠を出さない
  if (!v || !v.ownChange) return null;

  const shown = v.agreedChange ?? v.ownChange;
  const rows = describeChange({}, shown).changed;

  return (
    <div
      className="shrink-0 px-4 py-3"
      style={{ borderTop: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>お話し合いの内容</span>
        <span
          style={{
            fontSize: 11.5,
            color: v.state === "AGREED" ? "var(--agree-text)" : "var(--text-sub)",
          }}
        >
          {ADJUSTMENT_LABEL[v.state]}
        </span>
      </div>

      {rows.length > 0 && (
        <div
          className="mt-2"
          style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: 12 }}
        >
          {rows.map((c) => (
            <div key={c.key} className="flex items-baseline justify-between gap-3 py-0.5">
              <span style={{ fontSize: 12, color: "var(--text-sub)" }}>{c.label}</span>
              <span
                style={{
                  fontSize: 13.5,
                  color: v.state === "AGREED" ? "var(--agree-text)" : "var(--text)",
                }}
              >
                {c.to}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ★条項になると思わせない */}
      <p style={{ fontSize: 11, lineHeight: 1.9, color: "var(--muted)", marginTop: 8 }}>
        {ADJUSTMENT_NOTE}
      </p>
    </div>
  );
}
