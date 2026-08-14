import { payloadsAgree } from "./consent";

/**
 * 論点の画面が、いまどの状態か（A-2 の6状態）
 *
 * ★状態を画面で組み立てない。
 *   条件が画面に散ると、**どの状態が抜けているのか誰にも分からなくなる。**
 *   ここで1つに決め、画面は受け取った状態を描くだけにする。
 *
 * @see design/v4/design_handoff_aida_v4/README.md A-2
 */

export type ScreenState =
  /** 未入力。入力フォーム */
  | "EMPTY"
  /** 下書き。★地ごと閉じる。相手に見えていない */
  | "DRAFT"
  /** 渡してある。お相手のご返事待ち */
  | "SHARED"
  /** お相手から案が来ている。了承するか、相談する */
  | "INCOMING"
  /** 合意済 */
  | "AGREED"
  /** 取り下げた。★地は下書きに戻るが、帯の文言が違う */
  | "WITHDRAWN";

export type ScreenInput = {
  agreed: boolean;
  ownPayload: Record<string, unknown> | null;
  otherPayload: Record<string, unknown> | null;
  sharing: "NONE" | "DRAFT" | "SHARED" | "WITHDRAWN";
};

/**
 * ★順番に意味がある。
 *
 *   1. 合意済が最優先。決まったものは、他の何よりも先に見える
 *   2. 取り下げは、下書きと見分けがつかなくならないように先に見る
 *   3. 相手の案は、自分の下書きより優先して知らせる
 *      （相手は返事を待っている。こちらの下書きは誰も待っていない）
 *
 * ★かつて DIVERGED（お相手から別の案）という状態があった。**やめた。**
 *   受け取った側が対案をフォームで返す経路そのものを外し、相談に寄せた。
 */
export function screenStateOf(i: ScreenInput): ScreenState {
  if (i.agreed) return "AGREED";
  if (i.sharing === "WITHDRAWN") return "WITHDRAWN";

  const hasOther = i.otherPayload !== null;
  const hasOwn = i.ownPayload !== null;

  // ★内容が同じなら、了承が済んで確定を待っているだけである。
  //   ここを内容で見ないと、了承した直後に別の状態へ落ちる（実機で検出）。
  if (hasOther && hasOwn && i.sharing === "SHARED") {
    if (payloadsAgree([i.ownPayload, i.otherPayload])) return "SHARED";
  }

  // ★★ お相手の案があれば、それが最優先。**「別の案を出す」経路はやめた。**
  //
  //   受け取った側にできるのは「了承する」か「このことを相談する」の2つ。
  //   対立は、フォーム上の対案の応酬ではなく、**必ず仲介を通す。**
  //   それがこのアプリの主張そのものであり、
  //   ★二つの金額を左右に並べる画面（いちばん危うい画面）に到達しなくなる。
  if (hasOther) return "INCOMING";

  if (i.sharing === "SHARED") return "SHARED";
  if (i.sharing === "DRAFT") return "DRAFT";
  return "EMPTY";
}

/** ★地の色。下書きと取り下げだけ、画面ごと閉じる */
export function isClosed(s: ScreenState): boolean {
  return s === "DRAFT" || s === "WITHDRAWN";
}

/** 一覧（A-1）の1行。★数字を出さない。状態は1行の文 */
export const LIST_LABEL: Record<ScreenState, string> = {
  EMPTY: "まだ入力されていません",
  DRAFT: "下書きです（お相手には見えていません）",
  SHARED: "お相手のご返事をお待ちしています",
  INCOMING: "お相手から案が届いています",
  AGREED: "合意できています",
  WITHDRAWN: "取り下げました（下書きに戻っています）",
};

/** 下書きの帯。★取り下げのときだけ文言が違う */
export const CLOSED_BANNER: Record<"DRAFT" | "WITHDRAWN", string> = {
  DRAFT: "まだお相手には見えていません",
  WITHDRAWN: "下書きに戻りました。お相手には、取り下げられたことが見えています",
};

export const CLOSED_NOTE: Record<"DRAFT" | "WITHDRAWN", string> = {
  DRAFT: "何度でも書き直せます。お渡しになるまで、お相手には何も伝わりません。",
  // ★S-1b で約束したことを、ここでも同じ言葉で書く。
  //   ここで黙ると、あの警告が形式だったことになる。
  WITHDRAWN:
    "書き直して、もう一度お渡しになれます。ご覧になった内容は、お相手の記憶からは消せません。",
};
