"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { REVISION_CHOICES, REVISION_PENDING_NOTE } from "@/domain/adjustment/revision";

/**
 * K-6 変更申請を受ける側
 *
 * ★3つの選択肢をすべて同じ見た目にする。
 *   **法的合意の変更なので、「よい」を強調した時点でダークパターンになる。**
 *
 * ★何が変わって何が変わらないかを、言葉で足す。
 *   条文の差分を目で追わせない。
 *
 * ★返事をしないあいだは現状が続くことを明示する。
 *   放置が不利にならないと分かって、はじめて落ち着いて選べる。
 */
type View = {
  pending?: false;
  isOwn: boolean;
  reason: string | null;
  description: {
    changed: { key: string; label: string; from: string; to: string }[];
    unchanged: string[];
    sentence: string;
  };
};

const TOPIC_LABEL: Record<string, string> = {
  CHILD_SUPPORT: "養育費",
  VISITATION: "面会交流",
};

export function RevisionSheet({
  caseId,
  partyId,
  topic = "CHILD_SUPPORT",
  onChanged,
}: {
  caseId: string;
  partyId: string;
  topic?: string;
  onChanged?: () => void;
}) {
  const [v, setV] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}/revision?topic=${topic}`, {
      headers: { "x-dev-party": partyId },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as View;
    return j.pending === false ? null : j;
  }, [caseId, partyId, topic]);

  useEffect(() => {
    let alive = true;
    void load().then((r) => alive && setV(r));
    return () => {
      alive = false;
    };
  }, [load]);

  // ★申し出た本人には出さない。自分の申し出に自分で同意させない
  if (!v || v.isOwn) return null;

  const respond = async (action: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/cases/${caseId}/revision`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-dev-party": partyId },
        body: JSON.stringify({ topic, action }),
      });
      setV(null);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      {/* ★背後の会話は消さない。いまの話の続きであることを保つ */}
      <div style={{ position: "absolute", inset: 0, background: "var(--bg)", opacity: 0.65 }} />

      <div
        className="anim-msg-in relative overflow-y-auto px-5 pb-6 pt-5"
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: "88%",
        }}
      >
        <div className="flex gap-3">
          <Image
            src="/character/capybara-sit.png"
            alt=""
            width={30}
            height={30}
            style={{ width: 30, height: 30, flexShrink: 0 }} />
          <div className="min-w-0">
            <p style={{ fontSize: 13.5, lineHeight: 1.95 }}>
              {TOPIC_LABEL[topic] ?? "取り決め"}の取り決めを、変えたいというご相談です。
            </p>
            {/* ★理由は取次ぎの検査を通ったものだけ。通らなければ何も出さない */}
            {v.reason && (
              <p style={{ fontSize: 13, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 6 }}>
                背景として、{v.reason}
              </p>
            )}
          </div>
        </div>

        <div
          className="mt-4"
          style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: 14 }}
        >
          {v.description.changed.map((c) => (
            <div key={c.key} className="flex items-baseline justify-between gap-3 py-1">
              <span style={{ fontSize: 12, color: "var(--text-sub)" }}>{c.label}</span>
              <span style={{ fontSize: 13.5 }}>
                <span style={{ color: "var(--muted)" }}>{c.from}</span>
                <span style={{ color: "var(--muted)", margin: "0 6px" }}>→</span>
                <span style={{ color: "var(--agree-text)", fontWeight: 600 }}>{c.to}</span>
              </span>
            </div>
          ))}
        </div>

        {/* ★条文の差分を目で追わせない */}
        {v.description.sentence && (
          <p style={{ fontSize: 12.5, lineHeight: 1.95, marginTop: 12 }}>
            {v.description.sentence}
          </p>
        )}

        {/* ★3つとも同じ見た目。「よい」を強調しない */}
        <div className="mt-5 flex flex-col gap-2.5">
          {REVISION_CHOICES.map((c) => (
            <button
              key={c.action}
              type="button"
              disabled={busy}
              onClick={() => void respond(c.action)}
              className="disabled:opacity-50"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--r-full)",
                minHeight: 50,
                fontSize: 14.5,
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* ★放置が不利にならないと分かって、はじめて落ち着いて選べる */}
        <p style={{ fontSize: 11.5, lineHeight: 1.95, color: "var(--muted)", marginTop: 14 }}>
          {REVISION_PENDING_NOTE}
        </p>
      </div>
    </div>
  );
}
