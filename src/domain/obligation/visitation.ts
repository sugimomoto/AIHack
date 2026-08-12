/**
 * 面会交流の日程
 *
 * ★「面会交流に『期日と金額』は無い」と書いて、予定を作らなかった。
 *   **期日が無いというのは誤りだった。**
 *   「月1回・第2土曜」は日付に落ちる。落としていなかっただけである。
 *
 * ★結果として、お金の義務だけが毎月並び、会う日は一度も並ばなかった。
 *   **片方だけを並べる仕組みは、それ自体が立場を作る**（→ Issue #5）。
 *
 * ★合意と同じく、決定的に導く。LLM を使わない。
 * ★値が欠けていたら作らない。推測して日付を作らない。
 */
const DOW: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

/** 月1回・月2回・週1回。★未知の頻度では予定を作らない */
const PER_MONTH: Record<string, number> = { MONTHLY_1: 1, MONTHLY_2: 2 };

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** その月の「第n週の指定曜日」。★存在しなければ作らない（第5土曜が無い月がある） */
export function nthWeekdayOf(
  year: number,
  month: number,
  dayOfWeek: string,
  nth: number,
): string | null {
  const target = DOW[dayOfWeek];
  if (target === undefined || nth < 1 || nth > 5) return null;

  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (target - firstDow + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // ★その月に第n週の該当曜日が無いことがある。作らない
  return day > lastDay ? null : ymd(year, month, day);
}

/** その月の、指定曜日すべて */
function allWeekdaysOf(year: number, month: number, dayOfWeek: string): string[] {
  const out: string[] = [];
  for (let n = 1; n <= 5; n++) {
    const d = nthWeekdayOf(year, month, dayOfWeek, n);
    if (d) out.push(d);
  }
  return out;
}

/**
 * 面会交流の日付を作る。
 *
 * ★曜日が決まっていなければ、日付にならない。
 *   「月1回」だけでは、いつ会うのか決まっていない。
 *   **決まっていないものを、こちらで決めない。**
 */
export function visitationDatesOf(input: {
  payload: Record<string, unknown> | null;
  fromYear: number;
  fromMonth: number;
  months: number;
}): string[] {
  const p = input.payload;
  if (!p) return [];

  const frequency = typeof p.frequency === "string" ? p.frequency : null;
  const dayOfWeek = typeof p.dayOfWeek === "string" ? p.dayOfWeek : null;
  if (!frequency || !dayOfWeek || DOW[dayOfWeek] === undefined) return [];

  const week = typeof p.weekOfMonth === "number" ? p.weekOfMonth : null;
  const out: string[] = [];

  for (let k = 0; k < input.months; k++) {
    const m = input.fromMonth + k;
    const year = input.fromYear + Math.floor((m - 1) / 12);
    const month = ((m - 1) % 12) + 1;

    if (frequency === "WEEKLY_1") {
      out.push(...allWeekdaysOf(year, month, dayOfWeek));
      continue;
    }

    const times = PER_MONTH[frequency];
    // ★未知の頻度（OTHER など）では作らない
    if (!times) continue;

    if (week) {
      const d = nthWeekdayOf(year, month, dayOfWeek, week);
      if (d) out.push(d);
      // ★月2回で第n週だけ決まっている場合、2回目は決まっていない。作らない
      continue;
    }

    // ★週が決まっていなければ、第1週から順に置く
    for (let n = 1; n <= times; n++) {
      const d = nthWeekdayOf(year, month, dayOfWeek, n);
      if (d) out.push(d);
    }
  }
  return out;
}
