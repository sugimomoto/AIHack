"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * ★Firebase は「本人確認」にのみ使う。
 *   データ操作はすべてサーバー経由（G-G）。
 *   クライアントから Firestore を触らない。
 */
export function firebaseAuth(): Auth {
  const app: FirebaseApp = getApps()[0] ?? initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
  return getAuth(app);
}
