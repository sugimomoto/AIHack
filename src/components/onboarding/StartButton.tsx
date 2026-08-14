"use client";

import { EmailLinkForm } from "@/components/auth/EmailLinkForm";

/**
 * B-1 のはじめる
 *
 * ★★ ケースは、**本人確認が済んでから**作る。
 *
 *   以前は押した瞬間に匿名でケースが始まった。
 *   セッションの Cookie だけが手がかりで、**失えば二度と辿れなかった。**
 *   実測：70ケース中30ケースが、誰も登録していない状態だった。
 *
 *   ★データが孤児になる形を、構造として無くす。
 *
 * ★状況（5択）は聞かない。全員が取り決めの入力から始まるので、分岐する意味が無い。
 *   **入口で立場を宣言させない。**
 *
 * ★お名前は要らない。**うかがうのは、次に戻れるようにするための1つだけ。**
 */
export function StartButton() {
  return (
    <div className="mt-6">
      <p style={{ fontSize: 13.5, lineHeight: 1.95 }}>
        メールアドレスに、お入りいただくリンクをお送りします。
      </p>
      <p style={{ fontSize: 12, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 6 }}>
        パスワードは設けません。<strong>お相手には知られません。</strong>
      </p>
      <div className="mt-4">
        <EmailLinkForm mode="signup" />
      </div>
    </div>
  );
}
