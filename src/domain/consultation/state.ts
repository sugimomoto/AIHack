/**
 * 相談の状態（K-1 の一行）
 *
 * ★対応が決まったもの・返事待ちのものが、まったく分からなかった。
 *   題と日付しか出していなかった。
 *
 * ★ただし**未読の印も件数バッジも持たない。**
 *   「3件未読」は、開かない人を責める形になる。
 *   代わりに**一行の文**で状態を書く。数ではなく、いまどうなっているか。
 *
 * ★急かさない。届いている行にも「お返事は、急ぎません。」を添える。
 */
export const CONSULT_STATES = ["ARRIVED", "HELD", "DRAFT", "SETTLED"] as const;
export type ConsultState = (typeof CONSULT_STATES)[number];

export const CONSULT_STATE_LABEL: Record<ConsultState, string> = {
  ARRIVED: "お相手からのご相談が届いています",
  HELD: "こちらでお預かりしています",
  DRAFT: "書きかけです",
  SETTLED: "合意済",
};

/** ★届いている行にだけ添える。急かす代わりに、急がなくてよいと書く */
export const CONSULT_NO_HURRY = "お返事は、急ぎません。";

/**
 * 状態を決める。
 *
 * ★時刻の比較だけで決める。既読の記録は持たない。
 *   「開いたかどうか」を記録すると、**開いていないことが相手に見える形**に
 *   近づいていく。ここでは持たない。
 */
export function consultStateOf(input: {
  /** 自分が最後に書いた時刻 */
  lastOwnAt?: string | null;
  /** 相手からの取次ぎが最後に届いた時刻 */
  lastInboundAt?: string | null;
  /** その相談の論点が合意済か */
  settled?: boolean;
}): ConsultState {
  if (input.settled) return "SETTLED";

  const own = input.lastOwnAt ?? "";
  const inbound = input.lastInboundAt ?? "";

  // ★自分の発言より新しい取次ぎがあれば、こちらの番
  if (inbound && inbound > own) return "ARRIVED";
  if (own) return "HELD";
  return "DRAFT";
}

/** ★済んだものは沈めるが、消さない */
export function isSettled(s: ConsultState): boolean {
  return s === "SETTLED";
}

/**
 * 閉じたものを沈める。
 *
 * ★ただし**閉じたあとに届いたものは埋もれさせない。**
 *   「済んだことにする」を押した相談に相手が新しく書いたとき、
 *   沈めたままにすると、**閉じたことで見えなくなる。**
 *   それは「消さない。沈めるだけ」という約束を破っている。
 */
export function closedStateOf(input: {
  status: string;
  closedAt: string | null;
  lastInboundAt: string | null;
  computed: ConsultState;
}): ConsultState {
  if (input.status !== "CLOSED") return input.computed;

  const arrivedAfterClosing =
    input.lastInboundAt !== null &&
    input.closedAt !== null &&
    input.lastInboundAt > input.closedAt;

  return arrivedAfterClosing ? "ARRIVED" : "SETTLED";
}
