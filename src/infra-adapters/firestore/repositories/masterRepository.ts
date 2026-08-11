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

export type SupportTableRecord = {
  id: string;
  targetKey: string;
  tableRef: string;
  version: number;
  status: string;
  verified: boolean;
  sourceNote: string;
  rows: { payerBand: string; payeeBand: string; minYen: number; maxYen: number }[];
};

/**
 * 算定表を取る。
 *
 * ★DRAFT でも返す。
 *   未検証であることは `verified` が持ち、参照結果の注記として必ず現れる。
 *   ここで DRAFT を弾くと「表が無い」となり、**未検証であることが伝わらない。**
 */
export async function findSupportTable(targetKey: string): Promise<SupportTableRecord | null> {
  const snap = await getDb()
    .collection("masters/supportTables/items")
    .where("targetKey", "==", targetKey)
    .get();
  if (snap.empty) return null;
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportTableRecord);
  // ★検証済みを優先し、次に版が新しいもの
  return rows.sort((a, b) => Number(b.verified) - Number(a.verified) || b.version - a.version)[0];
}
