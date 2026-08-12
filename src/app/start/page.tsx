"use client";

import { useState } from "react";
import Image from "next/image";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import {
  SITUATIONS,
  SITUATION_LABEL,
  SITUATION_NOTE,
  type Situation,
} from "@/domain/case/situation";

/**
 * はじめる
 *
 * ★ここで最初の当事者が生まれる。
 *   まだ相手はいない。招待は次の画面で行う。
 *
 * ★役割を先に聞く。
 *   養育費の義務者・権利者が決まらないと、算定表を引けない。
 */
export default function Page() {
  const [busy, setBusy] = useState(false);
  const [situation, setSituation] = useState<Situation | null>(null);

  const start = async (role: "CUSTODIAL" | "NON_CUSTODIAL") => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, situation }),
      });
      // ★お子さんと年収を伺ってから、状況に応じた次の一手へ進む
      if (res.ok) window.location.href = "/onboarding/children";
    } finally {
      setBusy(false);
    }
  };

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col overflow-y-auto px-6 pb-8 pt-10">
        <div className="flex flex-col items-center text-center">
          <div
            className="grid place-items-center overflow-hidden"
            style={{ width: 76, height: 76, borderRadius: 22, background: "var(--bubble-ai)" }}
          >
            <Image src="/character/capybara-sit.png" alt="" width={62} height={62} />
          </div>
          <h1 style={{ fontSize: 20, lineHeight: 1.7, fontWeight: 600, marginTop: 16 }}>
            Aida は、おふたりのあいだに
            <br />
            立つためのサービスです。
          </h1>
          <p style={{ fontSize: 13, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 12 }}>
            書いた言葉は、お相手には届きません。
            <br />
            合意できた事項だけが共有されます。
          </p>
        </div>

        {/* ★状況の違いを、最初に吸収する。
             「もう離婚して取り決めもある人」と「まだ相手と話していない人」を
             同じ入口に通さない。 */}
        <p style={{ fontSize: 13.5, fontWeight: 600, marginTop: 28 }}>いまの状況に近いものを選んでください。</p>
        <div className="mt-3 flex flex-col gap-2.5">
          {SITUATIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSituation(s)}
              className="text-left"
              style={{
                background: situation === s ? "var(--agree-bg)" : "var(--surface)",
                border: `1px solid ${situation === s ? "var(--agree)" : "var(--border)"}`,
                borderRadius: "var(--r-md)",
                padding: 14,
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 600 }}>{SITUATION_LABEL[s]}</p>
              <p style={{ fontSize: 12, lineHeight: 1.85, color: "var(--text-sub)", marginTop: 3 }}>
                {SITUATION_NOTE[s]}
              </p>
            </button>
          ))}
        </div>

        <p style={{ fontSize: 13.5, fontWeight: 600, marginTop: 28 }}>お子さんと同居されていますか。</p>
        <p style={{ fontSize: 12, lineHeight: 1.9, color: "var(--text-sub-2)", marginTop: 6 }}>
          養育費の目安をお出しするために伺います。あとから変えられます。
        </p>

        <div className="mt-4 flex flex-col gap-2.5">
          {[
            { role: "CUSTODIAL" as const, label: "同居しています" },
            { role: "NON_CUSTODIAL" as const, label: "同居していません" },
          ].map((o) => (
            <button
              key={o.role}
              type="button"
              disabled={busy || !situation}
              onClick={() => void start(o.role)}
              className="disabled:opacity-50"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--r-full)",
                minHeight: 52,
                fontSize: 15,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 20, textAlign: "center" }}>
          {situation ? "お名前やご連絡先の入力は要りません。" : "まず、いまの状況をお選びください。"}
        </p>
      </div>
    </PhoneFrame>
  );
}
