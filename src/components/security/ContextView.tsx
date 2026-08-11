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
        AIへの依頼は用途ごとに分かれています。それぞれに何を渡しているかを、そのまま示します。
      </p>

      <section
        className="mt-3"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: 14,
        }}
      >
        <Line title="受け止め・意図分類" body="あなたが書いた文章のみ。お相手の情報は渡していません。" />
        <Line title="取次ぎの作成" body="あなたが書いた文章のみ。生成後、原文の混入を検査してから届きます。" />
        <Line
          title="調停案の作成"
          body="おふたりの提案の内容（金額など）と、算定表から取得した目安のみ。どちらの提案かは渡していません。"
        />
      </section>

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

      <p style={{ fontSize: 12.5, fontWeight: 600, marginTop: 18 }}>あなたの側に保持している情報</p>
      <p style={{ fontSize: 11.5, lineHeight: 1.85, color: "var(--text-sub-2)", marginTop: 4 }}>
        画面の表示に使うもので、そのすべてがAIに渡るわけではありません。
      </p>

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

function Line({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ padding: "8px 0", borderTop: "1px solid var(--border-subtle)" }}>
      <p style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</p>
      <p style={{ fontSize: 11.5, lineHeight: 1.85, color: "var(--text-sub-2)", marginTop: 3 }}>{body}</p>
    </div>
  );
}
