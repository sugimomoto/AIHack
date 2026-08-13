/**
 * 仮案の共有
 *
 * ★取り決めは「双方が独立に記録して、一致したら合意」ではない。
 *
 *   二人が別々に「月5万円・毎月25日・22歳まで」と打って完全一致することは、
 *   まず起きない。**「内容が異なる」が例外ではなく標準になってしまう。**
 *
 *   実際、consent.ts の冒頭に記録した欠陥はこの前提から出ている：
 *     Aの提案 3万円 ／ Bの提案 4万円 で双方が承諾
 *     → 誰も合意していない 3万円が確定した
 *
 *   ★片方が仮案を作り、もう片方が**同じ仮案に**了承する。
 *     こうすると payloadsAgree は自明に真になり、
 *     NEEDS_CONVERGENCE は**発生条件そのものを失う。**
 *     歯止めを増やすのではなく、条件が消える。
 *
 * ★そして「見ていない状態」には戻せない。
 *
 *   OFF に戻せるスイッチは、取り消せるように見える。
 *   これは「届きません」→「直接届きません」と同じ問題で、
 *   **操作の見た目が、実際にできることより多くを約束してしまう。**
 *
 *   → OFF は「取り下げ」とし、取り下げたことは相手に見える。
 *
 * @see .steering/20260812-feedback-pivot/design-sharing.md
 */

export type SharableProposal = {
  byPartyId: string;
  /** ★渡した時刻。null なら下書き（相手に見えていない） */
  sharedAt: string | null;
  /** ★取り下げた時刻。取り下げても「見なかったこと」にはならない */
  withdrawnAt: string | null;
};

/**
 * ★この提案は、この人に見えてよいか。
 *
 *   自分のものは、下書きでも見える（書いている本人だから）。
 *   相手のものは、**渡されていなければ見えない。**
 *
 * ★この判定はサーバ側で使うこと。
 *   画面で隠す実装にすると、API を直接見れば読める。
 *   C1（原文が渡らない）と同じ強さで守る。
 */
export function isVisibleTo(p: SharableProposal, viewerPartyId: string): boolean {
  if (p.byPartyId === viewerPartyId) return true;
  return p.sharedAt !== null && p.withdrawnAt === null;
}

export type SharingState =
  /** まだ何も入力されていない */
  | "NONE"
  /** 下書き。★相手には見えていない */
  | "DRAFT"
  /** 渡してある。お相手のご返事待ち */
  | "SHARED"
  /** 取り下げた。★取り下げたことは相手にも見えている */
  | "WITHDRAWN";

/** 自分の最新の仮案が、いまどの状態か */
export function sharingStateOf(p: SharableProposal | null | undefined): SharingState {
  if (!p) return "NONE";
  if (p.withdrawnAt !== null) return "WITHDRAWN";
  return p.sharedAt === null ? "DRAFT" : "SHARED";
}

/**
 * 状態の説明（自分の画面）
 *
 * ★「まだお相手には見えていません」と言い切る。
 *   下書きが見えていると思われると**書けなくなる。**
 *   下書きは、考えるための場所である。
 */
export const SHARING_LABEL: Record<SharingState, string> = {
  NONE: "まだ入力されていません",
  DRAFT: "下書きです。まだお相手には見えていません",
  SHARED: "お相手のご返事をお待ちしています",
  WITHDRAWN: "取り下げました",
};

/**
 * ★渡す前に読める一文。
 *
 *   取り消せるように見せない。**できることだけを書く。**
 */
export const SHARE_CAVEAT =
  "お渡ししたあとで取り下げることもできますが、一度ご覧になったことは取り消せません。";

/** 相手の画面に出る、取り下げの説明 */
export const WITHDRAWN_BY_OTHER = "お相手が、この案を取り下げられました。";

/**
 * ★渡したときに相手へ届くお知らせ。
 *
 *   状態が変わるだけで誰にも届かないなら、**変わっていないのと同じ**である。
 *   ★原文は含まない。論点の名前だけ（C1）。
 */
export function shareNotice(topicLabel: string): string {
  return `お相手が、${topicLabel}の案を作られました。ご覧のうえ、ご返事ください。`;
}

/** 取り下げたときに相手へ届くお知らせ */
export function withdrawNotice(topicLabel: string): string {
  return `お相手が、${topicLabel}の案を取り下げられました。`;
}

/**
 * 渡してよいか。
 *
 * ★中身が無いものを渡さない。相手に「空の案」が届く。
 * ★すでに渡してあるものを、もう一度渡さない。
 */
export function canShare(p: SharableProposal & { payload: unknown }): boolean {
  if (p.payload === null || p.payload === undefined) return false;
  if (p.withdrawnAt !== null) return false;
  return p.sharedAt === null;
}

/** 取り下げてよいか。★渡していないものは取り下げられない（下書きは直せばよい） */
export function canWithdraw(p: SharableProposal): boolean {
  return p.sharedAt !== null && p.withdrawnAt === null;
}
