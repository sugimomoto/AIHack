import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firestore（Admin SDK）
 *
 * ★クライアントからの直接アクセスは禁止（G-G / architecture.md §5.2）。
 *   すべてサーバー経由。Admin SDK はセキュリティルールをバイパスするため、
 *   アクセス制御の責任は API 層のスコープ規約（A-1〜A-6）にある。
 */
let db: Firestore | null = null;

export function getDb(): Firestore {
  if (db) return db;

  if (!getApps().length) {
    const key = process.env.FIREBASE_PRIVATE_KEY;
    initializeApp(
      key
        ? {
            credential: cert({
              projectId: process.env.GOOGLE_CLOUD_PROJECT,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: key.replace(/\\n/g, "\n"),
            }),
          }
        : { projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "aida-505206" },
    );
  }
  db = getFirestore();
  return db;
}
