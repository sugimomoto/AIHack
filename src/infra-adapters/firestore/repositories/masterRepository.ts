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

import { isIndividualAdvice, type KnowledgeArticle } from "@/domain/knowledge/article";

/**
 * ナレッジ記事
 *
 * ★読み取り時にも検査する。
 *   検査がテストの中にしかないと、DBを直接更新した記事が
 *   どのガードにも触れずに公開される（レビューで検出）。
 *   弁護士法72条に触れる文が公開されることの重さに対して、
 *   一覧から落とすコストは小さい。
 */
function isPublishable(a: KnowledgeArticle): boolean {
  for (const t of [a.title, a.summary, a.body]) {
    if (t && isIndividualAdvice(t)) {
      console.warn(`[knowledge] 個別助言にあたる表現のため非公開にしました: ${a.id}`);
      return false;
    }
  }
  return true;
}

export async function listKnowledgeArticles(topic?: string): Promise<KnowledgeArticle[]> {
  const col = getDb().collection("masters/knowledgeArticles/items");
  const snap = await (topic ? col.where("topics", "array-contains", topic).get() : col.get());
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KnowledgeArticle).filter(isPublishable);
}

/** ★IDの形を制限する。スラッシュを通すと別のパスを読む */
const ARTICLE_ID = /^[A-Za-z0-9_-]+$/;

export async function findKnowledgeArticle(id: string): Promise<KnowledgeArticle | null> {
  if (!ARTICLE_ID.test(id)) return null;
  const d = await getDb().collection("masters/knowledgeArticles/items").doc(id).get();
  if (!d.exists) return null;
  const a = { id: d.id, ...d.data() } as KnowledgeArticle;
  return isPublishable(a) ? a : null;
}

import type { Scenario } from "@/domain/topic/selection";

/** 相談シナリオ。★選ばなくても始められるため、取得の失敗で止めない */
export async function listScenarios(): Promise<Scenario[]> {
  const snap = await getDb().collection("masters/scenarios/items").get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Scenario)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}
