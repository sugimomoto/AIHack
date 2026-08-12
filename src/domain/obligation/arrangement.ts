/**
 * 軽い約束（L2）
 *
 * ★「8月22日でOKです」と了承しても、どこにも残らなかった。
 *
 *   L2（調整）は合意を求めない。それは設計どおりである。
 *   だが**了承した日付が消える**のは別の話だった。
 *   L2 の行き先である「これから」が、お金の義務しか受け取っていなかった。
 *
 * ★これは取り決めではない。**公正証書には載らない。**
 *   「8月22日の送迎」が条項に入るのはおかしい。
 *   載るのは「これから」だけ。
 */
import type { Intent } from "@/domain/dialogue/intent";

/** ★了承があって、はじめて約束になる。提案だけでは作らない */
export function isAccepted(intents: readonly Intent[]): boolean {
  return intents.includes("ACCEPT");
}

/**
 * 約束を作る。
 *
 * ★日付が無ければ作らない。**いつの約束か分からないものを予定にしない。**
 * ★年は補わない。書かれていない年を足すと、事実を作ることになる。
 */
export function arrangementFrom(input: {
  payload: Record<string, unknown> | null;
  intents: readonly Intent[];
  /** 年の補完に使う基準日（YYYY-MM-DD） */
  today: string;
}): { date: string; label: string } | null {
  if (!isAccepted(input.intents)) return null;
  const p = input.payload;
  if (!p) return null;

  const date = resolveDate(typeof p.date === "string" ? p.date : null, input.today);
  if (!date) return null;

  const parts = [
    typeof p.time === "string" ? p.time.trim() : "",
    typeof p.place === "string" ? p.place.trim() : "",
    typeof p.subject === "string" ? p.subject.trim() : "",
  ].filter((x) => x !== "" && !/^\d{5,}$/.test(x));

  return { date, label: parts.join(" ") || "お約束" };
}

/**
 * 「8月22日」を日付にする。
 *
 * ★年は書かれない。基準日から決める。
 *   過ぎている月なら翌年（「1月20日」を8月に言えば来年）。
 * ★読み取れないものは作らない。
 */
export function resolveDate(v: string | null, today: string): string | null {
  if (!v) return null;
  const t = today.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!t) return null;

  const iso = v.match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?$/);
  if (iso) return fmt(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const md = v.match(/^(\d{1,2})[-/月](\d{1,2})日?$/);
  if (!md) return null;

  const [y0, m0, d0] = [Number(t[1]), Number(t[2]), Number(t[3])];
  const m = Number(md[1]);
  const d = Number(md[2]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  // ★過ぎている月日なら翌年のこと
  const year = m < m0 || (m === m0 && d < d0) ? y0 + 1 : y0;
  return fmt(year, m, d);
}

function fmt(y: number, m: number, d: number): string | null {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (m < 1 || m > 12 || d < 1 || d > last) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
