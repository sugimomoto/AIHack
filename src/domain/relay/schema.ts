import { CONTEXT_CATEGORIES } from "./guard";

/**
 * 事情の抽出の構造化出力
 *
 * ★カテゴリを enum で閉じる。
 *   ホワイトリスト外を「返せない」形にしておき、
 *   そのうえで実行時にも検査する（二重の防御）。
 */
export const EXTRACTION_SCHEMA: { name: string; schema: Record<string, unknown> } = {
  name: "circumstance_extraction",
  schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "相手に伝える要求・提案の要約。20〜40字程度。伝聞形式",
      },
      context: {
        type: "string",
        description: "背景事実。無ければ空文字。すべての文を伝聞形式で終える",
      },
      categories: {
        type: "array",
        items: { type: "string", enum: [...CONTEXT_CATEGORIES] },
      },
    },
    required: ["summary", "context", "categories"],
    additionalProperties: false,
  },
};
