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

/**
 * ★条項を出す条件
 *
 *   財産分与は「一括で支払う／清算済み／別途協議」で文面がまるごと変わる。
 *   1つのひな形に収めようとすると、条件分岐を本文に埋め込むことになる。
 *   **ひな形を分け、どれを出すかを payload の1つの値で決める。**
 */
export type ClauseCondition = { field: string; equals: string | number | boolean };

export type ClauseTemplate = {
  id: string;
  topic: string;
  order: number;
  title: string;
  body: string;
  /** ★無ければ常に出す */
  condition?: ClauseCondition | null;
};

export type AgreementItemInput = {
  topic: string;
  status: string;
  payload: Record<string, unknown> | null;
  /** ★お子さんの人数。条項の表記に要る */
  childCount?: number;
};

/**
 * ★条項で子を指す語
 *
 *   公正証書では甲・乙・丙…と当事者を置く。
 *   子が複数いれば、丙・丁・戊と続く。
 *
 * ★氏名を出さない。原案は当事者が公証役場に持ち込むものであり、
 *   アプリ側で氏名を保持しない設計と整合させる。
 */
const CHILD_MARKS = ["丙", "丁", "戊"];

export function childrenRefOf(count: number): string | null {
  if (count < 1 || count > CHILD_MARKS.length) return null;
  const m = CHILD_MARKS.slice(0, count);
  if (m.length === 1) return m[0];
  return `${m.slice(0, -1).join("、")}及び${m[m.length - 1]}`;
}

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
 * ★条件に使う値が payload に無い。
 *
 *   黙って条項を落とさない。
 *   **合意した内容が文書から消えるほうが、例外で止まるより危険である。**
 *   （空欄のまま返さないのと同じ考え方）
 */
export class UnresolvedConditionError extends Error {
  constructor(
    readonly templateId: string,
    readonly field: string,
  ) {
    super(`条項を出すかどうかを決められません（${templateId}）: ${field} が入力されていません`);
    this.name = "UnresolvedConditionError";
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
  // ★財産分与。どちらが支払う側かは payerSide が持つ（derivedOf）
  method: {
    LUMP_SUM: "一括して支払う",
    ALREADY_SETTLED: "清算が済んでいる",
    CONSULT_LATER: "別途協議して定める",
  },
  // ★年金分割。按分割合は選択肢だけ。任意の数値を受け付けない
  pensionMethod: {
    HALF: "2分の1",
    CONSULT_LATER: "別途協議して定める",
    NONE: "分割しない",
  },
  payerSide: {
    NON_CUSTODIAL: "甲",
    CUSTODIAL: "乙",
  },
};

/** 時刻の範囲「10:00-17:00」 */
const TIME_RANGE = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;
/** ★日付「2026-12-31」。法的文書に ISO 形式を出さない */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
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

  // ★「2026-12-31」を「2026年12月31日」に。ISO 形式のまま条項に出さない
  const d = s.match(ISO_DATE);
  if (d) return `${Number(d[1])}年${Number(d[2])}月${Number(d[3])}日`;

  // ★表記の定義が無いコード値を通さない
  if (CODE_LIKE.test(s)) return null;

  return s;
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/**
 * 条項を出すか。
 *
 * ★条件が無ければ出す。
 * ★条件に使う値が payload に無ければ**例外**。黙って落とさない（§UnresolvedConditionError）。
 * ★値はあるが一致しない → 出さない。これは意図された除外である。
 *   （例：年金分割を「行わない」と決めたとき、分割の条項は出ない）
 */
export function matchesCondition(
  t: Pick<ClauseTemplate, "id" | "condition">,
  payload: Record<string, unknown>,
): boolean {
  const c = t.condition;
  if (!c) return true;

  const v = payload[c.field];
  if (v === undefined || v === null || v === "") throw new UnresolvedConditionError(t.id, c.field);

  return v === c.equals;
}

/**
 * 当事者を指す語（甲・乙）
 *
 * ★財産分与は、どちらが支払う側かが決まっていない。
 *   養育費（甲＝非監護親が支払う）と違い、**向きを payload が持つ必要がある。**
 *   向きを取り違えた法的文書は、空欄より危険である。
 *
 * ★甲＝非監護親、乙＝監護親。既存の条項と同じ割り当て。
 */
const PARTY_MARK = { NON_CUSTODIAL: "甲", CUSTODIAL: "乙" } as const;

/**
 * payload から導く差し込み。
 *
 * ★payload に直接は無いが、payload から一意に決まるもの。
 *   両方を payload に持たせると、食い違った値を保存できてしまう。
 */
function derivedOf(payload: Record<string, unknown>): Record<string, string | null> {
  const side = payload.payerSide;
  if (side !== "NON_CUSTODIAL" && side !== "CUSTODIAL") return {};

  const payer = PARTY_MARK[side];
  const payee = side === "NON_CUSTODIAL" ? PARTY_MARK.CUSTODIAL : PARTY_MARK.NON_CUSTODIAL;
  return { payerMark: payer, payeeMark: payee };
}

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
  const agreedItems = input.items.filter((i) => i.status === "AGREED");
  const agreed = new Map(agreedItems.map((i) => [i.topic, i.payload ?? {}]));
  const childCounts = new Map(agreedItems.map((i) => [i.topic, i.childCount ?? 0]));

  const clauses: Clause[] = [];
  for (const t of [...input.templates].sort((a, b) => a.order - b.order)) {
    const payload = agreed.get(t.topic);
    if (!payload) continue;

    // ★条件に合わなければ、この条項は出さない
    if (!matchesCondition(t, payload)) continue;

    const missing: string[] = [];
    // ★子を指す語は payload ではなく、ケースの情報から作る
    const childrenRef = childrenRefOf(childCounts.get(t.topic) ?? 0);
    const derived = derivedOf(payload);

    const body = t.body.replace(PLACEHOLDER, (_m, key: string) => {
      const v =
        key === "childrenRef"
          ? childrenRef
          : key in derived
            ? derived[key]
            : formatValue(key, payload[key]);
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
