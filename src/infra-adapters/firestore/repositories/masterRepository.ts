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

import type { SupportTableMaster } from "@/domain/support/table";

/**
 * 算定表を取る。
 *
 * ★子の構成で表が分かれる。該当が無ければ null。
 *   公表されていない構成（子4人以上・表8）では引けない。
 *
 * ★DRAFT でも返す。未検証であることは `verified` が持ち、
 *   参照結果の注記として必ず現れる。ここで弾くと「表が無い」となり、
 *   **未検証であることが伝わらない。**
 */
export async function findSupportTable(
  targetKey: string,
  childrenKey: string,
): Promise<SupportTableMaster | null> {
  const snap = await getDb()
    .collection("masters/supportTables/items")
    .where("targetKey", "==", targetKey)
    .where("childrenKey", "==", childrenKey)
    .get();
  if (snap.empty) return null;
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportTableMaster);
  return rows.sort((a, b) => Number(b.verified) - Number(a.verified) || b.version - a.version)[0];
}

import type { ClauseTemplate } from "@/domain/document/builder";

/** 条項ひな形。★order の順に返す */
export async function listClauseTemplates(): Promise<ClauseTemplate[]> {
  const snap = await getDb().collection("masters/clauseTemplates/items").get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ClauseTemplate)
    .sort((a, b) => a.order - b.order);
}
