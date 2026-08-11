import type { PartyId, ProposalId } from "@/domain/case/types";

/**
 * 準備モード
 *
 * ★相手が参加していなくても、一人で使える。
 *
 *   参加を待つ間に：
 *     ├ AIと対話して、自分の考えを整理する
 *     ├ 取り決めたい内容を下書きとして構造化しておく
 *     └ 相手が参加した瞬間、それを提案として出せる状態にしておく
 *
 * ★新しいエンティティを作らない。
 *   既存の Proposal を DRAFT 状態で保持する。
 *   参加後にそのまま提案になるため、変換処理が不要である。
 *
 * @see docs/product-requirements.md FR-15
 */

export const PROPOSAL_STATUSES = [
  "DRAFT", // ★相手がいないあいだ
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "SUPERSEDED",
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** 準備モードで作った下書きか */
export function isDraft(s: ProposalStatus): boolean {
  return s === "DRAFT";
}

/**
 * 相手が参加したときに、下書きを提案へ昇格させる。
 *
 * ★DRAFT 以外は触らない。既に往復が始まっているものを巻き戻さない。
 */
export function promoteDrafts<T extends { id: ProposalId; status: ProposalStatus }>(
  proposals: T[],
): { promoted: T[]; unchanged: T[] } {
  const promoted: T[] = [];
  const unchanged: T[] = [];
  for (const p of proposals) {
    if (p.status === "DRAFT") promoted.push({ ...p, status: "PENDING" });
    else unchanged.push(p);
  }
  return { promoted, unchanged };
}

/**
 * 準備モードで許可される操作か。
 *
 * ★取次ぎ（MediationEvent）は生成しない。宛先が存在しないため。
 */
export function allowedInPreparation(
  action: "OWN_MESSAGE" | "AI_RESPONSE" | "DRAFT_PROPOSAL" | "RELAY" | "MEDIATION",
): boolean {
  switch (action) {
    case "OWN_MESSAGE":
    case "AI_RESPONSE":
    case "DRAFT_PROPOSAL":
      return true;
    case "RELAY": // ★宛先がいない
    case "MEDIATION": // ★双方の提案が揃わない
      return false;
  }
}
