"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RULE_NOTE,
  RULE_SHARE_CAVEAT,
  RULE_STATE_LABEL,
  RULE_TITLE,
  SHARES,
  THRESHOLDS,
  describeRule,
  type RuleKind,
  type RuleState,
} from "@/domain/rule/houseRule";

/**
 * おふたりで決めたこと
 *
 * ★公正証書には入らない。**当事者が自分で決めて、自分で直す。**
 *
 * ★片方が選んだだけでは決まらない。
 *   「決まったこと」という題である以上、
 *   **一方の理解が決まったこととして並ぶのは誤りである。**
 *
 * ★選択肢だけ。自由記述にしない。
 *   自由記述にすると、**書いた言葉がそのまま相手に渡る**ことになる（C1）。
 */

type Item = {
  kind: RuleKind;
  state: RuleState;
  ownValue: Record<string, unknown> | null;
  agreedValue: Record<string, unknown> | null;
};

export function HouseRules({
  caseId,
  partyId,
  reloadKey,
}: {
  caseId: string;
  partyId: string;
  reloadKey?: number;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<RuleKind | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchItems = useCallback(async (): Promise<Item[] | null> => {
    const res = await fetch(`/api/cases/${caseId}/rules`, {
      headers: { "x-dev-party": partyId },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as { items: Item[] }).items : null;
  }, [caseId, partyId]);

  useEffect(() => {
    let alive = true;
    void fetchItems().then((r) => {
      if (alive && r) setItems(r);
    });
    return () => {
      alive = false;
    };
  }, [fetchItems, reloadKey]);

  const save = async (kind: RuleKind, thresholdYen: number, share: string) => {
    setBusy(true);
    try {
      await fetch(`/api/cases/${caseId}/rules`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-dev-party": partyId },
        body: JSON.stringify({ kind, thresholdYen, share }),
      });
      setEditing(null);
      const r = await fetchItems();
      if (r) setItems(r);
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <p style={{ fontSize: 13.5, fontWeight: 600 }}>おふたりで決めたこと</p>

      <div className="mt-2.5 flex flex-col gap-2">
        {items.map((it) => (
          <div
            key={it.kind}
            style={{
              background: it.state === "AGREED" ? "var(--surface)" : "var(--surface-2)",
              border: `1px solid ${it.state === "AGREED" ? "var(--border)" : "var(--border-subtle)"}`,
              borderRadius: "var(--r-md)",
              padding: "13px 15px",
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ fontSize: 13.5 }}>{RULE_TITLE[it.kind]}</span>
              <span
                style={{
                  fontSize: 11.5,
                  color: it.state === "AGREED" ? "var(--agree-text)" : "var(--text-sub)",
                  whiteSpace: "nowrap",
                }}
              >
                {RULE_STATE_LABEL[it.state]}
              </span>
            </div>

            {/* ★揃ったものだけを、決まったこととして大きく出す */}
            {it.agreedValue && (
              <p style={{ fontSize: 15, lineHeight: 1.8, marginTop: 8 }}>
                {describeRule(it.kind, it.agreedValue)}
              </p>
            )}

            {/* ★揃っていないときは、自分が選んだものだけ。相手の案は見せない */}
            {!it.agreedValue && it.ownValue && (
              <p style={{ fontSize: 13.5, lineHeight: 1.8, marginTop: 8, color: "var(--text-sub)" }}>
                ご自身のお考え：{describeRule(it.kind, it.ownValue)}
              </p>
            )}

            {editing === it.kind ? (
              <Editor busy={busy} onPick={(t, sh) => void save(it.kind, t, sh)} onCancel={() => setEditing(null)} />
            ) : (
              <button
                type="button"
                onClick={() => setEditing(it.kind)}
                className="mt-2.5"
                style={{ fontSize: 12.5, color: "var(--text-sub)", textDecoration: "underline", minHeight: 36 }}
              >
                {it.ownValue ? "決め直す" : "決める"}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ★取り決めのタブが隣にある。書かないと混ざる */}
      <p
        style={{
          fontSize: 11.5,
          lineHeight: 1.95,
          color: "var(--text-sub-2)",
          marginTop: 10,
          borderTop: "1px dashed var(--border-dashed)",
          paddingTop: 10,
        }}
      >
        {RULE_NOTE}
      </p>
    </div>
  );
}

/** ★選択肢だけ。自由に書かせない */
function Editor({
  busy,
  onPick,
  onCancel,
}: {
  busy: boolean;
  onPick: (thresholdYen: number, share: string) => void;
  onCancel: () => void;
}) {
  const [threshold, setThreshold] = useState<string>("10000");
  const [share, setShare] = useState<string>("HALF");

  return (
    <div className="mt-3">
      <p style={{ fontSize: 12, color: "var(--text-sub)" }}>1件がこの額を超えたら</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {THRESHOLDS.map(([v, label]) => (
          <Chip key={v} on={threshold === v} onClick={() => setThreshold(v)}>
            {label}
          </Chip>
        ))}
      </div>

      <p style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 12 }}>どうしますか</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {SHARES.map(([v, label]) => (
          <Chip key={v} on={share === v} onClick={() => setShare(v)}>
            {label}
          </Chip>
        ))}
      </div>

      {/* ★渡す前に読める。取り決めと同じ作法 */}
      <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--text-sub-2)", marginTop: 12 }}>
        {RULE_SHARE_CAVEAT}
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => onPick(Number(threshold), share)}
        className="mt-3 w-full disabled:opacity-45"
        style={{
          background: "var(--agree-bg)",
          border: "1px solid var(--agree)",
          borderRadius: "var(--r-full)",
          minHeight: 46,
          fontSize: 14,
          fontWeight: 600,
          color: "var(--agree-text)",
        }}
      >
        これで記録する
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onCancel}
        className="mt-1.5 w-full"
        style={{ fontSize: 13, color: "var(--text-sub)", minHeight: 40 }}
      >
        やめる
      </button>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3.5"
      style={{
        border: on ? "1px solid var(--agree)" : "1px solid var(--border-strong)",
        background: on ? "var(--agree-bg)" : "var(--surface)",
        color: on ? "var(--agree-text)" : "var(--text)",
        minHeight: 40,
        fontSize: 13,
        fontWeight: on ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}
