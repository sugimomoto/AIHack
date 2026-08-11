import { getDb } from "../client";

/**
 * マスタの読み取り
 *
 * ★payloadSchema はコードではなく DB にある（G-1〜G-4）。
 *   スキーマをチューニングするたびにデプロイが要る状態にしない。
 */

export type PayloadSchemaMaster = {
  id: string;
  targetKey: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "DEPRECATED";
  schema: Record<string, unknown>;
};

/** ★PUBLISHED の最新版のみを使う。DRAFT を本番の提案に使わない */
export async function findPublishedPayloadSchema(
  targetKey: string,
): Promise<PayloadSchemaMaster | null> {
  const snap = await getDb()
    .collection("masters/payloadSchemas/items")
    .where("targetKey", "==", targetKey)
    .where("status", "==", "PUBLISHED")
    .get();

  if (snap.empty) return null;
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PayloadSchemaMaster);
  return rows.sort((a, b) => b.version - a.version)[0];
}
