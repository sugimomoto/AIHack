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
 * ★★ 問いをやめ、お知らせにした。
 *
 *   「今後も変更する」は、**対話から取り決めを書き換える前提**の選択肢だった。
 *   取り決めを対話から動かさないと決めたので、この選択肢は行き先を失う。
 *   選べるように見せたまま何も起きないほうが、選べないことより悪い。
 *
 *   合意を参照して現在の取り決めを差し込むことは**続ける。**
 *   これが C3 の本体であり、「今後も」の行き先（取り決めの画面）も示す。
 */
export const ADJUSTMENT_NOTICE =
  "取り決めでは{{current}}となっています。今回だけのご相談として承ります。" +
  "取り決めそのものを変えるときは、取り決めの画面からお申し出ください。";

/** ★旧：対話から取り決めを変えていたころの問い。経路が消えたので使わない */
export const ADJUSTMENT_QUESTION =
  "取り決めでは{{current}}となっています。今回だけの変更にしますか、それとも今後も変更しますか。";

/**
 * お知らせを出すべきか。
 *
 * ★合意が無ければ出さない。触れるものが無い。
 * ★感情表現だけでは出さない。受け止めて終わる。
 */
const CHANGE_INTENTS: readonly Intent[] = ["REQUEST", "PROPOSAL", "REVISION_REQUEST"];

export function needsAdjustmentNotice(input: {
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
/**
 * ★未知の値を PERMANENT に倒さない。
 *   「今回だけ」を選んだのに合意が書き換わる、という最悪の取り違えを
 *   構造的に防ぐ。判定できなければ何もしない（レビューで検出）。
 */
export function parseEffect(v: string | null | undefined): AdjustmentEffect | null {
  const s = String(v ?? "").toUpperCase();
  return s === "ONE_TIME" || s === "PERMANENT" ? s : null;
}

/** ★入れ子ごと複製する。浅いコピーだと履歴と現在が同じ参照を指す */
function clone<T>(v: T): T {
  return structuredClone(v);
}

export function applyAdjustment(
  effect: AdjustmentEffect,
  input: { agreement: { version: number; payload: Payload }; change: Payload },
): AdjustmentResult {
  if (effect === "ONE_TIME") {
    return {
      agreement: { version: input.agreement.version, payload: clone(input.agreement.payload) },
      revision: null,
      exception: clone(input.change),
      regenerate: false,
    };
  }

  return {
    agreement: {
      version: input.agreement.version + 1,
      // ★変更していない項目は保たれる。差分だけを重ねる
      payload: { ...clone(input.agreement.payload), ...clone(input.change) },
    },
    revision: { fromVersion: input.agreement.version, previousPayload: clone(input.agreement.payload) },
    exception: null,
    regenerate: true,
  };
}
