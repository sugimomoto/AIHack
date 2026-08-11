import { describe, expect, it } from "vitest";
import { asConsultationId, asPartyId } from "@/domain/case/types";
import { scopedMessages, scopedInbound, assertOwnParty, ScopeViolationError } from "@/domain/case/scope";
import type { CaseSnapshot } from "@/domain/context/snapshot";
import { asAgreementItemId, asCaseId, asProposalId } from "@/domain/case/types";

/**
 * ★API層のスコープ規約（A-1〜A-6）
 *
 * すべての読み取りは呼び出し元の partyId でスコープされる。
 * 他者のIDを指定しても他者のデータは返らない。
 *
 * ★このテストは実装より先に書かれた（→ docs/development-guidelines.md §5.0）
 */

const A = asPartyId("party_a");
const B = asPartyId("party_b");
const A_RAW = "また勝手に土曜に決めやがって";
const B_RAW = "もう関わりたくない";

const SNAP: CaseSnapshot = {
  caseId: asCaseId("case_1"),
  parties: [
    { id: A, caseId: asCaseId("case_1"), authUid: "uid_a", role: "NON_CUSTODIAL",
      displayNameForOther: "お相手", incomeBand: "400-425", state: "ACTIVE" },
    { id: B, caseId: asCaseId("case_1"), authUid: "uid_b", role: "CUSTODIAL",
      displayNameForOther: "お相手", incomeBand: "200-225", state: "ACTIVE" },
  ],
  children: [],
  consultations: [
    { id: asConsultationId("c1"), caseId: asCaseId("case_1"), scenarioId: null,
      initiatedByPartyId: A, status: "OPEN" },
  ],
  messages: [
    { id: "m1", consultationId: asConsultationId("c1"), partyId: A, role: "USER",
      content: A_RAW, createdAt: "2026-08-11T00:00:00Z" },
    { id: "m2", consultationId: asConsultationId("c1"), partyId: B, role: "USER",
      content: B_RAW, createdAt: "2026-08-11T00:01:00Z" },
  ],
  agreementItems: [],
  proposals: [],
  mediationEvents: [
    { id: "e1", toPartyId: A, content: "Aさん宛の取次ぎ" },
    { id: "e2", toPartyId: B, content: "Bさん宛の取次ぎ" },
  ],
};

describe("A-2｜Message は呼び出し元自身のものしか返らない", () => {
  it("Aが読むと、Aの発言だけが返る", () => {
    const r = scopedMessages(SNAP, asConsultationId("c1"), A);
    expect(r.map((m) => m.content)).toEqual([A_RAW]);
  });

  it("★Aが読んでも、Bの原文は返らない", () => {
    const r = scopedMessages(SNAP, asConsultationId("c1"), A);
    expect(JSON.stringify(r)).not.toContain(B_RAW);
  });

  it("★存在しない当事者を指定しても、何も返らない", () => {
    expect(scopedMessages(SNAP, asConsultationId("c1"), asPartyId("intruder"))).toEqual([]);
  });
});

describe("A-1｜取次ぎは宛先でスコープされる", () => {
  it("Aには A宛のものだけが返る", () => {
    expect(scopedInbound(SNAP, A).map((e) => e.content)).toEqual(["Aさん宛の取次ぎ"]);
  });

  it("★Aに B宛の取次ぎは返らない", () => {
    expect(JSON.stringify(scopedInbound(SNAP, A))).not.toContain("Bさん宛");
  });
});

describe("★自分のケース以外にアクセスできない", () => {
  it("ケース内の当事者であれば通る", () => {
    expect(() => assertOwnParty(SNAP, A)).not.toThrow();
    expect(() => assertOwnParty(SNAP, B)).not.toThrow();
  });

  it("★ケース外の当事者は拒否される", () => {
    expect(() => assertOwnParty(SNAP, asPartyId("intruder"))).toThrow(ScopeViolationError);
  });

  it("★退会済みの当事者は拒否される", () => {
    const withdrawn: CaseSnapshot = {
      ...SNAP,
      parties: SNAP.parties.map((p) => (p.id === A ? { ...p, state: "WITHDRAWN" as const } : p)),
    };
    expect(() => assertOwnParty(withdrawn, A)).toThrow(ScopeViolationError);
  });
});
