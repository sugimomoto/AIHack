/**
 * 取り決めの入力項目
 *
 * ★フォームと「内容の再掲」で、同じ定義を使う。
 *
 *   渡す前の確認シート（S-1b）は、**何が渡るのかを渡る形のまま見せる**ものである。
 *   フォームと再掲で別々にラベルを書くと、片方を直したときにずれる。
 *   **ずれた再掲を見て渡すことになる。**
 *
 * ★選択肢の表記は、条項の表記（CODE_LABELS）とは別に持つ。
 *   条項は「毎月25日限り」、画面は「毎月25日」。用途が違う。
 *
 * @see .steering/20260812-feedback-pivot/design.md §4
 */

export type FieldKind = "AMOUNT" | "CHOICE" | "TEXT" | "TIME_RANGE" | "DATE";

export type Field = {
  key: string;
  label: string;
  kind: FieldKind;
  /** CHOICE のときの選択肢 */
  options?: readonly (readonly [string, string])[];
  /** ★入力を助ける例。「必須」の代わりにはしない */
  placeholder?: string;
  /** ★この項目が出る条件。無ければ常に出る */
  visibleWhen?: { field: string; equals: string };
};

const PAY_DAY = [
  ["DAY_25", "毎月25日"],
  ["LAST_DAY", "毎月末日"],
  ["DAY_5", "毎月5日"],
  ["DAY_10", "毎月10日"],
] as const;

const UNTIL = [
  ["AGE_20", "20歳"],
  ["AGE_18", "18歳"],
  ["AGE_22_MARCH", "22歳に達した後の最初の3月"],
  ["GRADUATION", "大学等を卒業する月"],
] as const;

const FREQUENCY = [
  ["MONTHLY_1", "月1回"],
  ["MONTHLY_2", "月2回"],
  ["WEEKLY_1", "週1回"],
  ["OTHER", "別途協議して定める"],
] as const;

const DAY_OF_WEEK = [
  ["SAT", "土曜日"],
  ["SUN", "日曜日"],
  ["MON", "月曜日"],
  ["TUE", "火曜日"],
  ["WED", "水曜日"],
  ["THU", "木曜日"],
  ["FRI", "金曜日"],
] as const;

const WEEK_OF_MONTH = [
  ["1", "第1週"],
  ["2", "第2週"],
  ["3", "第3週"],
  ["4", "第4週"],
  ["5", "第5週"],
] as const;

/** ★財産分与の3択。どれも同じ重さ。「一括」を勧めない */
const PROPERTY_METHOD = [
  ["LUMP_SUM", "一括で支払う"],
  ["ALREADY_SETTLED", "清算が済んでいる"],
  ["CONSULT_LATER", "別途協議する"],
] as const;

/** ★どちらが支払うか。財産分与は向きが決まっていない */
const PAYER_SIDE = [
  ["NON_CUSTODIAL", "お子さんと離れて暮らす方"],
  ["CUSTODIAL", "お子さんと暮らす方"],
] as const;

/**
 * ★年金分割。「按分割合」という語を、選択の前に出さない。
 *   任意の数値は受け付けない（上限があるとされるため）。
 */
const PENSION_METHOD = [
  ["HALF", "半分ずつ（0.5）"],
  ["CONSULT_LATER", "別途協議する"],
  ["NONE", "分けない"],
] as const;

export const TOPIC_FIELDS: Record<string, readonly Field[]> = {
  CHILD_SUPPORT: [
    { key: "monthlyAmount", label: "月額", kind: "AMOUNT", placeholder: "50000" },
    { key: "payDay", label: "お支払いの日", kind: "CHOICE", options: PAY_DAY },
    { key: "until", label: "いつまで", kind: "CHOICE", options: UNTIL },
  ],
  VISITATION: [
    { key: "frequency", label: "回数", kind: "CHOICE", options: FREQUENCY },
    { key: "dayOfWeek", label: "曜日", kind: "CHOICE", options: DAY_OF_WEEK },
    { key: "weekOfMonth", label: "第何週", kind: "CHOICE", options: WEEK_OF_MONTH },
    { key: "timeRange", label: "時間", kind: "TIME_RANGE", placeholder: "10:00-17:00" },
    { key: "handoverPlace", label: "受け渡し場所", kind: "TEXT", placeholder: "駅前" },
  ],
  PROPERTY_DIVISION: [
    { key: "method", label: "どうされますか", kind: "CHOICE", options: PROPERTY_METHOD },
    {
      key: "payerSide",
      label: "お支払いになる方",
      kind: "CHOICE",
      options: PAYER_SIDE,
      visibleWhen: { field: "method", equals: "LUMP_SUM" },
    },
    {
      key: "amountYen",
      label: "金額",
      kind: "AMOUNT",
      placeholder: "1000000",
      visibleWhen: { field: "method", equals: "LUMP_SUM" },
    },
    {
      key: "dueDate",
      label: "お支払いの期限",
      kind: "DATE",
      visibleWhen: { field: "method", equals: "LUMP_SUM" },
    },
  ],
  PENSION_SPLIT: [
    { key: "pensionMethod", label: "どうされますか", kind: "CHOICE", options: PENSION_METHOD },
  ],
};

/** ★この論点で、いま出すべき項目 */
export function visibleFields(
  topic: string,
  values: Record<string, unknown>,
): readonly Field[] {
  return (TOPIC_FIELDS[topic] ?? []).filter(
    (f) => !f.visibleWhen || values[f.visibleWhen.field] === f.visibleWhen.equals,
  );
}

/**
 * 値を画面の表記にする。
 *
 * ★条項（CODE_LABELS）とは別。用途が違う。
 * ★変換できない値は null。**コード値をそのまま画面に出さない。**
 */
export function displayValue(f: Field, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (f.options) {
    return f.options.find(([v]) => v === String(value))?.[1] ?? null;
  }
  if (f.kind === "AMOUNT") {
    const n = Number(value);
    return Number.isFinite(n) ? `${n.toLocaleString("ja-JP")}円` : null;
  }
  if (f.kind === "TIME_RANGE") {
    const m = String(value).match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    return m ? `${m[1]}時${m[2] === "00" ? "" : m[2] + "分"}〜${m[3]}時${m[4] === "00" ? "" : m[4] + "分"}` : null;
  }
  if (f.kind === "DATE") {
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日` : null;
  }
  return String(value);
}

/** 内容の再掲。★入っているものだけを、入っている順に */
export function recapOf(
  topic: string,
  payload: Record<string, unknown>,
): { label: string; value: string }[] {
  return visibleFields(topic, payload)
    .map((f) => ({ label: f.label, value: displayValue(f, payload[f.key]) }))
    .filter((r): r is { label: string; value: string } => r.value !== null);
}

/**
 * 一部だけの変更を、読める文にする。
 *
 * ★「今回だけ」の変更は payload の一部しか持たない。
 *   recapOf は visibleWhen で絞るため、条件になる項目が無いと落ちてしまう。
 *   **絞らずに、入っているものだけを読む。**
 */
export function changeSummary(topic: string, change: Record<string, unknown>): string {
  return (TOPIC_FIELDS[topic] ?? [])
    .map((f) => ({ f, v: displayValue(f, change[f.key]) }))
    .filter((x) => x.v !== null)
    .map((x) => `${x.f.label} ${x.v}`)
    .join("／");
}

/**
 * 2つの案を項目ごとに比べる。
 *
 * ★S-4（お相手から別の案）で使う。
 *   **合っている項目を先に、多く見せる。**残りの作業量が見えるように。
 */
export type Comparison = {
  same: { label: string; value: string }[];
  different: { label: string; mine: string | null; theirs: string | null }[];
};

export function compare(
  topic: string,
  mine: Record<string, unknown>,
  theirs: Record<string, unknown>,
): Comparison {
  const same: Comparison["same"] = [];
  const different: Comparison["different"] = [];

  // ★どちらかにしか無い項目も落とさない
  for (const f of TOPIC_FIELDS[topic] ?? []) {
    const a = displayValue(f, mine[f.key]);
    const b = displayValue(f, theirs[f.key]);
    if (a === null && b === null) continue;
    if (a !== null && a === b) same.push({ label: f.label, value: a });
    else different.push({ label: f.label, mine: a, theirs: b });
  }
  return { same, different };
}
