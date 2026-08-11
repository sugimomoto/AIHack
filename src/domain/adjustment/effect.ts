/**
 * 調整の効果種別
 *
 * ★C3（合意が AI の判断基準になる）の実装本体。
 *
 * 当事者は「今回だけ」か「今後も」かを区別して言わない。
 * ただ「日曜にしてほしい」と言うだけである。
 * AI が合意（L1）を参照しているからこそ、この問いを立てられる。
 *
 * この区別を誤ると、一時的な融通のたびに法的文書の基準を書き換えてしまう。
 *
 * @see docs/functional-design.md §4.7
 */

export const ADJUSTMENT_EFFECTS = ["ONE_TIME", "PERMANENT"] as const;
export type AdjustmentEffect = (typeof ADJUSTMENT_EFFECTS)[number];

export const EFFECT_LABEL: Record<AdjustmentEffect, string> = {
  ONE_TIME: "今回だけ変更する",
  PERMANENT: "今後も変更する",
};

export const EFFECT_DESCRIPTION: Record<AdjustmentEffect, string> = {
  ONE_TIME: "取り決めは変わりません。",
  PERMANENT: "取り決めそのものを書き換えます。お相手の同意が必要です。",
};

/** 調整が確定したときに何が起きるか */
export type AdjustmentOutcome = {
  /** 合意（AgreementItem）を改訂するか */
  revisesAgreement: boolean;
  /** 改訂履歴（AgreementRevision）を追記するか */
  appendsRevision: boolean;
  /** 該当する義務（Obligation）に例外を適用するか */
  appliesException: boolean;
  /** 以降の義務を再生成するか */
  regeneratesObligations: boolean;
};

/**
 * 効果種別から、確定時の処理を決める。
 *
 * ★ONE_TIME では合意を変えない。これが最も重要な性質である。
 */
export function outcomeOf(effect: AdjustmentEffect): AdjustmentOutcome {
  switch (effect) {
    case "ONE_TIME":
      return {
        revisesAgreement: false, // ★取り決めは変わらない
        appendsRevision: false,
        appliesException: true, // 該当する回だけ例外を適用
        regeneratesObligations: false,
      };
    case "PERMANENT":
      return {
        revisesAgreement: true,
        appendsRevision: true, // ★上書きせず追記する
        appliesException: false,
        regeneratesObligations: true, // 未到来の義務を作り直す
      };
  }
}

/**
 * 一時的例外には対象日が必須。
 * 対象日のない ONE_TIME は「いつの例外か」が決まらず、義務に適用できない。
 */
export function validateAdjustment(input: {
  effect: AdjustmentEffect;
  targetDate?: string;
}): { ok: true } | { ok: false; reason: string } {
  if (input.effect === "ONE_TIME" && !input.targetDate) {
    return { ok: false, reason: "一時的な変更には対象日が必要です" };
  }
  if (input.effect === "PERMANENT" && input.targetDate) {
    return { ok: false, reason: "恒久的な変更に対象日は指定できません" };
  }
  return { ok: true };
}
