import { asCaseId, type PartyId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import { buildDocument, UnresolvedPlaceholderError, type Document } from "@/domain/document/builder";
import {
  listAgreementItems,
  loadForLlm,
} from "@/infra-adapters/firestore/repositories/caseRepository";
import { listClauseTemplates } from "@/infra-adapters/firestore/repositories/masterRepository";

/**
 * 公正証書原案
 *
 * ★LLM を経由しない。この関数からは Router を呼ばない。
 *
 * ★置換に失敗したら文書を返さない。
 *   何が足りないかだけを返し、当事者に埋めてもらう。
 */
export type DocumentResult =
  | { ok: true; document: Document }
  | { ok: false; reason: "INCOMPLETE"; templateId: string; missing: string[] };

export async function buildCaseDocument(input: {
  caseId: string;
  partyId: PartyId;
}): Promise<DocumentResult> {
  const caseId = asCaseId(input.caseId);
  const snap = await loadForLlm(caseId);
  assertOwnParty(snap, input.partyId);

  const [templates, items] = await Promise.all([listClauseTemplates(), listAgreementItems(caseId)]);

  try {
    return { ok: true, document: buildDocument({ templates, items }) };
  } catch (e) {
    if (e instanceof UnresolvedPlaceholderError) {
      // ★空欄のある文書を返さない。何が足りないかだけを返す
      return { ok: false, reason: "INCOMPLETE", templateId: e.templateId, missing: e.missing };
    }
    throw e;
  }
}
