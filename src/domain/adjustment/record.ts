import { payloadsAgree } from "@/domain/agreement/consent";

/**
 * 調整（Adjustment）
 *
 * ★設計は帰結を kind で3つに分けていた。
 *
 *     kind=FORMAL       → AgreementItem の payload を埋める
 *     kind=ADJUSTMENT   → **Adjustment を作る**
 *     kind=NOTIFICATION → Notification を届ける
 *
 *   実装は topic だけで分岐しており、**ADJUSTMENT の行き先が無かった。**
 *   その結果、「進学費用の分担」が養育費への提案になり、
 *   合意済みの月額を書き換えうる状態だった。
 *
 * ★Adjustment は双方の合意を要するが、**公正証書には載らない。**
 *   「入学金を半分ずつ」が条項になるのはおかしい。
 *   載るのは「これから」と、その相談の記録だけ。
 *
 * ★取り決めそのものには触れない。
 *   合意済みのものを変えたいときは、変更の申し出（K-6）を通る。
 */
export const ADJUSTMENT_STATES = ["WAITING", "AGREED"] as const;
export type AdjustmentState = (typeof ADJUSTMENT_STATES)[number];

export const ADJUSTMENT_LABEL: Record<AdjustmentState, string> = {
  WAITING: "おふたりのご意向を待っています",
  AGREED: "おふたりのお考えが、同じところに来ました",
};

/** ★公正証書には載らないことを、その場に書く */
export const ADJUSTMENT_NOTE =
  "このお話は、公正証書の原案には入りません。いまの取り決めも変わりません。";

type Entry = { byPartyId: string; change: Record<string, unknown> | null };

/**
 * 揃ったかを見る。
 *
 * ★合意と同じ規律。**双方が出していて、かつ内容が一致したときだけ揃う。**
 *   片方だけで確定させると、相手が同意していないものが記録に残る。
 *
 * ★人数は当事者の数で決める。1人しかいないケースで揃ったことにしない。
 */
export function adjustmentStateOf(entries: readonly Entry[], partyIds: readonly string[]): AdjustmentState {
  if (partyIds.length < 2) return "WAITING";

  // ★当事者ごとに最新の1件だけを見る（作成順で最後が最新）
  const latest = new Map<string, Record<string, unknown> | null>();
  for (const e of entries) latest.set(e.byPartyId, e.change);

  const payloads = partyIds.map((id) => latest.get(id) ?? null);
  if (payloads.some((p) => p === null)) return "WAITING";
  return payloadsAgree(payloads) ? "AGREED" : "WAITING";
}
