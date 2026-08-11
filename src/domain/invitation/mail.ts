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
 * @see design/README-v2.md A-2
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
  const from = input.revealSenderName ? `${input.senderName}さんから、` : "";

  return {
    // ★内容が推測されない件名
    subject: "お子さんに関する連絡のご案内",

    body: [
      `${from}お子さんに関する連絡のやりとりを、アプリを通じて行うご提案が届いています。`,
      "",
      "このアプリでは、おふたりが直接メッセージをやりとりすることはありません。",
      "書いた言葉がそのまま相手に届くことはなく、決まったことだけが共有されます。",
      "",
      "住所や連絡先が相手に見えることもありません。",
      "",
      "▼ 内容を確認する",
      input.url,
      "",
      "――",
      "ご参加は任意です。**お断りいただいても構いません。**",
      "このご案内は繰り返し送られることはありません。",
      "",
      "リンクの有効期限は7日間です。",
    ].join("\n"),
  };
}
