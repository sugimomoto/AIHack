import { asCaseId, type PartyId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import {
  canReport,
  fulfillmentStateOf,
  generateObligations,
  labelOf,
  type FulfillmentState,
} from "@/domain/obligation/schedule";
import { remindersFor } from "@/domain/obligation/reminder";
import { assessEnforceability, detectDeviations } from "@/domain/obligation/deviation";
import { adjustmentStateOf } from "@/domain/adjustment/record";
import {
  listAgreementItems,
  loadForLlm,
  listArrangements,
  listAdjustments,
  loadFulfillments,
  reportFulfillment,
} from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * ★先取特権の基準額。R-19 として未検証。
 *   検証が済むまで、判定の出力に注記が付く（→ assessEnforceability）。
 */
/** さかのぼる月数。逸脱の検知に必要 */
const PAST_MONTHS = 6;
const FUTURE_MONTHS = 6;

/** YYYY-MM-DD から n ヶ月前の月初 */
function monthsBefore(date: string, n: number): string {
  const [y, m] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) - n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

const PRIORITY_CLAIM_TABLE = {
  perChildYen: 80_000,
  verified: false,
  sourceNote: "★未検証。弁護士へのヒアリングに基づく暫定値であり、一次資料での確認が必要（R-19）。",
};

/**
 * 予定と履行
 *
 * ★予定は保存しない。合意から毎回導く。
 *   保存すると、合意を変えたときに予定と食い違う。
 *   **決定的に導けるものを保存しない。**
 */

export type ScheduleRow = {
  key: string;
  topic: string;
  dueDate: string;
  /** ★面会交流には金額が無い。無いものを 0 と書かない */
  amountYen: number | null;
  isOwnObligation: boolean;
  state: FulfillmentState;
  label: string;
  /** 自分が申告できる種別。★義務者は支払い、権利者は入金 */
  canReport: "PAID" | "RECEIVED" | null;
  /** ★時間や場所。合意にあるものだけを出す（推測しない） */
  detail: string | null;
};

/** ★不正な日付を通すと、全件が偽の逸脱になる（レビューで検出） */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class InvalidDateError extends Error {
  constructor() {
    super("日付の指定が正しくありません");
    this.name = "InvalidDateError";
  }
}

/**
 * 決まったこと（旧「これから」）
 *
 * ★★ 予定を管理しない。**スケジュール管理はこのアプリの役目ではない。**
 *
 *   以前は、毎月の支払日・会う日を生成し、履行の申告を受け、
 *   逸脱を検知し、リマインドを出していた。**全部やめた。**
 *
 *     手間 → 押されない → 記録が無い → 逸脱として検知される
 *                                        ↓
 *                   実際には払っているのに「確認できていません」と出る
 *                                        ↓
 *                        ★ 摩擦を作る。このアプリが減らすはずのもの
 *
 *   > 記録率が低い台帳は、正しい信号より誤った信号を多く出す。
 *
 * ★★ 返す内容そのものを絞る。**画面で隠さない。**
 *   画面だけ消しても、API を見れば逸脱が読める。
 *   「出さないと決めたもの」は、出さない側で止める。
 *
 * ★generateObligations・detectDeviations・remindersFor などは**残してある。**
 *   呼ばないだけ。Issue #7（証跡と精算）で作り直すときの土台になる。
 *
 * @see .steering/20260812-feedback-pivot/design-upcoming.md
 */
export async function loadSchedule(input: { caseId: string; partyId: PartyId; today: string }) {
  if (!DATE_RE.test(input.today) || Number.isNaN(Date.parse(input.today))) throw new InvalidDateError();
  const caseId = asCaseId(input.caseId);
  const snap = await loadForLlm(caseId);
  assertOwnParty(snap, input.partyId);

  const [adjustments, arrangements] = await Promise.all([
    listAdjustments(caseId).catch(() => []),
    listArrangements(caseId).catch(() => []),
  ]);

  const parties = snap.parties.map((p) => p.id as string);

  // ★★ 読む先を直した。
  //
  //   以前は `exceptions` を読んでいたが、**そこには何も入らない。**
  //   `appendException` は applyAdjustment(ONE_TIME) からしか呼ばれず、
  //   取り決めの入力が作る提案は必ず PERMANENT だからである。
  //   → 「今回だけ」の枠は、一度も表示されていなかった（実機で検出）。
  //
  //   相談の帰結は `adjustments` に入っている。**こちらを読む。**
  //
  // ★★ ただし、揃ったものだけ。
  //   片方が出しただけのものを「決まったこと」に並べてはいけない。
  //   合意・ルールと同じ規律である。
  const byThread = new Map<string, typeof adjustments>();
  for (const a of adjustments) {
    const key = a.threadId ?? "_";
    byThread.set(key, [...(byThread.get(key) ?? []), a]);
  }

  const decided: {
    id: string;
    topic: string;
    change: Record<string, unknown>;
    effect: "ONE_TIME" | "PERMANENT" | null;
  }[] = [];
  for (const [key, entries] of byThread) {
    if (adjustmentStateOf(entries, parties) !== "AGREED") continue;
    // ★当事者ごとの最新は一致している（揃っている）ので、どれを出しても同じ
    const last = entries[entries.length - 1];
    decided.push({ id: key, topic: last.topic, change: last.change, effect: last.effect });
  }

  return {
    // ★取り決めではない軽い約束（L2）。公正証書には載らない
    arrangements: arrangements.filter((a) => a.date >= monthsBefore(input.today, 1)),
    // ★揃った調整。取り決めそのものは変わっていない
    decided,
  };
}

export class InvalidReportError extends Error {
  constructor() {
    super("この記録はご自身の立場では登録できません");
    this.name = "InvalidReportError";
  }
}

export async function recordFulfillment(input: {
  caseId: string;
  partyId: PartyId;
  key: string;
  kind: "PAID" | "RECEIVED";
}) {
  const caseId = asCaseId(input.caseId);
  const snap = await loadForLlm(caseId);
  assertOwnParty(snap, input.partyId);

  // ★立場を検証する。義務者が「入金を確認しました」と申告できると、
  //   逸脱検知を永久に無効化できる（レビューで検出）。
  const obligor = snap.parties.find((p) => p.role === "NON_CUSTODIAL")?.id ?? snap.parties[0]?.id ?? "";
  if (!canReport({ isObligor: obligor === input.partyId, kind: input.kind })) {
    throw new InvalidReportError();
  }

  await reportFulfillment(caseId, input.key, input.partyId, input.kind);
}
