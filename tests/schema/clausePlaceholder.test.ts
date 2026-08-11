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
};

const read = <T,>(p: string): T[] => JSON.parse(readFileSync(p, "utf8"));
const schemas = read<Schema>("firestore/seeds/payloadSchemas.json");
const templates = read<Template>("firestore/seeds/clauseTemplates.json");
const byId = new Map(schemas.map((s) => [s.id, s]));

describe("G-3｜条項ひな形とスキーマの整合", () => {
  it.each(templates)("$id のプレースホルダがスキーマに存在する", (t) => {
    const s = byId.get(t.payloadSchemaId);
    expect(s, `スキーマが見つかりません: ${t.payloadSchemaId}`).toBeDefined();

    const keys = new Set(Object.keys(s!.schema.properties));
    const placeholders = [...t.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);

    expect(placeholders.length, "プレースホルダが1つもありません").toBeGreaterThan(0);
    for (const p of placeholders) {
      expect(keys.has(p), `スキーマに未定義のプレースホルダ: {{${p}}}`).toBe(true);
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

  it("PUBLISHED のスキーマには対応するひな形がある", () => {
    for (const s of schemas.filter((x) => x.status === "PUBLISHED")) {
      expect(
        templates.some((t) => t.payloadSchemaId === s.id),
        `ひな形のないスキーマ: ${s.id}`,
      ).toBe(true);
    }
  });
});
