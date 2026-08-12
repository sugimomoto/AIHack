"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * ★Firebase は「本人確認」にのみ使う。
 *   データ操作はすべてサーバー経由（G-G）。クライアントから Firestore を触らない。
 *
 * ★設定を実行時に取りに行く。
 *   NEXT_PUBLIC_* はビルド時に埋め込まれるため、
 *   デプロイ後に環境変数を変えても反映されない（実機で踏んだ）。
 */
let cached: Auth | null = null;

export async function firebaseAuth(): Promise<Auth> {
  if (cached) return cached;
  if (getApps().length === 0) {
    const res = await fetch("/api/auth/config", { cache: "no-store" });
    const cfg = (await res.json()) as { apiKey: string; authDomain: string; projectId: string };
    if (!cfg.apiKey) throw new Error("Firebase の設定が取得できませんでした");
    initializeApp(cfg);
  }
  cached = getAuth(getApps()[0]);
  return cached;
}
