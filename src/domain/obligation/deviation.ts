/**
 * 逸脱検知と法的状態
 *
 * ★アプリは入金を観測できない（S8 と同じ）。
 *   検知するのは「**記録が無いまま期日を過ぎた**」ことであって、
 *   「支払われていない」ことではない。
 *
 * @see docs/functional-design.md §5.6
 */

import type { Obligation } from "./schedule";

/** ★猶予。振込の反映遅れがありうるため、期日直後には検知しない */
export const GRACE_DAYS = 5;

export type Deviation = {
  key: string;
  dueDate: string;
  amountYen: number;
  daysPast: number;
};

/**
 * ★key と期日・金額だけを見る。義務の全体を要求しない。
 *
 * ★金額のあるものだけを検査する。
 *   面会交流には実施の記録がまだ無いため、**守られていないとは書けない。**
 *   観測できないことを断定しない、という規律は面会交流でも同じである。
 */
type Checkable = Pick<Obligation, "dueDate"> & { key: string; amountYen: number };

export function detectDeviations(
  obligations: readonly Checkable[],
  fulfillments: Record<string, { paidBy?: string; receivedBy?: string }>,
  now: { today: string },
): Deviation[] {
  const today = Date.parse(now.today);

  return obligations.flatMap((o) => {
    const f = fulfillments[o.key];
    // ★どちらか一方でも記録があれば検知しない
    if (f?.paidBy || f?.receivedBy) return [];

    const days = Math.floor((today - Date.parse(o.dueDate)) / 86_400_000);
    if (days <= GRACE_DAYS) return [];

    return [{ key: o.key, dueDate: o.dueDate, amountYen: o.amountYen, daysPast: days }];
  });
}

/**
 * ★責める語彙を使わない。
 *   「確認できていない」であって「支払われていない」ではない。
 */
export const DEVIATION_LABELS = {
  NOTICE: "お支払いの記録が確認できていません",
  DETAIL: "行き違いの可能性もあります。まずは記録をご確認ください。",
} as const;

// ---------------------------------------------------------------------------

/**
 * 先取特権の範囲判定
 *
 * ★閾値を検証せずに断定しない（算定表と同じ扱い）。
 *   法的な数字であり、誤ると当事者の手続きの選択を誤らせる。
 *   未検証のあいだは、出力に注記が必ず付く。
 */
export const PRIORITY_CLAIM_CAVEAT =
  "※この判定の基準額は未検証です。実際の手続きは、必ず専門家にご確認ください。";

export type PriorityClaimTable = {
  perChildYen: number;
  verified: boolean;
  sourceNote: string;
};

export type Enforceability = {
  withinPriorityClaim: boolean;
  limitYen: number;
  excessYen: number;
  /** ★客観的情報の提示に留める。「差押えをすべき」とは言わない */
  explanation: string;
  caveat?: string;
};

export function assessEnforceability(
  input: { monthlyAmountYen: number; childCount: number },
  table: PriorityClaimTable,
): Enforceability | null {
  // ★子の人数が分からなければ判定しない。推測しない
  if (input.childCount <= 0) return null;

  const limitYen = table.perChildYen * input.childCount;
  const excessYen = Math.max(0, input.monthlyAmountYen - limitYen);
  const within = excessYen === 0;

  const base = within
    ? `取り決めた月額は、先取特権の範囲（お子さん1人あたり月${(table.perChildYen / 10000).toFixed(0)}万円）に収まっています。債務名義がなくても手続きに進める場合があります。`
    : `取り決めた月額のうち、月${excessYen.toLocaleString()}円分は先取特権の範囲を超えます。この部分については、公正証書などの債務名義が必要になる場合があります。`;

  const caveat = table.verified ? undefined : PRIORITY_CLAIM_CAVEAT;

  return {
    withinPriorityClaim: within,
    limitYen,
    excessYen,
    // ★注記を explanation に不可分に含める。
    //   別フィールドにすると、explanation だけを描画した実装で注記が消える
    //   （レビューで検出）。算定表の formatRange と同じ考え方。
    explanation: caveat ? `${base}\n${caveat}` : base,
    ...(caveat ? { caveat } : {}),
  };
}
