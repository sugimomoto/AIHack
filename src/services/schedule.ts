import { asCaseId, type PartyId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import {
  fulfillmentStateOf,
  generateObligations,
  labelOf,
  type FulfillmentState,
} from "@/domain/obligation/schedule";
import { remindersFor } from "@/domain/obligation/reminder";
import { assessEnforceability, detectDeviations } from "@/domain/obligation/deviation";
import {
  listAgreementItems,
  loadForLlm,
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
  dueDate: string;
  amountYen: number;
  isOwnObligation: boolean;
  state: FulfillmentState;
  label: string;
  /** 自分が申告できる種別。★義務者は支払い、権利者は入金 */
  canReport: "PAID" | "RECEIVED" | null;
};

export async function loadSchedule(input: { caseId: string; partyId: PartyId; today: string }) {
  const caseId = asCaseId(input.caseId);
  const snap = await loadForLlm(caseId);
  assertOwnParty(snap, input.partyId);

  // ★義務者＝非監護親（C-01 として暫定）
  const obligor = snap.parties.find((p) => p.role === "NON_CUSTODIAL")?.id ?? snap.parties[0]?.id ?? "";
  const items = await listAgreementItems(caseId);
  const fulfillments = await loadFulfillments(caseId);

  // ★過去にさかのぼって生成する。
  //   当月以降しか作らないと、期日を過ぎた分が存在せず、
  //   **逸脱を永遠に検知できない**（実機で発覚した）。
  const from = monthsBefore(input.today, PAST_MONTHS);
  const obligations = generateObligations({
    items,
    from,
    months: PAST_MONTHS + FUTURE_MONTHS,
    obligorPartyId: obligor,
  });

  const rows: ScheduleRow[] = obligations
    // ★画面には、これから来る分と、直近で記録の無い分だけを出す
    .filter((o) => o.dueDate >= monthsBefore(input.today, 1))
    .map((o) => {
    const key = `${o.topic}_${o.dueDate}`;
    const f = fulfillments[key] ?? {};
    const state = fulfillmentStateOf({
      paidReported: Boolean(f.paidBy),
      receivedReported: Boolean(f.receivedBy),
    });
    const isOwn = o.obligorPartyId === input.partyId;
    return {
      key,
      dueDate: o.dueDate,
      amountYen: o.amountYen,
      isOwnObligation: isOwn,
      state,
      label: labelOf(state),
      canReport: isOwn ? (f.paidBy ? null : "PAID") : f.receivedBy ? null : "RECEIVED",
    };
  });

  const keyed = obligations.map((o) => ({ ...o, key: `${o.topic}_${o.dueDate}` }));
  const deviations = detectDeviations(keyed, fulfillments, { today: input.today });

  // ★先取特権の判定。閾値が未検証のあいだは注記が付く
  const monthly = obligations[0]?.amountYen ?? 0;
  const childCount = snap.children.length;
  const enforceability =
    deviations.length > 0 && monthly > 0
      ? assessEnforceability({ monthlyAmountYen: monthly, childCount }, PRIORITY_CLAIM_TABLE)
      : null;

  return {
    rows,
    // ★自分の義務のぶんだけ。相手には出さない
    reminders: remindersFor(obligations, { partyId: input.partyId, today: input.today }).map((o) => ({
      dueDate: o.dueDate,
      amountYen: o.amountYen,
    })),
    // ★逸脱は双方に見える。片方だけが知る状態にしない
    deviations,
    enforceability,
  };
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
  await reportFulfillment(caseId, input.key, input.partyId, input.kind);
}
