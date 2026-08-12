import type { AgreementTopic } from "@/domain/agreement/topics";

/**
 * 入口の分岐
 *
 * ★「もう離婚して取り決めもある人」と「まだ相手と話していない人」が
 *   同じ画面から始まっていた。**状況の違いを吸収していなかった。**
 *
 * ★軸は2つ。離婚したか、取り決めがあるか。
 *
 *   |          | 取り決めがある        | 取り決めがない          |
 *   | 離婚前   | 条件は決まった        | ★条件を整理する（C2）  |
 *   | 離婚後   | ★取り決めを入力      | いま決める              |
 *
 * ★「まだ相手と話していない」は、上の4つと直交する。
 *   招待を求めず、ひとりで進める（準備モード）。
 */
export const SITUATIONS = [
  "DIVORCED_WITH_TERMS", // 離婚済み・取り決めあり
  "DIVORCED_NO_TERMS", // 離婚済み・取り決めなし ← 国の調査で最も多い層
  "PREDIVORCE_NEGOTIATING", // 離婚前・条件を整理中
  "PREDIVORCE_CONSIDERING", // 離婚前・まだ相手と話していない
] as const;

export type Situation = (typeof SITUATIONS)[number];

export const SITUATION_LABEL: Record<Situation, string> = {
  DIVORCED_WITH_TERMS: "離婚していて、取り決めもしてある",
  DIVORCED_NO_TERMS: "離婚しているが、取り決めはしていない",
  PREDIVORCE_NEGOTIATING: "離婚に向けて、条件を話し合っている",
  PREDIVORCE_CONSIDERING: "離婚を考えているが、まだ相手とは話していない",
};

export const SITUATION_NOTE: Record<Situation, string> = {
  DIVORCED_WITH_TERMS: "決まっている内容を入力すると、予定と履行の記録に使えます。",
  DIVORCED_NO_TERMS: "これから取り決めをつくります。お相手をお招きします。",
  PREDIVORCE_NEGOTIATING: "条件の整理からお手伝いします。お相手をお招きします。",
  PREDIVORCE_CONSIDERING: "おひとりで進められます。お相手には何も届きません。",
};

/** ★取り決めがある人は、対話ではなく入力から始まる */
export function needsTermsInput(s: Situation): boolean {
  return s === "DIVORCED_WITH_TERMS";
}

/**
 * ★まだ相手と話していない人に、招待を求めない。
 *   求めた時点で、この層は離脱する。
 */
export function needsInvitation(s: Situation): boolean {
  return s !== "PREDIVORCE_CONSIDERING";
}

export function nextStepFor(s: Situation): string {
  if (needsTermsInput(s)) return "/onboarding/terms";
  if (needsInvitation(s)) return "/onboarding/invite";
  return "/app";
}

/**
 * 扱う論点。
 *
 * ★婚姻費用は出さない。算定表（表10〜19）を検証していない。
 * ★財産分与・慰謝料も出さない。扱える設計になっていない。
 *   **扱えないものを選択肢に出さない。**
 */
export function topicsFor(_s: Situation): AgreementTopic[] {
  return ["CHILD_SUPPORT", "VISITATION"];
}
