"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * AIに渡しているもの
 *
 * ★この設計の要点は「防ぐ」ではなく「持っていない」である。
 *   **見せられること自体が、その証明になる。**
 *
 * ★buildContext の戻り値をそのまま描く。
 *   ここで整形すると、見せているものと渡しているものがずれる。
 */
type Ctx = Record<string, unknown>;

const ABSENT = [
  "お相手が書いた文章",
  "お相手のお名前",
  "お相手のご住所・電話番号・勤務先",
  "お相手の精密な年収",
  "お相手とAIのやりとり",
];

export function ContextView({ caseId, partyId }: { caseId: string; partyId: string }) {
  const [c, setC] = useState<Ctx | null>(null);
  const [err, setErr] = useState(false);

  const fetchCtx = useCallback(async () => {
    const r = await fetch(`/api/cases/${caseId}/context`, {
      headers: { "x-dev-party": partyId },
      cache: "no-store",
    });
    return r.ok ? ((await r.json()) as { context: Ctx }).context : null;
  }, [caseId, partyId]);

  useEffect(() => {
    let alive = true;
    void fetchCtx().then((v) => {
      if (!alive) return;
      if (v) setC(v);
      else setErr(true);
    });
    return () => {
      alive = false;
    };
  }, [fetchCtx]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 pb-8 pt-6">
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>AIに渡しているもの</h1>
      <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 8 }}>
        この画面は、いまAIに渡している内容をそのまま表示しています。加工していません。
      </p>

      <section
        className="mt-4"
        style={{
          background: "var(--agree-bg)",
          border: "1px solid var(--agree)",
          borderRadius: "var(--r-md)",
          padding: 14,
        }}
      >
        <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agree-text)" }}>
          ここに入っていないもの
        </p>
        <ul style={{ fontSize: 12.5, lineHeight: 2.0, color: "var(--text-sub-2)", marginTop: 6 }}>
          {ABSENT.map((t) => (
            <li key={t}>・{t}</li>
          ))}
        </ul>
        <p style={{ fontSize: 11.5, lineHeight: 1.85, color: "var(--text-sub-2)", marginTop: 8 }}>
          これらは「見せない」のではなく、<strong>そもそも渡していません。</strong>
          AIに尋ねても答えられません。持っていないからです。
        </p>
      </section>

      {err && (
        <p style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 16 }}>
          読み込めませんでした。ログインが必要です。
        </p>
      )}

      {c && (
        <pre
          className="mt-4 overflow-x-auto"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: 14,
            fontSize: 11.5,
            lineHeight: 1.8,
          }}
        >
          {JSON.stringify(c, null, 2)}
        </pre>
      )}
    </div>
  );
}
