import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CODE_LABELS } from "@/domain/document/builder";

/**
 * ★G-3b｜条項に現れる enum 値には、必ず表記の定義があること
 *
 * G-3 は「プレースホルダ ⊆ スキーマのキー」を検査する。
 * しかし**キーが揃っていても、値が翻訳できなければ条項は壊れる。**
 *
 *   実機で「面会交流はMONTHLY_1とし」という条項ができた。
 *   空欄と同じくらい危険である。これが公証役場に持ち込まれる。
 *
 * ★このテストは実装より先に書かれた
 */

type Schema = { targetKey: string; status: string; schema: { properties: Record<string, { enum?: string[] }> } };
type Template = { payloadSchemaId: string; topic: string; body: string };

const schemas = JSON.parse(readFileSync("firestore/seeds/payloadSchemas.json", "utf8")) as (Schema & { id: string })[];
const templates = JSON.parse(readFileSync("firestore/seeds/clauseTemplates.json", "utf8")) as Template[];

describe("★G-3b｜条項に現れる enum に表記があること", () => {
  for (const t of templates) {
    const schema = schemas.find((s) => s.id === t.payloadSchemaId)!;
    // ★childrenRef はケースの情報から作る。payload のキーではない
    const keys = [...t.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).filter((k) => k !== "childrenRef");

    for (const key of keys) {
      const prop = schema.schema.properties[key];
      if (!prop?.enum) continue;

      it(`${t.topic}.${key} のすべての値に表記がある`, () => {
        const missing = prop.enum!.filter((v) => !CODE_LABELS[key]?.[v]);
        expect(missing).toEqual([]);
      });
    }
  }

  it("★条項に現れるキーが、オブジェクト型でない", () => {
    // オブジェクトは文字列にできない。条項に直接埋め込めない
    const bad: string[] = [];
    for (const t of templates) {
      const schema = schemas.find((s) => s.id === t.payloadSchemaId)!;
      for (const m of t.body.matchAll(/\{\{(\w+)\}\}/g)) {
        if (m[1] === "childrenRef") continue;
        const prop = schema.schema.properties[m[1]] as { type?: string } | undefined;
        if (prop?.type === "object") bad.push(`${t.topic}.${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
