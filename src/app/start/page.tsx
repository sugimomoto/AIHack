"use client";

import { useState } from "react";
import Image from "next/image";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import {
  SITUATIONS,
  SITUATION_FOOTNOTE,
  SITUATION_LABEL,
  SITUATION_NOTE,
  type Situation,
} from "@/domain/case/situation";

/**
 * I-1 状況の確認
 *
 * ★2×2の表として聞かない。**平たい5択に崩す。**
 *   「離婚していますか」「取り決めはありますか」という直接の問いを画面に出さない。
 *
 * ★選択肢は面積・枠線・文字サイズをすべて同一にする。
 *   「まだ、よく分からない」も同じ形で。最後だが小さくしない。
 *
 * ★「次へ」は選んだあとにだけ現れる。選ばせるために先に置かない。
 */
export default function Page() {
  const [busy, setBusy] = useState(false);
  const [situation, setSituation] = useState<Situation | null>(null);

  const proceed = async () => {
    if (busy || !situation) return;
    setBusy(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ situation }),
      });
      // ★同居 → お子さん → 年収 の順にうかがう
      if (res.ok) window.location.href = "/onboarding/living";
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

        <OnboardingProgress step={1} />

        <p style={{ fontSize: 13.5, fontWeight: 600, marginTop: 20 }}>
          いまの状況に近いものを選んでください。
        </p>

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

        {/* ★選択が資格の判定に見えないよう、必ず末尾に置く */}
        <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 18 }}>
          {SITUATION_FOOTNOTE}
        </p>

        {/* ★選ばないと出ない。fade + 4px上昇 */}
        {situation && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void proceed()}
            className="anim-msg-in mt-4 disabled:opacity-50"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--r-full)",
              minHeight: 52,
              fontSize: 15,
            }}
          >
            次へ
          </button>
        )}

        <p
          style={{
            fontSize: 11.5,
            lineHeight: 1.9,
            color: "var(--muted)",
            marginTop: 16,
            textAlign: "center",
          }}
        >
          お名前やご連絡先の入力は要りません。
        </p>
      </div>
    </PhoneFrame>
  );
}
