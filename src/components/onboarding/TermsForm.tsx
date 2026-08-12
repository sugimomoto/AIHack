"use client";

import { useState } from "react";

/**
 * すでにある取り決めの入力
 *
 * ★お相手の確認を求めない。
 *   記録すること自体を、その人の意思表示とみなす。
 *   お相手も同じ内容を記録したときに、はじめて合意になる。
 *
 * ★AIを通さない。書いた数字がそのまま記録される。
 */
const PAY_DAY = [
  ["DAY_25", "毎月25日"],
  ["LAST_DAY", "毎月末日"],
  ["DAY_5", "毎月5日"],
  ["DAY_10", "毎月10日"],
] as const;

const UNTIL = [
  ["AGE_20", "20歳"],
  ["AGE_18", "18歳"],
  ["AGE_22_MARCH", "22歳に達した後の最初の3月"],
  ["GRADUATION", "大学等を卒業する月"],
] as const;

const field: React.CSSProperties = {
  background: "var(--surface-2)",
  borderRadius: "var(--r-sm)",
  padding: "11px 13px",
  minHeight: 44,
  fontSize: 14,
  width: "100%",
};

export function TermsForm({ caseId }: { caseId: string }) {
  const [amount, setAmount] = useState("");
  const [payDay, setPayDay] = useState<string>("DAY_25");
  const [until, setUntil] = useState<string>("AGE_20");
  const [busy, setBusy] = useState(false);

  const yen = Number(amount.replace(/[^0-9]/g, ""));
  const valid = amount !== "" && Number.isFinite(yen) && yen > 0;

  const submit = async (skip = false) => {
    if (busy) return;
    setBusy(true);
    try {
      if (!skip && valid) {
        await fetch(`/api/cases/${caseId}/terms`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            topic: "CHILD_SUPPORT",
            payload: { monthlyAmount: yen, payDay, until },
          }),
        });
      }
      window.location.href = "/onboarding/invite";
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 pb-8 pt-8">
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>いまの取り決め</h1>
      <p style={{ fontSize: 13, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 8 }}>
        すでに決まっている内容を入れておくと、支払いの予定や記録に使えます。
      </p>
      <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--text-sub-2)", marginTop: 8 }}>
        お相手に確認を求めることはありません。お相手が同じ内容を記録されたときに、合意として扱われます。
      </p>

      <p style={{ fontSize: 13.5, fontWeight: 600, marginTop: 22 }}>養育費</p>

      <label style={{ fontSize: 12.5, color: "var(--text-sub)", display: "block", marginTop: 12 }}>
        月額
        <input
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="30000"
          className="mt-1.5"
          style={field}
        />
      </label>

      <label style={{ fontSize: 12.5, color: "var(--text-sub)", display: "block", marginTop: 12 }}>
        支払日
        <select value={payDay} onChange={(e) => setPayDay(e.target.value)} className="mt-1.5" style={field}>
          {PAY_DAY.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label style={{ fontSize: 12.5, color: "var(--text-sub)", display: "block", marginTop: 12 }}>
        いつまで
        <select value={until} onChange={(e) => setUntil(e.target.value)} className="mt-1.5" style={field}>
          {UNTIL.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        disabled={!valid || busy}
        onClick={() => void submit()}
        className="mt-6 w-full disabled:opacity-45"
        style={{
          background: "var(--agree-bg)",
          border: "1px solid var(--agree)",
          borderRadius: "var(--r-full)",
          minHeight: 50,
          fontSize: 15,
          fontWeight: 600,
          color: "var(--agree-text)",
        }}
      >
        記録して次へ
      </button>

      {/* ★決まっていない人もいる。飛ばせるようにする */}
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit(true)}
        className="mt-3 w-full"
        style={{ fontSize: 13.5, color: "var(--text-sub)", minHeight: 44 }}
      >
        あとで入れる
      </button>
    </div>
  );
}
