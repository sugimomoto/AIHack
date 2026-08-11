import type { PartyRecord } from "./types";

/**
 * ケースの開始
 *
 * ★最初の当事者は招待を受け取らない。自分でケースを作る。
 *
 * ★相手の枠を先に作る。
 *   招待の宛先が決まらないと、取次ぎの経路が定義できない。
 *   ただし**相手はまだ何も持たない**（PREPARING）。
 *
 * @see docs/functional-design.md §5.7
 */

export type CaseSeed = {
  case: { id: string; status: "SOLO"; createdAt: null };
  parties: Omit<PartyRecord, "caseId" | "authUid">[];
};

export function newCaseSeed(input: {
  caseId: string;
  ownPartyId: string;
  otherPartyId: string;
  role: "CUSTODIAL" | "NON_CUSTODIAL";
}): CaseSeed {
  const otherRole = input.role === "CUSTODIAL" ? "NON_CUSTODIAL" : "CUSTODIAL";

  // ★表示名に実名を入れない（U-1）。相手が付けた名前は後から設定できる
  const base = { displayNameForOther: "お相手", incomeBand: null } as const;

  return {
    case: { id: input.caseId, status: "SOLO", createdAt: null },
    parties: [
      { id: input.ownPartyId as PartyRecord["id"], role: input.role, state: "ACTIVE", ...base },
      { id: input.otherPartyId as PartyRecord["id"], role: otherRole, state: "PREPARING", ...base },
    ],
  };
}
