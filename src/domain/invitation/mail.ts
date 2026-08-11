/**
 * 招待メールの文面
 *
 * ★当事者は自由文を書けない。
 *   引数に本文がないため、この経路で罵倒や脅迫を送ることができない。
 *   **結果として、通常のメールより安全な連絡手段になる。**
 *
 * ★件名・本文から内容が推測されないこと。
 *   相手の職場や家庭で見られる可能性がある（NFR-05 と同じ思想）。
 *
 * @see docs/product-requirements.md FR-14
 * @see design/README-v2.md A-2（文面は納品物の確定文言に一致させている）
 */

/** ★件名に出してはならない語 */
export const SUBJECT_FORBIDDEN_WORDS = [
  "離婚", "養育費", "面会交流", "調停", "親権", "慰謝料", "財産分与",
] as const;

export type InvitationMailInput = {
  url: string;
  /** 送信者の氏名。露出するかは revealSenderName で決まる */
  senderName: string;
  revealSenderName: boolean;
};

export type InvitationMail = { subject: string; body: string };

/**
 * 招待メールを組み立てる。
 *
 * ★引数に本文・メッセージの類を追加してはならない。
 *   追加した時点で「自由文を送れない」という安全性が失われる。
 */
export function buildInvitationMail(input: InvitationMailInput): InvitationMail {
  // ★露出しない場合、送信者名は本文のどこにも現れない
  const from = input.revealSenderName ? `${input.senderName}さま` : "ご関係の方";

  return {
    // ★内容が推測されない件名（design/README-v2.md A-2 確定文言）
    subject: "お手続きのご案内（Aida）",

    body: [
      "Aida は、お子さまに関する取り決めを、おふたりが直接やりとりせずに",
      "進めるためのサービスです。",
      "",
      `このご案内は、${from}からのご依頼でお送りしています。ご参加の場合も、`,
      "直接メッセージをやりとりすることはありません。",
      "",
      "お返事の期限はありません。",
      "▸ 内容を確認する",
      input.url,
    ].join("\n"),
  };
}
