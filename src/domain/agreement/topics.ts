/**
 * 論点マスタ（L1・FORMAL）
 *
 * ★この8項目はコードで固定する。
 *   法律に由来するものであり、実務知見では増減しないため。
 *   一方、payload の形は DB（PayloadSchema）で版管理する。
 *
 * @see docs/functional-design.md §4.9
 */

export const AGREEMENT_TOPICS = [
  "DIVORCE_CONSENT",
  "PARENTAL_AUTHORITY",
  "CHILD_SUPPORT",
  "VISITATION",
  "PROPERTY_DIVISION",
  "CONSOLATION_MONEY",
  "PENSION_SPLIT",
  "MARITAL_EXPENSES",
] as const;

export type AgreementTopic = (typeof AGREEMENT_TOPICS)[number];

/** 表示名（→ docs/glossary.md §5.2） */
export const TOPIC_LABEL: Record<AgreementTopic, string> = {
  DIVORCE_CONSENT: "離婚への同意",
  PARENTAL_AUTHORITY: "親権者",
  CHILD_SUPPORT: "養育費",
  VISITATION: "面会交流",
  PROPERTY_DIVISION: "財産分与",
  CONSOLATION_MONEY: "慰謝料",
  PENSION_SPLIT: "年金分割",
  MARITAL_EXPENSES: "婚姻費用",
};

/**
 * 「誰のための論点か」
 *
 * ★養育費と面会交流を最優先するのは、実装量の都合ではない。
 *   8論点のうち、直接「子どものため」のものがこの2つだけだからである。
 *   （経済面と関係面＝目的の2本の柱／→ docs/product-requirements.md §3.3）
 */
export const TOPIC_BENEFICIARY: Record<AgreementTopic, "CHILD" | "PARENT" | "SPOUSE"> = {
  DIVORCE_CONSENT: "PARENT",
  PARENTAL_AUTHORITY: "CHILD",
  CHILD_SUPPORT: "CHILD",
  VISITATION: "CHILD",
  PROPERTY_DIVISION: "PARENT",
  CONSOLATION_MONEY: "PARENT",
  PENSION_SPLIT: "PARENT",
  MARITAL_EXPENSES: "SPOUSE",
};

/** 今回実装する論点 */
export const IMPLEMENTED_TOPICS: readonly AgreementTopic[] = [
  "CHILD_SUPPORT",
  "VISITATION",
];

export function isAgreementTopic(v: string): v is AgreementTopic {
  return (AGREEMENT_TOPICS as readonly string[]).includes(v);
}
