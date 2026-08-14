"use client";

import { useCallback, useEffect, useState } from "react";
import { changeSummary } from "@/domain/agreement/fields";
import { EmptyUpcoming } from "@/components/ui/EmptyState";
import { TOPIC_LABEL } from "@/domain/agreement/topics";

/**
 * 決まったこと（旧「これから」）
 *
 * ★★ 引き算だけ。新しい要素は無い。
 *
 *   外したもの：
 *     ・毎月の支払日・会う日   … 予定を管理しない
 *     ・履行の記録             … **手間で押されない。**押されないと
 *                                「確認できていません」と出て、
 *                                実際は払っているのに疑いが立つ
 *     ・逸脱の検知・先取特権   … 上に伴い出番が消える
 *     ・リマインド             … **督促になる**
 *
 *   > 記録率が低い台帳は、正しい信号より誤った信号を多く出す。
 *
 * ★「お約束として控えています」は、済んだかどうかを問わない書き方である。
 *   押されないボタンを置かない代わりに、**状態を持たない文**にしてある。
 *
 * @see .steering/20260812-feedback-pivot/design-upcoming.md
 */

type View = {
  /** 了承された個別の約束（L2）。★公正証書には載らない */
  arrangements: { id: string; date: string; label: string }[];
  /** 今回だけの変更。★取り決めは変わっていない */
  exceptions: { id: string; topic: string; change: Record<string, unknown> }[];
};

const md = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`;

export function DecidedPanel({
  caseId,
  partyId,
  reloadKey,
}: {
  caseId: string;
  partyId: string;
  reloadKey?: number;
}) {
  const [v, setV] = useState<View | null>(null);

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

  if (!v) return null;

  const empty = v.arrangements.length === 0 && v.exceptions.length === 0;
  if (empty) return <EmptyUpcoming />;

  return (
    <div className="px-5 pb-10 pt-6">
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>決まったこと</h1>
      <p style={{ fontSize: 12.5, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 6 }}>
        お話し合いで決まったことの控えです。
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {v.arrangements.map((a) => (
          <div
            key={a.id}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              padding: "13px 15px",
            }}
          >
            <p style={{ fontSize: 12, color: "var(--text-sub)" }}>{md(a.date)}</p>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span style={{ fontSize: 14.5 }}>{a.label}</span>
              {/* ★済んだかどうかを問わない。状態を持たない文 */}
              <span style={{ fontSize: 11.5, color: "var(--text-sub)", whiteSpace: "nowrap" }}>
                お約束として控えています
              </span>
            </div>
          </div>
        ))}
      </div>

      {v.exceptions.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {v.exceptions.map((e) => (
            <div
              key={e.id}
              style={{
                background: "var(--surface-2)",
                borderRadius: "var(--r-md)",
                padding: "13px 15px",
              }}
            >
              <p style={{ fontSize: 14 }}>今回だけ　{changeSummary(e.topic, e.change)}</p>
              <p style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 3 }}>
                {TOPIC_LABEL[e.topic as keyof typeof TOPIC_LABEL] ?? e.topic}
              </p>
              <p
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.9,
                  color: "var(--text-sub-2)",
                  marginTop: 8,
                  borderTop: "1px dashed var(--border-dashed)",
                  paddingTop: 8,
                }}
              >
                取り決めそのものは変わっていません。
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ★タブが隣り合うので必須 */}
      <p
        style={{
          fontSize: 11.5,
          lineHeight: 1.95,
          color: "var(--text-sub-2)",
          marginTop: 16,
          borderTop: "1px dashed var(--border-dashed)",
          paddingTop: 10,
        }}
      >
        公正証書に入るのは「取り決め」のほうです。ここにあるのは、その回だけのお約束です。
      </p>
    </div>
  );
}
