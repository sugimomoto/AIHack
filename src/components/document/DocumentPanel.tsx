"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 公正証書原案
 *
 * ★注意書きを常時表示する。
 *   「原案である」ことを消せると、確定文書と誤認される。
 *
 * ★条項を編集できるようにしない。
 *   編集できると、ひな形である意味が消える。
 */

type Result =
  | { ok: true; document: { clauses: { number: number; title: string; body: string }[]; notice: string } }
  | { ok: false; reason: "INCOMPLETE"; templateId: string; missing: string[] };

const LABEL: Record<string, string> = {
  monthlyAmount: "月額",
  payDay: "支払日",
  until: "支払いの終期",
  frequency: "頻度",
  timeRange: "時間帯",
  handoverPlace: "受け渡し場所",
};

export function DocumentPanel({
  caseId,
  partyId,
  reloadKey,
}: {
  caseId: string;
  partyId: string;
  reloadKey?: number;
}) {
  const [r, setR] = useState<Result | null>(null);

  const fetchDoc = useCallback(async (): Promise<Result | null> => {
    const res = await fetch(`/api/cases/${caseId}/document`, {
      headers: { "x-dev-party": partyId },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as Result) : null;
  }, [caseId, partyId]);

  useEffect(() => {
    let alive = true;
    void fetchDoc().then((v) => {
      if (alive && v) setR(v);
    });
    return () => {
      alive = false;
    };
  }, [fetchDoc, reloadKey]);

  if (!r) return null;

  if (!r.ok) {
    return (
      <Frame>
        <p style={{ fontSize: 12.5, lineHeight: 1.9, color: "var(--attention-text)" }}>
          あと{r.missing.length}つ決まると、原案をお作りできます。
        </p>
        <ul style={{ fontSize: 12.5, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 6 }}>
          {r.missing.map((m) => (
            <li key={m}>・{LABEL[m] ?? m}</li>
          ))}
        </ul>
      </Frame>
    );
  }

  if (r.document.clauses.length === 0) {
    return (
      <Frame>
        <p style={{ fontSize: 12.5, lineHeight: 1.9, color: "var(--text-sub)" }}>
          合意できた事項が増えると、ここに原案が現れます。
        </p>
      </Frame>
    );
  }

  return (
    <Frame>
      {/* ★注意書きは常時表示。消せない */}
      <p
        style={{
          fontSize: 11.5,
          lineHeight: 1.85,
          color: "var(--attention-text)",
          background: "var(--attention-bg)",
          border: "1px solid var(--attention)",
          borderRadius: "var(--r-sm)",
          padding: "8px 10px",
          marginBottom: 10,
        }}
      >
        ⚠️ {r.document.notice}
      </p>

      {r.document.clauses.map((c) => (
        <div key={c.number} style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 600 }}>
            第{c.number}条（{c.title}）
          </p>
          <p style={{ fontSize: 12.5, lineHeight: 2.0, whiteSpace: "pre-wrap", marginTop: 4 }}>{c.body}</p>
        </div>
      ))}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="shrink-0 px-4 py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>公正証書の原案</p>
      {children}
    </div>
  );
}
