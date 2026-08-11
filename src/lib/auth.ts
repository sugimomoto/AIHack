import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { findPartyByAuthUid } from "@/infra-adapters/firestore/repositories/caseRepository";
import type { PartyRecord } from "@/domain/case/types";

/**
 * 認証
 *
 * ★Firebase SDK は「認証のみ」に使う。データ操作はすべてサーバー経由（G-G）。
 *
 * S2 では最小構成。招待による本人確認は S15 で扱う。
 */

export class UnauthenticatedError extends Error {
  constructor() {
    super("ログインが必要です");
    this.name = "UnauthenticatedError";
  }
}

/** Authorization ヘッダの ID トークンを検証し、当事者を返す */
export async function authenticate(req: Request): Promise<PartyRecord> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new UnauthenticatedError();

  if (!getApps().length) {
    initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "aida-505206" });
  }

  let uid: string;
  try {
    uid = (await getAuth().verifyIdToken(token)).uid;
  } catch {
    // ★検証失敗の詳細をユーザーに返さない
    throw new UnauthenticatedError();
  }

  const party = await findPartyByAuthUid(uid);
  if (!party) throw new UnauthenticatedError();
  return party;
}
