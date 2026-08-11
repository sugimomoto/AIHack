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

/**
 * コード値 → 表記
 *
 * ★enum を持つキーは、必ずここに定義が要る（G-3b で検査）。
 *   定義が無いと `MONTHLY_1` のような値がそのまま条項に出る。
 */
export const CODE_LABELS: Record<string, Record<string, string>> = {
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
  frequency: {
    MONTHLY_1: "月1回",
    MONTHLY_2: "月2回",
    WEEKLY_1: "週1回",
    OTHER: "別途協議して定める頻度",
  },
  dayOfWeek: {
    SUN: "日曜日", MON: "月曜日", TUE: "火曜日", WED: "水曜日",
    THU: "木曜日", FRI: "金曜日", SAT: "土曜日",
  },
};

/** 時刻の範囲「10:00-17:00」 */
const TIME_RANGE = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;
/** ★コード値らしい文字列。表記の定義が無いまま条項に出してはならない */
const CODE_LIKE = /^[A-Z][A-Z0-9_]*$/;

/**
 * 値を条項の文言にする。
 *
 * ★変換できないものは null を返し、未置換として扱わせる。
 *   実機で `MONTHLY_1` と `[object Object]` が条項に出た。
 *   **空欄と同じくらい危険である。**これが公証役場に持ち込まれる。
 *
 * ★文字列化してよいのは、当事者が自由入力した値だけである。
 */
export function formatValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  // ★オブジェクト・配列は条項に埋め込めない
  if (typeof value === "object") return null;

  const codes = CODE_LABELS[key];
  if (codes) return codes[String(value)] ?? null; // ★未知のコードは通さない

  if (typeof value === "number") return value.toLocaleString("ja-JP");
  if (typeof value === "boolean") return null; // 真偽値をそのまま条項に出さない

  const s = String(value);
  const t = s.match(TIME_RANGE);
  if (t) return `${t[1]}時${t[2]}分から${t[3]}時${t[4]}分まで`;

  // ★表記の定義が無いコード値を通さない
  if (CODE_LIKE.test(s)) return null;

  return s;
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
