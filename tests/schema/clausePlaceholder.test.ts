import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AGREEMENT_TOPICS } from "@/domain/agreement/topics";

/**
 * ★G-3：条項ひな形のプレースホルダは、payload スキーマのキー集合の部分集合であること。
 *
 * 条項生成に LLM を使わない設計のため、置換に失敗すると
 * 空欄のまま法的文書ができあがる。それを機械的に防ぐ。
 *
 * @see docs/functional-design.md §4.9 G-3
 */

type Schema = {
  id: string;
  targetType: string;
  targetKey: string;
  version: number;
  status: string;
  schema: { properties: Record<string, unknown> };
};
type Template = {
  id: string;
  payloadSchemaId: string;
  topic: string;
  body: string;
  condition?: { field: string; equals: string | number | boolean } | null;
};

/**
 * ★ケースの情報から作る差し込み。payload のキーではない。
 *   人数が分からなければ文書を返さない（documentBuilder のテストで固定）。
 */
const FROM_CASE = new Set(["childrenRef"]);

/**
 * ★payload から導く差し込み（builder の derivedOf）。
 *   payerSide から甲・乙を決める。**両方を payload に持たせると、
 *   食い違った値を保存できてしまう。**
 */
const DERIVED = new Set(["payerMark", "payeeMark"]);

const read = <T,>(p: string): T[] => JSON.parse(readFileSync(p, "utf8"));
const schemas = read<Schema>("firestore/seeds/payloadSchemas.json");
const templates = read<Template>("firestore/seeds/clauseTemplates.json");
const byId = new Map(schemas.map((s) => [s.id, s]));

describe("G-3｜条項ひな形とスキーマの整合", () => {
  it.each(templates)("$id のプレースホルダがスキーマに存在する", (t) => {
    const s = byId.get(t.payloadSchemaId);
    expect(s, `スキーマが見つかりません: ${t.payloadSchemaId}`).toBeDefined();

    const keys = new Set(Object.keys(s!.schema.properties));
    const placeholders = [...t.body.matchAll(/\{\{(\w+)\}\}/g)]
      .map((m) => m[1])
      .filter((k) => !FROM_CASE.has(k) && !DERIVED.has(k));

    // ★条件つきのひな形は、差し込みが無くてよい。
    //   「別途協議して定める」のように、payload の1つの値で選ばれる固定文がある。
    //   条件が無いのに差し込みも無いひな形は、置換を書き忘れている。
    if (!t.condition) {
      expect(placeholders.length, "プレースホルダが1つもありません").toBeGreaterThan(0);
    }
    for (const p of placeholders) {
      expect(keys.has(p), `スキーマに未定義のプレースホルダ: {{${p}}}`).toBe(true);
    }
  });

  /**
   * ★条件に使うキーも、スキーマに存在すること。
   *
   *   存在しないキーを条件にすると、その条項は**永久に出ない。**
   *   合意したのに文書に現れない、という形で表面化する。
   */
  it.each(templates.filter((t) => t.condition))("$id の条件キーがスキーマに存在する", (t) => {
    const s = byId.get(t.payloadSchemaId)!;
    const keys = new Set(Object.keys(s.schema.properties));
    expect(keys.has(t.condition!.field), `スキーマに無い条件キー: ${t.condition!.field}`).toBe(true);
  });

  /**
   * ★条件つきのひな形は、その論点の選択肢を**取りこぼさない**こと。
   *
   *   enum に値を足してひな形を足し忘れると、
   *   その選択をした人だけ条項が消える。
   */
  it("★条件つきの論点で、選べる値がすべてひな形に対応している", () => {
    const conditional = templates.filter((t) => t.condition);
    const byTopic = new Map<string, typeof conditional>();
    for (const t of conditional) {
      byTopic.set(t.topic, [...(byTopic.get(t.topic) ?? []), t]);
    }

    for (const [topic, ts] of byTopic) {
      const s = byId.get(ts[0].payloadSchemaId)!;
      const field = ts[0].condition!.field;
      const prop = s.schema.properties[field] as { enum?: string[] } | undefined;
      expect(prop?.enum, `${field} が enum ではありません`).toBeDefined();

      const covered = new Set(ts.map((t) => String(t.condition!.equals)));
      const missing = prop!.enum!.filter((v) => !covered.has(v));

      // ★NONE（年金分割をしない）は、書く内容が無いので条項が無い。
      //   意図した除外であることを、ここに明記して固定する。
      expect(missing, `${topic}: ひな形の無い選択肢`).toEqual(
        topic === "PENSION_SPLIT" ? ["NONE"] : [],
      );
    }
  });

  it("すべてのひな形が実在するスキーマを参照している", () => {
    for (const t of templates) expect(byId.has(t.payloadSchemaId)).toBe(true);
  });

  it("★G-4：スキーマの targetKey が論点の enum に存在する", () => {
    for (const s of schemas.filter((x) => x.targetType === "AGREEMENT_TOPIC")) {
      expect(AGREEMENT_TOPICS as readonly string[]).toContain(s.targetKey);
    }
  });

  /**
   * ★条項になるのは合意のスキーマだけ。
   *   取次ぎの抽出に使うスキーマ（RELAY_EXTRACTION）は条項にならない。
   *   日常の連絡は合意を求めないが、**事実を構造化して渡すために**スキーマが要る。
   */
  it("PUBLISHED の合意スキーマには対応するひな形がある", () => {
    for (const s of schemas.filter(
      (x) => x.status === "PUBLISHED" && x.targetType === "AGREEMENT_TOPIC",
    )) {
      expect(
        templates.some((t) => t.payloadSchemaId === s.id),
        `ひな形のないスキーマ: ${s.id}`,
      ).toBe(true);
    }
  });

  // ★抽出用のスキーマを、合意の器と取り違えない
  it("★取次ぎの抽出スキーマは、条項にも論点の enum にも紐づかない", () => {
    const relay = schemas.filter((x) => x.targetType === "RELAY_EXTRACTION");
    for (const s of relay) {
      expect(templates.some((t) => t.payloadSchemaId === s.id)).toBe(false);
      expect(AGREEMENT_TOPICS as readonly string[]).not.toContain(s.targetKey);
    }
  });
});
