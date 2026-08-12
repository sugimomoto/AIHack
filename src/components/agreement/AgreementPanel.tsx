"use client";

import { useCallback, useEffect, useState } from "react";
import { AgreementMoment } from "./AgreementMoment";
import { RevisionRequestForm } from "./RevisionRequestForm";

/**
 * 合意の状況
 *
 * ★算定表の提示は LLM を通していない（P3）。
 *   未検証の表を使っている場合、注記が必ず含まれる。
 */

type View = {
  ready: boolean;
  proposals: { isOwn: boolean; payload: Record<string, unknown> | null }[];
  draft: { rangeText: string | null; explanation: string; unverified: boolean } | null;
  converged: boolean;
  state: "WAITING_BOTH" | "WAITING_OTHER" | "NEEDS_CONVERGENCE" | "AGREED" | "REJECTED";
  ownConsent: "PENDING" | "ACCEPTED" | "REJECTED";
  /** ★N-1：成立した取り決め */
  agreement: { payload: Record<string, unknown>; agreedAt: string } | null;
};

const STATE_LABEL: Record<View["state"], string> = {
  WAITING_BOTH: "おふたりのご意向を待っています",
  WAITING_OTHER: "お相手のご意向を待っています",
  NEEDS_CONVERGENCE: "内容がまだ揃っていません",
  AGREED: "合意しました",
  REJECTED: "見直しが必要です",
};

const TOPIC_LABEL: Record<string, string> = {
  CHILD_SUPPORT: "養育費",
  VISITATION: "面会交流",
};

export function AgreementPanel({
  caseId,
  partyId,
  topic = "CHILD_SUPPORT",
  reloadKey,
  onChanged,
}: {
  caseId: string;
  partyId: string;
  /** ★養育費に固定していた。**面会交流には画面が一つも無かった。** */
  topic?: string;
  reloadKey?: number;
  onChanged?: () => void;
}) {
  const [v, setV] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  const fetchView = useCallback(async (): Promise<View | null> => {
    const res = await fetch(`/api/cases/${caseId}/agreement?topic=${topic}`, {
      headers: { "x-dev-party": partyId },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as View) : null;
  }, [caseId, partyId, topic]);

  useEffect(() => {
    let alive = true;
    void fetchView().then((r) => {
      if (alive && r) setV(r);
    });
    return () => {
      alive = false;
    };
  }, [fetchView, reloadKey]);

  const consent = async (status: "ACCEPTED" | "REJECTED") => {
    setBusy(true);
    try {
      await fetch(`/api/cases/${caseId}/agreement`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-dev-party": partyId },
        body: JSON.stringify({ topic, status }),
      });
      const r = await fetchView();
      if (r) setV(r);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  if (!v) return null;

  // ★高さの制限は、3つのパネルをまとめる側で持つ（app/page.tsx）。
  //   パネルごとに上限を持たせていたため、合計が枠を超えて対話の高さが 0 になっていた。
  return (
    <div
      className="shrink-0 px-4 py-3"
      style={{ borderTop: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{TOPIC_LABEL[topic] ?? "取り決め"}</span>
        <span
          style={{
            fontSize: 11.5,
            color: v.state === "AGREED" ? "var(--agree-text)" : "var(--text-sub)",
          }}
        >
          {STATE_LABEL[v.state]}
        </span>
      </div>

      {/* ★N-1：決まったものは、いちばん上に静かに置く。
             祝わない。上下に線が1本ずつ引かれて、その中に内容が置かれるだけ。 */}
      {v.agreement && (
        <div className="mt-3">
          <AgreementMoment
            payload={v.agreement.payload}
            agreedOn={v.agreement.agreedAt}
            topic={topic}
          />
        </div>
      )}

      {/* ★算定表があるのは養育費だけ。
             面会交流に「算定表の目安」と書くと、存在しない表を約束することになる。 */}
      {!v.ready && !v.agreement && (
        <p style={{ fontSize: 12, lineHeight: 1.85, color: "var(--text-sub)", marginTop: 6 }}>
          {topic === "CHILD_SUPPORT"
            ? "おふたりのご提案が揃うと、算定表の目安をお示しします。"
            : "おふたりのご意向が揃うと、ここに内容が並びます。"}
        </p>
      )}

      {/* ★決まったあとに目安を出し続けない。決まったものが基準である */}
      {v.draft && !v.agreement && (
        <div
          className="mt-2.5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: 12,
          }}
        >
          {/* ★算定表の提示。LLM を通していない */}
          {v.draft.rangeText && (
            <p style={{ fontSize: 12.5, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{v.draft.rangeText}</p>
          )}
          <p
            style={{
              fontSize: 12.5,
              lineHeight: 1.9,
              color: "var(--text-sub-2)",
              marginTop: v.draft.rangeText ? 10 : 0,
              paddingTop: v.draft.rangeText ? 10 : 0,
              borderTop: v.draft.rangeText ? "1px dashed var(--border-dashed)" : undefined,
            }}
          >
            {v.draft.explanation}
          </p>
        </div>
      )}

      {/* ★提案が一致していないときは承諾させない。
             何に承諾したのかが定まらないまま合意にすると、
             誰も合意していない内容が確定する。 */}
      {v.ready && !v.converged && (
        <p style={{ fontSize: 12, lineHeight: 1.85, color: "var(--attention-text)", marginTop: 8 }}>
          おふたりのご提案の内容が異なっています。同じ内容になったときに、お進みいただけます。
        </p>
      )}

      {v.ready && v.converged && v.state !== "AGREED" && (
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            disabled={busy || v.ownConsent === "ACCEPTED"}
            onClick={() => void consent("ACCEPTED")}
            className="flex-1 rounded-full disabled:opacity-40"
            style={{
              border: "1px solid var(--agree)",
              background: "var(--agree-bg)",
              color: "var(--agree-text)",
              minHeight: 40,
              fontSize: 13.5,
              fontWeight: 600,
            }}
          >
            {v.ownConsent === "ACCEPTED" ? "承諾済み" : "この内容で進める"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void consent("REJECTED")}
            className="rounded-full px-4 disabled:opacity-40"
            style={{ border: "1px solid var(--border-strong)", minHeight: 40, fontSize: 13.5 }}
          >
            まだ決めない
          </button>
        </div>
      )}

      {/* ★「変更を申し出る」を目立たせない。
             一度決まったものを動かす操作を、勧める形にしない。 */}
      {v.agreement && (
        <div className="mt-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => setAsking(true)}
            style={{ fontSize: 12.5, color: "var(--text-sub)", textDecoration: "underline" }}
          >
            変更を申し出る
          </button>
          <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 6 }}>
            変更には、お相手の同意が必要です。
          </p>
        </div>
      )}

      {asking && v.agreement && (
        <RevisionRequestForm
          caseId={caseId}
          partyId={partyId}
          topic={topic}
          current={v.agreement.payload}
          onDone={() => {
            setAsking(false);
            void fetchView().then((r) => r && setV(r));
            onChanged?.();
          }}
          onCancel={() => setAsking(false)}
        />
      )}
    </div>
  );
}
