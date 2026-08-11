import type { Intent } from "@/domain/dialogue/intent";
import type { AdjustmentEffect } from "./effect";

/**
 * 調整の流れ
 *
 * ★C3（合意が AI の判断基準になる）の実装本体。
 *
 *   当事者は「今回だけ」か「今後も」かを区別して言わない。
 *   ただ「日曜にしてほしい」と言うだけである。
 *   **AI が合意（L1）を参照しているからこそ、この問いを立てられる。**
 *
 * @see docs/functional-design.md §4.7
 */

/**
 * ★問いに現在の取り決めを差し込む。
 *   合意を参照していることが、当事者から見えるようにする。
 */
export const ADJUSTMENT_QUESTION =
  "取り決めでは{{current}}となっています。今回だけの変更にしますか、それとも今後も変更しますか。";

/**
 * 問いを立てるべきか。
 *
 * ★合意が無ければ問わない。変えるものが無い。
 * ★感情表現だけでは問わない。受け止めて終わる。
 */
const CHANGE_INTENTS: readonly Intent[] = ["REQUEST", "PROPOSAL", "REVISION_REQUEST"];

export function needsEffectQuestion(input: {
  hasAgreement: boolean;
  intents: readonly Intent[];
}): boolean {
  if (!input.hasAgreement) return false;
  return input.intents.some((i) => CHANGE_INTENTS.includes(i));
}

// ---------------------------------------------------------------------------

type Payload = Record<string, unknown>;

export type AdjustmentResult = {
  agreement: { version: number; payload: Payload };
  /** ★PERMANENT のときだけ作られる */
  revision: { fromVersion: number; previousPayload: Payload } | null;
  /** ★ONE_TIME のときだけ付く。該当する義務にのみ適用される */
  exception: Payload | null;
  regenerate: boolean;
};

/**
 * 調整を適用する。
 *
 * ★ONE_TIME は合意に触れない。
 *   触れた瞬間、一時的な融通が法的文書の基準を書き換える。
 *
 * ★元の合意を壊さない。履歴には複製を残す。
 */
export function applyAdjustment(
  effect: AdjustmentEffect,
  input: { agreement: { version: number; payload: Payload }; change: Payload },
): AdjustmentResult {
  if (effect === "ONE_TIME") {
    return {
      agreement: { version: input.agreement.version, payload: { ...input.agreement.payload } },
      revision: null,
      exception: { ...input.change },
      regenerate: false,
    };
  }

  const previousPayload = { ...input.agreement.payload };
  return {
    agreement: {
      version: input.agreement.version + 1,
      // ★変更していない項目は保たれる。差分だけを重ねる
      payload: { ...input.agreement.payload, ...input.change },
    },
    revision: { fromVersion: input.agreement.version, previousPayload },
    exception: null,
    regenerate: true,
  };
}
