"use client";

import { useState } from "react";
import { type Field, displayValue, visibleFields } from "@/domain/agreement/fields";

/**
 * 取り決めの入力
 *
 * ★フォームを詰問にしない4つ（デザイン第4弾）
 *
 *   1. 飛ばせることを、先に見せる  … 見出しの右に「あとでも」を常時置く
 *   2. 必須の印を持たない          … アスタリスクも「必須」ラベルも使わない
 *   3. 進捗を出さない              … 1/4 も ○% も出さない
 *   4. 空欄を欠落として描かない    … 破線の下線と「—」。赤も感嘆符も使わない
 *
 * ★AI を通さない。書いた値がそのまま記録される（P3）。
 */

const inputStyle: React.CSSProperties = {
  background: "var(--surface-2)",
  borderRadius: "var(--r-sm)",
  padding: "11px 13px",
  minHeight: 44,
  fontSize: 14,
  width: "100%",
  border: "1px solid var(--border-subtle)",
};

function FieldRow({
  f,
  value,
  onChange,
}: {
  f: Field;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const filled = value !== undefined && value !== null && value !== "";

  return (
    <div className="mt-3.5">
      <div className="flex items-baseline justify-between">
        <span style={{ fontSize: 12.5, color: "var(--text-sub)" }}>{f.label}</span>
        {/* ★飛ばせることを、入力してから分かるのでは遅い */}
        <span style={{ fontSize: 11.5, color: "var(--text-sub)" }}>あとでも</span>
      </div>

      {f.kind === "CHOICE" ? (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {f.options!.map(([v, label]) => {
            const on = String(value ?? "") === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => onChange(on ? "" : v)}
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
                {label}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          inputMode={f.kind === "AMOUNT" ? "numeric" : "text"}
          type={f.kind === "DATE" ? "date" : "text"}
          value={String(value ?? "")}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5"
          style={inputStyle}
        />
      )}

      {/* ★空欄を欠落として描かない。破線の下線と「—」。赤も感嘆符も使わない */}
      {!filled && (
        <p
          className="mt-1.5"
          style={{
            fontSize: 11.5,
            color: "var(--muted)",
            borderBottom: "1px dashed var(--border-dashed)",
            paddingBottom: 4,
          }}
        >
          —
        </p>
      )}
    </div>
  );
}

export function TopicForm({
  topic,
  initial,
  busy,
  onSave,
  intro,
}: {
  topic: string;
  initial?: Record<string, unknown> | null;
  busy?: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  /** ★論点ごとの前置き（年金分割・財産分与） */
  intro?: React.ReactNode;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({ ...(initial ?? {}) });

  const fields = visibleFields(topic, values);
  const filled = fields.filter((f) => {
    const v = values[f.key];
    return v !== undefined && v !== null && v !== "";
  });

  const payload = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.key];
      if (v === undefined || v === null || v === "") continue;
      // ★数値は数値として記録する。文字列のまま入れると条項で桁区切りが効かない
      out[f.key] = f.kind === "AMOUNT" ? Number(String(v).replace(/[^0-9]/g, "")) : v;
    }
    return out;
  };

  // ★押せないのではなく、まだ押す段階でないという見え方にする
  const ready = filled.length > 0;

  return (
    <div>
      {intro}

      {fields.map((f) => (
        <FieldRow
          key={f.key}
          f={f}
          value={values[f.key]}
          onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
        />
      ))}

      <button
        type="button"
        disabled={!ready || busy}
        onClick={() => onSave(payload())}
        className="mt-6 w-full"
        style={{
          background: ready ? "var(--agree-bg)" : "var(--surface-2)",
          border: `1px solid ${ready ? "var(--agree)" : "var(--border-subtle)"}`,
          borderRadius: "var(--r-full)",
          minHeight: 50,
          fontSize: 15,
          fontWeight: 600,
          color: ready ? "var(--agree-text)" : "var(--muted)",
        }}
      >
        下書きにする
      </button>

      <p
        style={{
          fontSize: 11.5,
          lineHeight: 1.95,
          color: "var(--text-sub-2)",
          marginTop: 12,
          borderTop: "1px dashed var(--border-dashed)",
          paddingTop: 10,
        }}
      >
        書けるところだけで、かまいません。あとから何度でも書き直せます。
      </p>
    </div>
  );
}

/** 内容の再掲。★フォームと同じ定義から作る（ずれない） */
export function Recap({
  topic,
  payload,
}: {
  topic: string;
  payload: Record<string, unknown>;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "13px 15px",
      }}
    >
      {visibleFields(topic, payload).map((f, i) => {
        const v = displayValue(f, payload[f.key]);
        if (v === null) return null;
        return (
          <div
            key={f.key}
            className="flex items-baseline justify-between"
            style={{ marginTop: i === 0 ? 0 : 9 }}
          >
            <span style={{ fontSize: 12, color: "var(--text-sub)" }}>{f.label}</span>
            <span style={{ fontSize: i === 0 ? 17 : 14, fontWeight: i === 0 ? 600 : 400 }}>{v}</span>
          </div>
        );
      })}
    </div>
  );
}
