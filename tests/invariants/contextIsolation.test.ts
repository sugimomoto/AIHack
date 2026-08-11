import { describe, expect, it } from "vitest";
import {
  buildContext,
  buildMediationContext,
  buildRelayContext,
} from "@/domain/context/builders";
import type { CaseSnapshot } from "@/domain/context/snapshot";
import { asAgreementItemId, asCaseId, asConsultationId, asPartyId, asProposalId } from "@/domain/case/types";

/**
 * ★INV-1〜4：C1（メッセージを転送しない）の不変条件
 *
 * これは機能テストではない。**プロダクトが成立する条件**の検証である。
 * 落ちたらリリースしない。
 *
 * ★このテストは実装より先に書かれた（→ docs/development-guidelines.md §5.0）
 */

// ---------------------------------------------------------------------------
// テスト用のケース。実在を想起させない架空データ
// ---------------------------------------------------------------------------

const A = asPartyId("party_a"); // 非監護親
const B = asPartyId("party_b"); // 監護親

/** ★これが相手に漏れてはならない */
const A_RAW = "また勝手に土曜に決めやがって。こっちだって必死なんだよ";
const B_RAW = "何度言っても聞かないから、もう関わりたくない";

const SNAPSHOT: CaseSnapshot = {
  caseId: asCaseId("case_1"),
  parties: [
    { id: A, caseId: asCaseId("case_1"), authUid: "uid_a", role: "NON_CUSTODIAL",
      displayNameForOther: "お相手", incomeBand: "400-425", state: "ACTIVE" },
    { id: B, caseId: asCaseId("case_1"), authUid: "uid_b", role: "CUSTODIAL",
      displayNameForOther: "お相手", incomeBand: "200-225", state: "ACTIVE" },
  ],
  contactInfos: [
    { partyId: A, address: "架空県架空市1-2-3", phone: "090-0000-0000",
      employer: "架空商事", annualIncome: 4_380_000 },
    { partyId: B, address: "架空県別市4-5-6", phone: "090-1111-1111",
      employer: "架空製作所", annualIncome: 2_100_000 },
  ],
  children: [{ id: "child_1", birthDate: "2018-05-01" }],
  consultations: [
    { id: asConsultationId("cons_1"), caseId: asCaseId("case_1"), scenarioId: "sc_007",
      initiatedByPartyId: B, status: "OPEN" },
  ],
  messages: [
    { id: "m1", consultationId: asConsultationId("cons_1"), partyId: A, role: "USER",
      content: A_RAW, createdAt: "2026-08-11T00:00:00Z" },
    { id: "m2", consultationId: asConsultationId("cons_1"), partyId: B, role: "USER",
      content: B_RAW, createdAt: "2026-08-11T00:01:00Z" },
  ],
  agreementItems: [
    { id: asAgreementItemId("ai_1"), topic: "VISITATION", status: "AGREED",
      payload: { frequency: "MONTHLY_1", handoverPlace: "○○駅" }, version: 1 },
  ],
  proposals: [
    { id: asProposalId("pr_1"), agreementItemId: asAgreementItemId("ai_1"),
      proposedByPartyId: A, payload: { dayOfWeek: "SUN" },
      context: "お相手は現在求職中とのことです", rationale: "算定表の範囲内", status: "PENDING" },
    { id: asProposalId("pr_2"), agreementItemId: asAgreementItemId("ai_1"),
      proposedByPartyId: B, payload: { dayOfWeek: "SAT" }, status: "PENDING" },
  ],
  mediationEvents: [
    { id: "me_1", toPartyId: B, content: "土曜の日程について、別案のご相談が来ています。" },
  ],
};

/** コンテキストを走査して、禁止文字列が含まれていないか調べる */
function flatten(v: unknown): string {
  return JSON.stringify(v ?? null);
}

// ===========================================================================
describe("INV-1｜相手の Message は自分のコンテキストに入らない", () => {
  it("Aのコンテキストに、Bの原文が含まれない", () => {
    const ctx = buildContext(SNAPSHOT, A);
    expect(flatten(ctx)).not.toContain(B_RAW);
  });

  it("Bのコンテキストに、Aの原文が含まれない", () => {
    const ctx = buildContext(SNAPSHOT, B);
    expect(flatten(ctx)).not.toContain(A_RAW);
  });

  it("自分の原文は自分のコンテキストに含まれる（受け止めに必要）", () => {
    expect(flatten(buildContext(SNAPSHOT, A))).toContain(A_RAW);
    expect(flatten(buildContext(SNAPSHOT, B))).toContain(B_RAW);
  });

  it("★取次ぎ用コンテキストに、いかなる原文も含まれない", () => {
    const ctx = buildRelayContext(SNAPSHOT, asProposalId("pr_1"));
    const s = flatten(ctx);
    expect(s).not.toContain(A_RAW);
    expect(s).not.toContain(B_RAW);
  });

  it("★調停用コンテキストに、いかなる原文も含まれない", () => {
    const ctx = buildMediationContext(SNAPSHOT, asAgreementItemId("ai_1"));
    const s = flatten(ctx);
    expect(s).not.toContain(A_RAW);
    expect(s).not.toContain(B_RAW);
  });
});

// ===========================================================================
describe("INV-2｜ContactInfo はいかなるコンテキストにも入らない", () => {
  const SECRETS = ["架空県架空市1-2-3", "090-0000-0000", "架空商事",
                   "架空県別市4-5-6", "090-1111-1111", "架空製作所"];

  const contexts = () => [
    ["buildContext(A)", buildContext(SNAPSHOT, A)],
    ["buildContext(B)", buildContext(SNAPSHOT, B)],
    ["buildRelayContext", buildRelayContext(SNAPSHOT, asProposalId("pr_1"))],
    ["buildMediationContext", buildMediationContext(SNAPSHOT, asAgreementItemId("ai_1"))],
  ] as const;

  it.each(contexts())("%s に非開示情報が含まれない", (_name, ctx) => {
    const s = flatten(ctx);
    for (const secret of SECRETS) expect(s).not.toContain(secret);
  });

  it("★自分自身のコンテキストにも住所は入らない（LLMに渡す必要がない）", () => {
    expect(flatten(buildContext(SNAPSHOT, A))).not.toContain("架空県架空市1-2-3");
  });
});

// ===========================================================================
describe("INV-2a｜精密な年収は越えない。越えるのは帯のみ", () => {
  const contexts = () => [
    ["buildContext(A)", buildContext(SNAPSHOT, A)],
    ["buildContext(B)", buildContext(SNAPSHOT, B)],
    ["buildRelayContext", buildRelayContext(SNAPSHOT, asProposalId("pr_1"))],
    ["buildMediationContext", buildMediationContext(SNAPSHOT, asAgreementItemId("ai_1"))],
  ] as const;

  it.each(contexts())("%s に精密な年収が含まれない", (_name, ctx) => {
    const s = flatten(ctx);
    expect(s).not.toContain("4380000");
    expect(s).not.toContain("2100000");
    expect(s).not.toContain("4,380,000");
  });

  it("調停用コンテキストには帯が含まれる（算定表の参照に必要）", () => {
    const s = flatten(buildMediationContext(SNAPSHOT, asAgreementItemId("ai_1")));
    expect(s).toContain("400-425");
  });
});

// ===========================================================================
describe("INV-3｜越境できるのは5つのみ", () => {
  it("★buildRelayContext は payload と context しか持たない", () => {
    const ctx = buildRelayContext(SNAPSHOT, asProposalId("pr_1"));
    expect(Object.keys(ctx).sort()).toEqual(
      ["context", "currentAgreement", "payload", "rationale", "topic"].sort(),
    );
  });

  it("取次ぎ用コンテキストに messages キーが存在しない", () => {
    const ctx = buildRelayContext(SNAPSHOT, asProposalId("pr_1")) as Record<string, unknown>;
    expect(ctx.messages).toBeUndefined();
    expect(ctx.ownMessages).toBeUndefined();
  });

  it("調停用コンテキストに messages キーが存在しない", () => {
    const ctx = buildMediationContext(SNAPSHOT, asAgreementItemId("ai_1")) as Record<string, unknown>;
    expect(ctx.messages).toBeUndefined();
    expect(ctx.ownMessages).toBeUndefined();
  });
});

// ===========================================================================
describe("INV-4a｜越境テキストは原文と長い一致を持たない", () => {
  /** N文字以上の連続一致があるか */
  function hasCommonRun(a: string, b: string, n: number): boolean {
    for (let i = 0; i + n <= a.length; i++) {
      if (b.includes(a.slice(i, i + n))) return true;
    }
    return false;
  }

  const N = 10;

  it("取次ぎの本文が、原文と10文字以上一致しない", () => {
    const relay = SNAPSHOT.mediationEvents[0].content;
    expect(hasCommonRun(A_RAW, relay, N)).toBe(false);
  });

  it("Proposal.context が、原文と10文字以上一致しない", () => {
    const ctx = SNAPSHOT.proposals[0].context ?? "";
    expect(hasCommonRun(A_RAW, ctx, N)).toBe(false);
  });

  it("検査関数自体が正しく動く（逐語引用を検出できる）", () => {
    expect(hasCommonRun(A_RAW, `AIより：${A_RAW}`, N)).toBe(true);
    expect(hasCommonRun(A_RAW, "日程のご相談が来ています", N)).toBe(false);
  });
});
