/**
 * 公正証書原案の生成
 *
 * ★LLMを一切使わない。ひな形のプレースホルダ置換だけで作る。
 *
 *   弁護士法72条。離婚協議には事件性が認められるため、
 *   LLMに条項を書かせると法律事務の取扱いにあたるおそれがある。
 *   そして、文言が毎回変わる法的文書に意味はない。
 *
 * ★置換に失敗した文書を世に出さない。
 *   **空欄のある法的文書は、空欄のない誤りより危険である。**
 *   当事者がそれを公証役場に持ち込む。
 *
 * @see docs/functional-design.md §5.5
 */

export const NOTARY_NOTICE =
  "これは原案です。公正証書は公証人が作成します。内容は公証役場でご確認ください。";

export type ClauseTemplate = {
  id: string;
  topic: string;
  order: number;
  title: string;
  body: string;
};

export type AgreementItemInput = {
  topic: string;
  status: string;
  payload: Record<string, unknown> | null;
};

export type Clause = { number: number; title: string; body: string; templateId: string };

export type Document = {
  clauses: Clause[];
  /** ★組み立て側が持つ。呼び出し側に付けさせない */
  notice: string;
};

export class UnresolvedPlaceholderError extends Error {
  constructor(
    readonly templateId: string,
    readonly missing: string[],
  ) {
    super(`条項の項目が埋まっていません（${templateId}）: ${missing.join(", ")}`);
    this.name = "UnresolvedPlaceholderError";
  }
}

/** コード値 → 表記。★未知の値は null を返し、未置換として扱わせる */
const CODES: Record<string, Record<string, string>> = {
  payDay: {
    LAST_DAY: "毎月末日",
    DAY_5: "毎月5日",
    DAY_10: "毎月10日",
    DAY_25: "毎月25日",
  },
  until: {
    AGE_18: "18歳",
    AGE_20: "20歳",
    AGE_22_MARCH: "22歳に達した後の最初の3月",
    GRADUATION: "大学等を卒業する月",
  },
};

export function formatValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const codes = CODES[key];
  if (codes) return codes[String(value)] ?? null; // ★未知のコードは通さない

  if (typeof value === "number") return value.toLocaleString("ja-JP");
  return String(value);
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/**
 * 原案を組み立てる。
 *
 * ★引数を1つしか取らない。
 *   「この条項だけ落とす」という逃げ道を呼び出し側に与えない。
 *   合意した内容が文書から消えるほうが危険である。
 */
export function buildDocument(input: {
  templates: readonly ClauseTemplate[];
  items: readonly AgreementItemInput[];
}): Document {
  // ★AGREED だけを対象にする。決まっていないことを条項にしない
  const agreed = new Map(
    input.items.filter((i) => i.status === "AGREED").map((i) => [i.topic, i.payload ?? {}]),
  );

  const clauses: Clause[] = [];
  for (const t of [...input.templates].sort((a, b) => a.order - b.order)) {
    const payload = agreed.get(t.topic);
    if (!payload) continue;

    const missing: string[] = [];
    const body = t.body.replace(PLACEHOLDER, (_m, key: string) => {
      const v = formatValue(key, payload[key]);
      if (v === null) {
        missing.push(key);
        return _m;
      }
      return v;
    });

    // ★埋まらなければ例外。空欄のまま返さない
    if (missing.length > 0) throw new UnresolvedPlaceholderError(t.id, missing);

    clauses.push({ number: clauses.length + 1, title: t.title, body, templateId: t.id });
  }

  return { clauses, notice: NOTARY_NOTICE };
}
