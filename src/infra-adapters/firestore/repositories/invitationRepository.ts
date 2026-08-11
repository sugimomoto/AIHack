import type { InvitationRecord } from "@/domain/invitation/types";
import { hashToken } from "@/domain/invitation/token";
import { getDb } from "../client";

/**
 * 招待の永続化
 *
 * ★トークンは平文で検索しない。
 *   `tokenHash` を保存し、照会もハッシュで行う。
 *   万一この文書が漏れても、そこから有効なリンクを復元できない。
 *
 * ★ルートコレクションに置く。
 *   受け取る側はまだケースの当事者ではないため、ケース配下だと
 *   「参加していない人がケース配下を読む」経路を作ってしまう。
 */

type Stored = Omit<InvitationRecord, "token"> & { tokenHash: string };

const col = () => getDb().collection("invitations");

export async function saveInvitation(inv: InvitationRecord): Promise<void> {
  const { token, ...rest } = inv;
  const stored: Stored = { ...rest, tokenHash: hashToken(token) };
  await col().doc(inv.id).set(stored);
}

/** トークンから招待を引く。★平文トークンは保存されていない */
export async function findByToken(token: string): Promise<InvitationRecord | null> {
  const snap = await col().where("tokenHash", "==", hashToken(token)).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const { tokenHash: _ignored, ...rest } = d.data() as Stored;
  // ★呼び出し元に平文トークンを返さない。手元にあるものをそのまま渡す
  return { ...(rest as Omit<InvitationRecord, "token">), id: d.id, token };
}

export async function updateStatus(
  id: string,
  patch: Partial<Pick<InvitationRecord, "status" | "acceptedAt" | "acceptedByPartyId">>,
): Promise<void> {
  await col().doc(id).update(patch);
}

/** ケースに紐づく招待の一覧（招待した側の確認用） */
export async function listByCase(caseId: string): Promise<Omit<InvitationRecord, "token">[]> {
  const snap = await col().where("caseId", "==", caseId).get();
  return snap.docs.map((d) => {
    const { tokenHash: _ignored, ...rest } = d.data() as Stored;
    return { ...(rest as Omit<InvitationRecord, "token">), id: d.id };
  });
}
