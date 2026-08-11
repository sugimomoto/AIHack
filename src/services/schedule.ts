import { asCaseId, type PartyId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import {
  fulfillmentStateOf,
  generateObligations,
  labelOf,
  type FulfillmentState,
} from "@/domain/obligation/schedule";
import { remindersFor } from "@/domain/obligation/reminder";
import {
  listAgreementItems,
  loadForLlm,
  loadFulfillments,
  reportFulfillment,
} from "@/infra-adapters/firestore/repositories/caseRepository";

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

  const from = `${input.today.slice(0, 7)}-01`;
  const obligations = generateObligations({ items, from, months: 6, obligorPartyId: obligor });

  const rows: ScheduleRow[] = obligations.map((o) => {
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

  return {
    rows,
    // ★自分の義務のぶんだけ。相手には出さない
    reminders: remindersFor(obligations, { partyId: input.partyId, today: input.today }).map((o) => ({
      dueDate: o.dueDate,
      amountYen: o.amountYen,
    })),
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
