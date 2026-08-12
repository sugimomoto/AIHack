"use client";

import { useState } from "react";
import { OnboardingProgress } from "./OnboardingProgress";
import {
  LIVING_ARRANGEMENTS,
  LIVING_LABEL,
  LIVING_PURPOSE_NOTE,
  type LivingArrangement,
} from "@/domain/case/living";

/**
 * I-2 同居
 *
 * ★破線の注記を1行だけ添える。用途をその一点に限る。
 * ★「あとで答える」を残す。答えないと進めない形にしない。
 */
export function LivingChoice({ caseId, next }: { caseId: string; next: string }) {
  const [busy, setBusy] = useState(false);

  const send = async (living: LivingArrangement | null) => {
    if (busy) return;
    setBusy(true);
    try {
      if (living) {
        await fetch(`/api/cases/${caseId}/living`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ living }),
        });
      }
      window.location.href = next;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 pb-8 pt-10">
      <OnboardingProgress step={2} />

      <h1 style={{ fontSize: 18, fontWeight: 600, marginTop: 20 }}>
        お子さんと、一緒に暮らしていらっしゃいますか。
      </h1>

      <div className="mt-5 flex flex-col gap-2.5">
        {LIVING_ARRANGEMENTS.map((l) => (
          <button
            key={l}
            type="button"
            disabled={busy}
            onClick={() => void send(l)}
            className="disabled:opacity-50"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--r-full)",
              minHeight: 52,
              fontSize: 15,
            }}
          >
            {LIVING_LABEL[l]}
          </button>
        ))}
      </div>

      {/* ★用途を限定して明示する。監護者の指定と読まれないために */}
      <div
        className="mt-6"
        style={{
          border: "1px dashed var(--border-strong)",
          borderRadius: "var(--r-md)",
          padding: 14,
        }}
      >
        <p style={{ fontSize: 12, lineHeight: 1.95, color: "var(--text-sub)" }}>
          {LIVING_PURPOSE_NOTE}
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void send(null)}
        className="mt-6 disabled:opacity-50"
        style={{ fontSize: 13, color: "var(--text-sub)", textDecoration: "underline" }}
      >
        あとで答える
      </button>
    </div>
  );
}
