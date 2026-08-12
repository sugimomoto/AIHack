import type { Party } from "@/domain/case/types";

/**
 * 同居の状況（I-2）
 *
 * ★監護の実態を問うものと読まれかねない問いなので、**用途を限定して明示する。**
 *   「養育費をどちらが受け取る側になるか、この一点だけのためにうかがっています。」
 *
 * ★これは監護者の指定ではない。監護者は当事者間の協議か家裁が決めるものであって、
 *   アプリが同居の一問で判定してよいものではない。
 */
export const LIVING_ARRANGEMENTS = ["TOGETHER", "APART", "VARIES"] as const;

export type LivingArrangement = (typeof LIVING_ARRANGEMENTS)[number];

export const LIVING_LABEL: Record<LivingArrangement, string> = {
  TOGETHER: "一緒に暮らしている",
  APART: "暮らしていない",
  VARIES: "お子さんによって違う",
};

export const LIVING_PURPOSE_NOTE =
  "養育費をどちらが受け取る側になるか、この一点だけのためにうかがっています。";

export function parseLiving(v: string | null | undefined): LivingArrangement | null {
  if (!v) return null;
  return (LIVING_ARRANGEMENTS as readonly string[]).includes(v)
    ? (v as LivingArrangement)
    : null;
}

/**
 * 受け取る側かどうかを決める。
 *
 * ★「お子さんによって違う」と「あとで答える」では決めない。
 *   決められないものを既定値で埋めると、**間違ったまま算定表を引く。**
 *   このとき null を返し、目安を出す前に対話の中で改めてうかがう。
 */
export function roleFor(l: LivingArrangement | null): Party | null {
  if (l === "TOGETHER") return "CUSTODIAL";
  if (l === "APART") return "NON_CUSTODIAL";
  return null;
}

/** ★役割が確定していない状態では、義務者・権利者を前提にした金額を出さない。 */
export function canDeriveSupportRole(l: LivingArrangement | null): boolean {
  return roleFor(l) !== null;
}
