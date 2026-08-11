import { toIncomeBand } from "@/domain/income/band";
import type { ContactInfo, PartyId } from "@/domain/case/types";

/**
 * 前提情報の登録
 *
 * ★年収は2箇所に分けて保存する。
 *
 *   入力: 4,380,000円
 *     ├→ ContactInfo.annualIncome  （SELF_ONLY・ケース配下に置かない）
 *     └→ Party.incomeBand = "400-425"  （★これだけが越える）
 *
 *   Party に精密な年収を保存した時点で INV-2a が破れる。
 *
 * @see docs/product-requirements.md FR-16 / FR-16a
 */

export type ProfileInput = {
  partyId: PartyId;
  annualIncomeYen?: number;
  address?: string;
  phone?: string;
  employer?: string;
};

export type ProfileWritePlan = {
  /** SELF_ONLY。`/contactInfo/{partyId}` に書く */
  contactInfo: Partial<ContactInfo> & { partyId: PartyId };
  /** ケース配下の Party に書く。★帯のみ */
  partyPatch: { incomeBand?: string };
};

/**
 * 入力を「どこに何を書くか」に分解する。
 *
 * ★この関数の戻り値に、精密な年収が partyPatch 側へ入ってはならない。
 */
export function planProfileWrite(input: ProfileInput): ProfileWritePlan {
  const contactInfo: Partial<ContactInfo> & { partyId: PartyId } = {
    partyId: input.partyId,
  };
  const partyPatch: { incomeBand?: string } = {};

  if (input.annualIncomeYen !== undefined) {
    contactInfo.annualIncome = input.annualIncomeYen;
    partyPatch.incomeBand = toIncomeBand(input.annualIncomeYen); // ★帯だけ
  }
  if (input.address !== undefined) contactInfo.address = input.address;
  if (input.phone !== undefined) contactInfo.phone = input.phone;
  if (input.employer !== undefined) contactInfo.employer = input.employer;

  return { contactInfo, partyPatch };
}
