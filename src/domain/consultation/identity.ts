import type { PartyId } from "@/domain/case/types";

/**
 * 相談の単位（K-1）
 *
 * ★相談は入口。**合意の器は論点である。**
 *
 *   「養育費を決める」と「塾の費用を相談する」は別の相談だが、
 *   どちらも CHILD_SUPPORT に提案を出す。
 *   提案は topic で引かれるため、**どの相談から出ても1本に集約される。**
 *   相談を増やしても、合意の判定（双方の承諾＋内容の一致）は壊れない。
 *
 * ★既定の相談だけは、これまでの ID を保つ。
 *   `cons_${partyId}` に既に書かれた発言があり、
 *   ここを変えると**過去に書いたものが読めなくなる。**
 */
export const DEFAULT_CONSULTATION_SUFFIX = null;

export function consultationIdFor(partyId: PartyId | string, scenarioId?: string | null): string {
  const s = (scenarioId ?? "").trim();
  if (!s) return `cons_${partyId}`;
  // ★ID に使えない文字を混ぜない（Firestore のドキュメントIDになる）
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(s)) return `cons_${partyId}`;
  return `cons_${partyId}_${s}`;
}

/** その相談が、その人のものか。★他人の相談IDを渡されても開かせない */
export function ownsConsultation(consultationId: string, partyId: PartyId | string): boolean {
  return (
    consultationId === `cons_${partyId}` || consultationId.startsWith(`cons_${partyId}_`)
  );
}

/** 既定の相談（トピックを選ばずに書き始めた人のもの） */
export const DEFAULT_TITLE = "はじめのご相談";
