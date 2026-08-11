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

const DEFAULT_PROJECT_ID = "aida-505206";

/**
 * 接続先プロジェクトの解決
 *
 * ★FIREBASE_PROJECT_ID を先に見る。
 *   Next.js は既に設定済みの環境変数を `.env.local` で上書きしない。
 *   そのため、シェルに `GOOGLE_CLOUD_PROJECT` が残っていると
 *   **無関係なプロジェクトへ黙って接続する。**実際にこれが起きた
 *   （別プロジェクトの Firestore を読みに行っていた）。
 *   アプリ固有の名前を優先させることで、環境の残留を上書きできる。
 *
 * ★空文字は「未設定」として扱う（`??` では既定値に落ちないため）。
 *
 * 本番（Cloud Run）では FIREBASE_PROJECT_ID を設定しないため、
 * ランタイムが与える GOOGLE_CLOUD_PROJECT が使われる。
 */
function projectId(): string {
  const id =
    process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT_ID;
  // ★どこに繋いだかを必ず残す。黙って別プロジェクトを読むことを防ぐ。
  //   プロジェクトIDは秘密情報ではない。
  console.info(`[firestore] 接続先プロジェクト: ${id}`);
  return id;
}

export function getDb(): Firestore {
  if (db) return db;

  if (!getApps().length) {
    const key = process.env.FIREBASE_PRIVATE_KEY;
    initializeApp(
      key
        ? {
            credential: cert({
              projectId: projectId(),
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: key.replace(/\\n/g, "\n"),
            }),
          }
        : { projectId: projectId() },
    );
  }
  db = getFirestore();
  return db;
}
