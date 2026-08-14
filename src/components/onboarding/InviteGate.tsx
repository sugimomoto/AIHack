"use client";

import { useState } from "react";
import Image from "next/image";
import { InviteCreate } from "@/components/invitation/InviteCreate";

/**
 * B-3 お相手を招待しますか
 *
 * ★★ 第3弾では、招待をオンボーディングから外していた。
 *   理由は「聞いた時点で、アプリが相手に伝える前提でいることが伝わる」。
 *   **今回それを戻す。**だから歯止めを3つ入れる。
 *
 *   1. 関係の状態（話しているか等）を**一切聞かない**
 *   2. 2つの選択肢を、枠線・面積・文字サイズまで**揃える**
 *   3. 「お渡しになるまで、お相手には何も届きません」を
 *      **選択肢より先に**置く
 *
 * ★「あとにする」の説明を「ひとりで書きはじめて、渡すかどうかはあとで決められます」
 *   にしてあるのは、**待機ではなく通常の使い方**だと示すため。
 */

const CARD: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-lg)",
  padding: 18,
  minHeight: 96,
  textAlign: "left",
  width: "100%",
};

export function InviteGate() {
  const [now, setNow] = useState(false);

  if (now) return <InviteCreate />;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 pb-8 pt-8">
      <div className="flex items-start gap-2.5">
        <Image
          src="/character/capybara.png"
          alt=""
          width={28}
          height={28}
          style={{ width: 28, height: 28, flexShrink: 0 }}
        />
        <h1 style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.75 }}>
          お相手を、いまお誘いになりますか。
        </h1>
      </div>

      {/* ★選択肢より先に置く。選んだあとでは遅い */}
      <div
        className="mt-4"
        style={{
          background: "var(--bubble-ai)",
          border: "1px dashed #DCC7A6",
          borderRadius: "var(--r-md)",
          padding: "13px 15px",
        }}
      >
        <p style={{ fontSize: 13, lineHeight: 1.95 }}>
          <strong>お渡しになるまで、お相手には何も届きません。</strong>
        </p>
        <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub-2)", marginTop: 6 }}>
          ご案内を作っただけでは、アプリからご連絡することはありません。
        </p>
      </div>

      {/* ★枠線・面積・文字サイズをすべて揃える。主従を作らない */}
      <div className="mt-4 flex flex-col gap-3">
        <button type="button" style={CARD} onClick={() => setNow(true)}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>いまお渡しする</p>
          <p style={{ fontSize: 13, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 6 }}>
            ご案内を作ります。渡す方法と、いつ渡すかは、ご自身で決められます。
          </p>
        </button>

        <a href="/app" style={{ ...CARD, display: "block" }}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>あとにする</p>
          <p style={{ fontSize: 13, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 6 }}>
            ひとりで書きはじめて、渡すかどうかはあとで決められます。
          </p>
        </a>
      </div>

      {/* ★関係の状態は、うかがわない */}
      <p
        style={{
          fontSize: 11.5,
          lineHeight: 1.95,
          color: "var(--muted)",
          marginTop: 18,
          textAlign: "center",
        }}
      >
        ご関係の状態は、うかがいません。
      </p>
    </div>
  );
}
