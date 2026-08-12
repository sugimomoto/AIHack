import type { AgreementTopic } from "@/domain/agreement/topics";

/**
 * 入口の分岐（I-1）
 *
 * ★「もう離婚して取り決めもある人」と「これから話す人」が
 *   同じ画面から始まっていた。**状況の違いを吸収していなかった。**
 *
 * ★2×2の表として聞かない。
 *   「離婚していますか」「取り決めはありますか」と直接聞くと詰問になる。
 *   **平たい5択に崩す。**（第3弾 I-1）
 *
 * ★「まだ相手と話していない」を独立の問いにしない。
 *   聞いた時点で、こちらが相手に伝える前提でいることが伝わる。
 *   「話していない」を選ばせれば、次に来るのは「では伝えましょう」だと予期される。
 *   代わりに **招待をオンボーディングから外した。**（第3弾）
 */
export const SITUATIONS = [
  "PREDIVORCE_NEGOTIATING", // 離婚前・これから条件を話す
  "PREDIVORCE_WITH_TERMS", // 離婚前・条件は決まっている（書面にしたい）
  "DIVORCED_NO_TERMS", // 離婚済み・取り決めなし ← 国の調査で最も多い層
  "DIVORCED_WITH_TERMS", // 離婚済み・取り決めあり（運用したい）
  "UNSURE", // まだ、よく分からない
] as const;

export type Situation = (typeof SITUATIONS)[number];

/**
 * ★選択肢は面積・枠線・文字サイズをすべて同一にする。
 *   「まだ、よく分からない」も同じ形で。**最後だが小さくしない。**
 */
export const SITUATION_LABEL: Record<Situation, string> = {
  PREDIVORCE_NEGOTIATING: "これから離婚の話をする",
  PREDIVORCE_WITH_TERMS: "離婚の前で、条件は決まっている",
  DIVORCED_NO_TERMS: "離婚したが、決めていない",
  DIVORCED_WITH_TERMS: "離婚して、取り決めがある",
  UNSURE: "まだ、よく分からない",
};

export const SITUATION_NOTE: Record<Situation, string> = {
  PREDIVORCE_NEGOTIATING: "条件は、まだほとんど決まっていない",
  PREDIVORCE_WITH_TERMS: "書面にしておきたい",
  DIVORCED_NO_TERMS: "これから決めたい",
  DIVORCED_WITH_TERMS: "その内容で運用していきたい",
  UNSURE: "話しながら整理したい",
};

/**
 * ★どれを選んでも、できることは変わらない。
 *   選択が資格の判定に見えないよう、画面の末尾に必ず置く。
 */
export const SITUATION_FOOTNOTE =
  "どれを選んでも、できることは変わりません。お出しする順番だけが変わります。";

/**
 * 保存済みの値を読む。
 *
 * ★第3弾で選択肢を組み替えた。**既に保存された値を落とさない。**
 *   PREDIVORCE_CONSIDERING（まだ相手と話していない）は問い自体をやめたので、
 *   最も近い UNSURE に寄せる。
 */
const LEGACY: Record<string, Situation> = {
  PREDIVORCE_CONSIDERING: "UNSURE",
};

export function parseSituation(v: string | null | undefined): Situation | null {
  if (!v) return null;
  if ((SITUATIONS as readonly string[]).includes(v)) return v as Situation;
  return LEGACY[v] ?? null;
}

/**
 * ★取り決めがある人は、対話ではなく入力から始まる。
 *
 * ★離婚**前**で条件が決まっている人（PREDIVORCE_WITH_TERMS）には出さない。
 *   まだ確定していないものを「記録」として残すと、決まったことに見える。
 */
export function needsTermsInput(s: Situation): boolean {
  return s === "DIVORCED_WITH_TERMS";
}

/**
 * オンボーディングの着地点。
 *
 * ★招待を挟まない。着地はホーム。
 *   招待はホームのカードから、本人が選んだときだけ開く。
 */
export function nextStepFor(s: Situation): string {
  return needsTermsInput(s) ? "/onboarding/terms" : "/app";
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
