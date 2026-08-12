"use client";

import { useState } from "react";
import { REVISION_REASONS, reasonTextOf } from "@/domain/adjustment/revision";

/**
 * 変更を申し出る側
 *
 * ★申し出ても、いまの取り決めはそのまま続く。**それを先に書く。**
 *   「申し出たら今の取り決めが無くなるのでは」という不安があると、
 *   必要な変更を言い出せない。
 *
 * ★背景は自由記述にしない。
 *   自由記述を取次ぎの検査に通す実装を最初に書いたが、**必ず落ちた。**
 *   本人が書いた文を「原文と一致しないこと」で検査すれば、当然すべて落ちる。
 *   **書いたものが黙って消える経路を残さない。**
 *   越えてよいカテゴリから選ぶ形にし、相手に出る文をその場で見せる。
 */
const PAY_DAYS = [
  { code: "LAST_DAY", label: "毎月末日" },
  { code: "DAY_5", label: "毎月5日" },
  { code: "DAY_10", label: "毎月10日" },
  { code: "DAY_25", label: "毎月25日" },
];

export function RevisionRequestForm({
  caseId,
  partyId,
  current,
  onDone,
  onCancel,
}: {
  caseId: string;
  partyId: string;
  current: Record<string, unknown>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [payDay, setPayDay] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const change: Record<string, unknown> = {};
  const yen = Number(amount.replace(/[^0-9]/g, ""));
  if (amount !== "" && Number.isFinite(yen) && yen > 0 && yen !== current.monthlyAmount) {
    change.monthlyAmount = yen;
  }
  if (payDay && payDay !== current.payDay) change.payDay = payDay;
  const canSend = Object.keys(change).length > 0;

  const send = async () => {
    if (!canSend || busy) return;
    setBusy(true);
    try {
      await fetch(`/api/cases/${caseId}/revision`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-dev-party": partyId },
        body: JSON.stringify({ topic: "CHILD_SUPPORT", change, reasonCode: reason || null }),
      });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="anim-msg-in mt-3"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: 14,
      }}
    >
      <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub)" }}>
        お返事があるまで、いまの取り決めが続きます。
      </p>

      <input
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={`金額（いまは ${Number(current.monthlyAmount ?? 0).toLocaleString("ja-JP")}円）`}
        className="mt-3 w-full"
        style={{
          background: "var(--surface-2)",
          borderRadius: "var(--r-sm)",
          padding: "10px 12px",
          minHeight: 42,
          fontSize: 14,
        }}
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {PAY_DAYS.map((d) => (
          <button
            key={d.code}
            type="button"
            onClick={() => setPayDay(payDay === d.code ? "" : d.code)}
            style={{
              fontSize: 12.5,
              padding: "7px 12px",
              borderRadius: "var(--r-full)",
              border: `1px solid ${payDay === d.code ? "var(--agree)" : "var(--border)"}`,
              background: payDay === d.code ? "var(--agree-bg)" : "var(--surface-2)",
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* ★自由記述にしない。
             書いた文は取次ぎの検査で必ず落ちるため、黙って消える経路になる。
             越えてよいカテゴリから選んでいただく（任意）。 */}
      <p style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 12 }}>
        背景をお伝えになりますか（任意）
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {REVISION_REASONS.map((r) => (
          <button
            key={r.code}
            type="button"
            onClick={() => setReason(reason === r.code ? "" : r.code)}
            style={{
              fontSize: 12.5,
              padding: "7px 12px",
              borderRadius: "var(--r-full)",
              border: `1px solid ${reason === r.code ? "var(--agree)" : "var(--border)"}`,
              background: reason === r.code ? "var(--agree-bg)" : "var(--surface-2)",
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      {/* ★実際に相手に出る文を、選んだその場で見せる */}
      <p style={{ fontSize: 11, lineHeight: 1.9, color: "var(--muted)", marginTop: 6 }}>
        {reason
          ? `お相手には「${reasonTextOf(reason)}」とだけ伝わります。`
          : "選ばなくてもかまいません。金額や日付のほかは、何も伝わりません。"}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!canSend || busy}
          onClick={() => void send()}
          className="flex-1 rounded-full disabled:opacity-40"
          style={{ border: "1px solid var(--border-strong)", minHeight: 42, fontSize: 13.5 }}
        >
          変更を申し出る
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-full px-4 disabled:opacity-40"
          style={{ border: "1px solid var(--border)", minHeight: 42, fontSize: 13.5 }}
        >
          やめる
        </button>
      </div>
    </div>
  );
}
