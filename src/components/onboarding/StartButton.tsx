"use client";

import { useState } from "react";

/**
 * B-1 のはじめる
 *
 * ★★ 状況（5択）を聞かない。
 *
 *   以前は「離婚していますか」「取り決めはありますか」を平たい5択で聞き、
 *   その答えで行き先を分けていた。**分岐する意味が無くなった。**
 *   全員が取り決めの入力から始まるためである。
 *
 *   聞かないほうがよい理由でもある。**入口で立場を宣言させない。**
 *
 * ★ここでケースを作り、セッションを発行する。
 *   お名前もご連絡先も要らない、という約束は変わらない。
 */
export function StartButton() {
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      // ★次は、次に戻ってこられるようにするだけ
      if (res.ok) window.location.href = "/account";
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void start()}
      className="mt-6 w-full disabled:opacity-50"
      style={{
        background: "var(--agree-bg)",
        border: "1px solid var(--agree)",
        borderRadius: "var(--r-full)",
        minHeight: 52,
        fontSize: 15.5,
        fontWeight: 600,
        color: "var(--agree-text)",
      }}
    >
      はじめる
    </button>
  );
}
