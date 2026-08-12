import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/**
 * Firebase の ID トークンを検証する。
 *
 * ★検証に失敗したら、何も返さない。
 *   ここを緩めると、任意の識別子を名乗れる。
 */
export async function verifyIdToken(idToken: string): Promise<{ uid: string; email: string | null } | null> {
  if (!idToken) return null;
  if (!getApps().length) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT });
  }
  try {
    const d = await getAuth().verifyIdToken(idToken);
    return { uid: d.uid, email: d.email ?? null };
  } catch {
    // ★失敗の詳細をユーザーに返さない（G-F）
    return null;
  }
}
