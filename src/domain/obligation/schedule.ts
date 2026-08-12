import { visitationDatesOf } from "./visitation";
/**
 * 予定と履行
 *
 * ★合意から決定的に導く。LLM を使わない。
 *   予定が揺れると、それ自体が新しい争点になる。
 *
 * ★アプリは入金を観測できない。
 *   **観測できないことを断定しない。**
 *   「未払い」と書いた瞬間、事実でないことを相手に伝える可能性が生まれる
 *   （振込の反映遅れがありうる）。
 *
 * @see docs/functional-design.md §5.6
 * @see docs/glossary.md §4
 */

export type Obligation = {
  topic: string;
  dueDate: string;
  /** ★面会交流には金額が無い。お金の義務だけを予定にしていた（→ Issue #5） */
  amountYen: number | null;
  obligorPartyId: string;
};

/** 支払日コード → その月の日 */
const PAY_DAY: Record<string, number | "LAST"> = {
  DAY_5: 5,
  DAY_10: 10,
  DAY_25: 25,
  LAST_DAY: "LAST",
};

/**
 * 期日を作る。
 *
 * ★31日の無い月では末日にする。2月31日という期日を作らない。
 * ★未知のコードでは期日を作らない（推測しない）。
 */
export function dueDateOf(payDayCode: string, year: number, month: number): string | null {
  const spec = PAY_DAY[payDayCode];
  if (spec === undefined) return null;

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = spec === "LAST" ? lastDay : Math.min(spec, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type AgreementItemInput = {
  topic: string;
  status: string;
  payload: Record<string, unknown> | null;
  /** ★合意が成立した日時。これより前の期日は義務にしない */
  agreedAt?: string;
};

/**
 * 合意から予定を作る。
 *
 * ★値が欠けていたら作らない。推測して期日や金額を作らない。
 *
 * ★面会交流も対象にする。
 *   「期日が無い」と書いて外していたが、**それは誤りだった。**
 *   「月1回・第2土曜」は日付に落ちる。
 */
export function generateObligations(input: {
  items: readonly AgreementItemInput[];
  /** 起点（YYYY-MM-DD） */
  from: string;
  months: number;
  obligorPartyId: string;
}): Obligation[] {
  const out: Obligation[] = [];
  const [y0, m0] = input.from.split("-").map(Number);

  for (const item of input.items) {
    if (item.status !== "AGREED") continue;
    // ★合意の始期が分からなければ作らない。
    //   いつからの義務か分からないものを「守られていない」と言えない。
    if (!item.agreedAt) continue;
    const since = item.agreedAt.slice(0, 10);

    if (item.topic === "CHILD_SUPPORT") {
      const amount = item.payload?.monthlyAmount;
      const payDay = item.payload?.payDay;
      if (typeof amount !== "number" || typeof payDay !== "string") continue;

      for (let k = 0; k < input.months; k++) {
        const m = m0 + k;
        const year = y0 + Math.floor((m - 1) / 12);
        const month = ((m - 1) % 12) + 1;
        const dueDate = dueDateOf(payDay, year, month);
        if (!dueDate) continue;
        // ★合意より前の期日は義務にしない
        if (dueDate < since) continue;
        out.push({ topic: item.topic, dueDate, amountYen: amount, obligorPartyId: input.obligorPartyId });
      }
      continue;
    }

    if (item.topic === "VISITATION") {
      const dates = visitationDatesOf({
        payload: item.payload,
        fromYear: y0,
        fromMonth: m0,
        months: input.months,
      });
      for (const dueDate of dates) {
        if (dueDate < since) continue;
        // ★金額は無い。**無いものを 0 と書かない**
        out.push({ topic: item.topic, dueDate, amountYen: null, obligorPartyId: input.obligorPartyId });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

export const FULFILLMENT_STATES = [
  "NO_RECORD",
  "PAID_REPORTED",
  "RECEIVED_REPORTED",
  "CONFIRMED",
] as const;
export type FulfillmentState = (typeof FULFILLMENT_STATES)[number];

/**
 * ★双方の申告が揃ったときのみ「確認できました」。
 *
 * ★「双方」とは**別々の人**の申告である。
 *   同じ人が両方を申告しても、確認できたことにはならない。
 *   真偽値2つで判定していたため、これを見落としていた（レビューで検出）。
 */
export function fulfillmentStateOf(r: { paidBy?: string; receivedBy?: string }): FulfillmentState {
  const both = Boolean(r.paidBy) && Boolean(r.receivedBy) && r.paidBy !== r.receivedBy;
  if (both) return "CONFIRMED";
  if (r.paidBy) return "PAID_REPORTED";
  if (r.receivedBy) return "RECEIVED_REPORTED";
  return "NO_RECORD";
}

/**
 * ★申告できる種別は、立場で決まる。
 *
 *   義務者が「入金を確認しました」と申告できると、
 *   **逸脱検知を永久に無効化できる。**
 *   相手の画面には、相手が申告していない記録が現れる。
 */
export function canReport(input: { isObligor: boolean; kind: "PAID" | "RECEIVED" }): boolean {
  return input.isObligor ? input.kind === "PAID" : input.kind === "RECEIVED";
}

/**
 * ★責める語彙を使わない。
 *   「まだ記録がありません」は、「支払われていません」とは違う。
 *   アプリは入金を観測できないため、後者は書けない。
 */
export const FULFILLMENT_LABELS: Record<FulfillmentState, string> = {
  NO_RECORD: "まだ記録がありません",
  PAID_REPORTED: "お支払いの記録があります",
  RECEIVED_REPORTED: "入金の記録があります",
  CONFIRMED: "確認できました",
};

export function labelOf(s: FulfillmentState): string {
  return FULFILLMENT_LABELS[s];
}
