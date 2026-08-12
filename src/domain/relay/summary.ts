import { CODE_LABELS } from "@/domain/document/builder";

/**
 * 構造化された提案から、要約を組み立てる。
 *
 * ★逐語一致（INV-4a）で要約が落ちたときの受け皿。
 *
 *   短く素直に書いた発言ほど、要約が原文と一致してしまい落ちる。
 *   その結果、相手に届くのが「ご相談が来ています。」だけになっていた。
 *   **はっきり書いた人ほど、伝わる中身が減っていた。**
 *
 * ★これは原文から作らない。**抽出済みの構造化された値だけを使う。**
 *   したがって、そもそも逐語一致が起こりえない。
 *
 * ★値が読めなければ、その項目を出さない（G-3b と同じ規律）。
 */
const ORDER = ["monthlyAmount", "payDay", "until", "frequency", "dayOfWeek"] as const;

const PHRASE: Record<string, (v: string) => string> = {
  monthlyAmount: (v) => `月額${v}`,
  payDay: (v) => `お支払いは${v}`,
  until: (v) => `${v}まで`,
  frequency: (v) => `${v}`,
  dayOfWeek: (v) => `${v}`,
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
  if (s === "" || /^[A-Z][A-Z0-9_]{2,}$/.test(s)) return null;
  return s;
}

/**
 * ★読める項目が一つも無ければ null。
 *   そのときだけ「ご相談が来ています。」に落とす。
 */
export function summaryFromPayload(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;

  const parts = ORDER.map((k) => {
    if (!(k in payload)) return null;
    const v = display(k, payload[k]);
    return v === null ? null : PHRASE[k](v);
  }).filter((x): x is string => x !== null);

  if (parts.length === 0) return null;
  return `${parts.join("、")}をご希望とのことです。`;
}
