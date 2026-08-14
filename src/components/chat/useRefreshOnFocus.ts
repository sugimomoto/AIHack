"use client";

import { useEffect, useRef } from "react";

/**
 * 画面に戻ってきたら、取り直す
 *
 * ★★ お相手からの取次ぎが、届いても画面に出なかった（2026-08-14 実測）。
 *
 *   取得は `useEffect` の初回だけだった。
 *   開いたまま置いたタブには、**あとから届いたものが永久に出ない。**
 *   API もデータも正しかった。**画面が取りに行っていなかった。**
 *
 *   これは、このアプリでは軽い不具合では済まない。
 *   **届くことが、そもそもの主題**だからである。
 *
 * ★取りに行くのは、**見えているときだけ。**
 *   隠れているタブで数え続ける意味は無い。
 *
 * ★通知はしない。音も、バッジも、赤い点も出さない。
 *   **急かさない**という約束（AC-06）は変えない。
 *   変えるのは「見ているのに古いまま」を無くすことだけである。
 */
const INTERVAL_MS = 20_000;

export function useRefreshOnFocus(reload: () => void | Promise<void>): void {
  // ★間隔の張り替えで reload の同一性に振り回されないようにする
  const ref = useRef(reload);
  ref.current = reload;

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "visible") void ref.current();
    };

    // ★別のウィンドウから戻ったとき。おふたりを並べて試す場面がこれ
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);

    const id = setInterval(run, INTERVAL_MS);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
      clearInterval(id);
    };
  }, []);
}
