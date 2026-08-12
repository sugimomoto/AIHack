import { CODE_LABELS } from "@/domain/document/builder";

/**
 * K-6 変更申請を受ける側
 *
 * ★「変更申請中」を「合意済」に戻すには相手の同意操作が要るのに、
 *   **その画面が無かった。** 状態機械に遷移があっても、押す場所が無ければ戻れない。
 *
 * ★3つの選択肢をすべて同じ重さにする。
 *   **法的合意の変更なので、「よい」を強調した時点でダークパターンになる。**
 *
 * ★返事をしないあいだは現状が続くことを明示する。
 *   放置が不利にならないと分かって、はじめて落ち着いて選べる。
 */

export const REVISION_PENDING_NOTE =
  "いま決めなくてかまいません。お返事があるまで、いまの取り決めが続きます。";

/**
 * 申し出の背景。
 *
 * ★自由記述にしない。
 *
 *   最初は自由記述を取次ぎの検査に通す実装にしたが、**必ず落ちた。**
 *   検査は「原文と10文字以上一致しないこと」を求める。
 *   本人が書いた文をそのまま検査にかければ、当然すべて一致する。
 *   結果、理由は常に消え、書いた本人だけが「伝えた」と思い込む。
 *
 *   **書いたものが黙って消える経路を残さない。**
 *
 * ★代わりに、越えてよいカテゴリ（R-3 のホワイトリスト）から選ぶ。
 *   文はあらかじめ用意した伝聞形の定型文で、原文は一文字も越えない。
 */
export const REVISION_REASONS = [
  { code: "INCOME_EMPLOYMENT", label: "仕事や収入のこと", text: "お仕事の状況が変わったとのことです。" },
  { code: "CHILD_STATUS", label: "お子さんのこと", text: "お子さんの状況が変わったとのことです。" },
  { code: "SCHEDULE_CONSTRAINT", label: "日程のこと", text: "日程の都合がつかなくなったとのことです。" },
  { code: "HEALTH_LIVING", label: "健康や暮らしのこと", text: "健康や暮らしの状況が変わったとのことです。" },
] as const;

export type RevisionReasonCode = (typeof REVISION_REASONS)[number]["code"];

/** ★一覧に無いコードは通さない。ここが R-3 のホワイトリストそのものである */
export function reasonTextOf(code: string | null | undefined): string | null {
  return REVISION_REASONS.find((r) => r.code === code)?.text ?? null;
}

/**
 * ★3つとも同じ形にする。強調する印も、既定の選択も持たせない。
 *   `primary` のような区別をこの型に足さないこと。
 */
export const REVISION_CHOICES = [
  { action: "ACCEPT", label: "この内容でよい" },
  { action: "COUNTER", label: "別の案を出したい" },
  { action: "KEEP", label: "いまの取り決めのままにしたい" },
] as const;

export type RevisionAction = (typeof REVISION_CHOICES)[number]["action"];

export function parseRevisionAction(v: string | null | undefined): RevisionAction | null {
  const s = String(v ?? "").toUpperCase();
  return REVISION_CHOICES.some((c) => c.action === s) ? (s as RevisionAction) : null;
}

// ---------------------------------------------------------------------------

const LABELS: Record<string, string> = {
  monthlyAmount: "金額",
  payDay: "支払日",
  until: "終わり",
  frequency: "回数",
  dayOfWeek: "曜日",
  weekOfMonth: "週",
};

function display(key: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return null;

  const codes = CODE_LABELS[key];
  if (codes) return codes[String(value)] ?? null; // ★未知のコードは通さない

  if (key === "monthlyAmount" && typeof value === "number") {
    return `${value.toLocaleString("ja-JP")}円`;
  }
  if (typeof value === "number") return value.toLocaleString("ja-JP");
  if (typeof value === "boolean") return null;

  const s = String(value).trim();
  if (s === "") return null;
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(s)) return null;
  return s;
}

export type FieldChange = { key: string; label: string; from: string; to: string };

export type ChangeDescription = {
  changed: FieldChange[];
  unchanged: string[];
  /** ★「回数は変わりません。曜日と週が変わります。」 */
  sentence: string;
  /** ★読めない値があった。**黙って落とさず、その事実を持ち回る** */
  hasUnreadable: boolean;
};

/**
 * 何が変わって、何が変わらないかを言葉にする。
 *
 * ★条文の差分を目で追わせない。
 *   「月1回・第2土曜 → 月1回・第3日曜」だけを並べると、
 *   回数が変わったのかどうかを読み手が判定することになる。
 */
export function describeChange(
  current: Record<string, unknown>,
  proposed: Record<string, unknown>,
): ChangeDescription {
  const changed: FieldChange[] = [];
  const unchanged: string[] = [];
  let hasUnreadable = false;

  for (const [key, label] of Object.entries(LABELS)) {
    if (!(key in current) && !(key in proposed)) continue;

    const before = display(key, current[key]);
    const after = display(key, key in proposed ? proposed[key] : current[key]);

    // ★片方でも読めなければ、変わったとも変わらないとも言わない
    if (before === null || after === null) {
      hasUnreadable = true;
      continue;
    }
    if (before === after) unchanged.push(label);
    else changed.push({ key, label, from: before, to: after });
  }

  return { changed, unchanged, sentence: sentenceOf(changed, unchanged), hasUnreadable };
}

function join(xs: string[]): string {
  return xs.join("と");
}

function sentenceOf(changed: FieldChange[], unchanged: string[]): string {
  const parts: string[] = [];
  // ★変わらないほうを先に言う。安心する材料を後回しにしない
  if (unchanged.length > 0) parts.push(`${join(unchanged)}は変わりません。`);
  if (changed.length > 0) parts.push(`${join(changed.map((c) => c.label))}が変わります。`);
  return parts.join("");
}
