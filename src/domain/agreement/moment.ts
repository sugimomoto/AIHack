import { CODE_LABELS } from "@/domain/document/builder";

/**
 * N-1 合意が成立した瞬間
 *
 * ★祝わない。紙吹雪も、バッジも、「おめでとうございます」もない。
 *
 *   **これは離婚の条件が決まった瞬間である。**
 *   祝われると、失ったものを思い出させる。
 *
 * ★「同じところに来ました」という言い方にする。
 *   **どちらかが譲ったという構図を作らない。**
 *   「合意できました」でも「まとまりました」でもなく、
 *   ふたりが同じ場所に着いた、という言い方にする。
 *
 * ★上下に線が1本ずつ引かれて、その中に内容が置かれるだけ。
 */

export const MOMENT_LEAD = "おふたりのお考えが、同じところに来ました。";
export const MOMENT_CAPTION = "取り決めになりました";
export const MOMENT_RECORD_NOTE = "おふたりの記録に残ります";

/**
 * ★変えたくなったときのことを、その場で言う。
 *   決まった瞬間に「もう変えられない」と感じさせない。
 *
 * ★論点ごとに書き分ける。
 *   面会交流の合意に「お支払いの日を入れました」と出ていた。
 *   **決まっていないことを、決まったように書いてはいけない。**
 */
const FOLLOW_UP: Record<string, string> = {
  CHILD_SUPPORT: "お支払いの日を「これから」に入れました。",
  VISITATION: "お会いになる日を「これから」に入れました。",
};

export const MOMENT_CHANGE_NOTE = "変えたくなったときは、いつでもおっしゃってください。";

export function momentFollowUp(topic: string): string {
  const head = FOLLOW_UP[topic];
  // ★予定に入らない論点で「入れました」と書かない
  return head ? `${head}${MOMENT_CHANGE_NOTE}` : MOMENT_CHANGE_NOTE;
}

/** @deprecated 論点ごとに書き分ける。momentFollowUp を使う */
export const MOMENT_FOLLOW_UP = momentFollowUp("CHILD_SUPPORT");

/**
 * 祝う語。
 *
 * ★実装が言葉を足したときに落とすための一覧である。
 *   テストがこの一覧で本文を検査する。
 */
export const CELEBRATORY_WORDS = [
  "おめでとう",
  "祝",
  "達成",
  "やりました",
  "素晴らしい",
  "すごい",
  "完了しました",
  "🎉",
  "✨",
  "🎊",
] as const;

export type MomentLine = { label: string; value: string };

/**
 * 表示する行を組み立てる。
 *
 * ★意味の定まらない値を出さない（G-3b）。
 *   コード値のまま出ると「MONTHLY_1」が条項に見えてしまう。
 *   **読めない行は、出さずに落とす。**
 */
const LABELS: Record<string, string> = {
  monthlyAmount: "養育費",
  payDay: "お支払い",
  until: "終わり",
  frequency: "回数",
  dayOfWeek: "曜日",
};

function display(key: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return null; // ★入れ子をそのまま出さない

  const codes = CODE_LABELS[key];
  if (codes) return codes[String(value)] ?? null; // ★未知のコードは通さない

  if (key === "monthlyAmount" && typeof value === "number") {
    return `月 ${value.toLocaleString("ja-JP")}円`;
  }
  if (typeof value === "number") return value.toLocaleString("ja-JP");
  if (typeof value === "boolean") return null;

  const s = String(value).trim();
  if (s === "") return null;
  // ★表記の定義が無いコード値を通さない
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(s)) return null;
  return s;
}

export function momentLinesOf(payload: Record<string, unknown>): MomentLine[] {
  const lines: MomentLine[] = [];
  for (const [key, label] of Object.entries(LABELS)) {
    if (!(key in payload)) continue;
    const v = display(key, payload[key]);
    if (v !== null) lines.push({ label, value: v });
  }
  return lines;
}

/** 「2026年8月12日 ／ おふたりの記録に残ります」 */
export function momentFooter(agreedOn: string): string {
  const [y, m, d] = agreedOn.split("-");
  if (!y || !m || !d) return MOMENT_RECORD_NOTE;
  return `${y}年${Number(m)}月${Number(d)}日 ／ ${MOMENT_RECORD_NOTE}`;
}
