/**
 * その相談は、取り決めを動かしてよいか
 *
 * ★「進学費用の分担を相談する」が、養育費の枠で決められようとしていた。
 *
 *   sc_003 は linkedTopic が CHILD_SUPPORT なので、
 *   分類も CHILD_SUPPORT になり、**養育費への提案が作られていた。**
 *   提案は論点ごとに「最後のものが最新」で引かれるため、
 *   入学金の話から出た金額が、**合意済みの月額を書き換えうる。**
 *
 *   実データ：合意は月45,000円。
 *   その裏で「入学費100万円を半分」「そちらが60万、こちらが40万」を
 *   同じ論点に流し込んでいた。
 *
 * ★取り決めを動かすのは、その取り決めを決めるための相談だけ（FORMAL）。
 *
 *   個別の相談（ADJUSTMENT）とお知らせ（NOTIFICATION）は、
 *   話し合いも取次ぎもできるが、**取り決めには触れない。**
 *   合意済みのものを変えたいときは、K-6（変更を申し出る）を通る。
 *
 * ★トピックを選ばずに書いた相談は、これまでどおり取り決めに向かえる。
 *   「養育費は月5万円にしたい」と自由に書いた人を止めない。
 */
export function canNegotiateAgreement(kind: string | null | undefined): boolean {
  // ★分からないもの（トピック未選択）は許す。選んだうえで個別相談なら止める
  if (!kind) return true;
  return kind === "FORMAL";
}

/**
 * ★★ `NOT_NEGOTIABLE_NOTE` を消した（2026-08-14）。
 *
 *   相談画面のいちばん上に、書く前から出していた。
 *   `FORMAL` が 0 になった結果、**トピックを選んだ相談すべてに出る**ようになり、
 *   区別をしない注意書きになっていた。
 *
 *   ★同じことは、控えの枠（`ADJUSTMENT_NOTE`）が言う。
 *   そちらは**控えが実際にできたときだけ**出るので、
 *   「これは取り決めになるのか」という問いが立つ場面と一致する。
 *
 *   ★使われなくなった定数を残さない。**残すと、次に誰かが貼り直す。**
 */

export class NotNegotiableError extends Error {
  constructor(readonly kind: string) {
    super(`この種別の相談から取り決めを動かせません: ${kind}`);
    this.name = "NotNegotiableError";
  }
}

/**
 * ★黙って作らないのではなく、作ろうとしたら落とす。
 *
 *   分岐を1か所に足しただけでは、次に経路が増えたときに同じことが起きる。
 *   **書き込みの直前で落とす**ことで、経路が増えても守られる。
 */
export function assertNegotiable(kind: string | null | undefined): void {
  if (!canNegotiateAgreement(kind)) throw new NotNegotiableError(String(kind));
}

/**
 * その相談は、「決まったこと」に控えを残すか
 *
 * ★★ お知らせ（NOTIFICATION）には、控えを残さない。
 *
 *   合意を求めない連絡である。運動会の写真も、学校からのお知らせも、
 *   **決まったことではない。**控えに並べる意味が無い。
 *
 *   一度この区別を落としたことがある（対話から取り決めを作る経路を断つとき、
 *   3分岐をまとめて1つにしてしまった）。
 *   実測で、写真の共有が `{"subject":"入学金"}` という控えを残した。
 *
 * ★トピックを選ばずに書いた相談（kind が無い）は、控えを残す側に倒す。
 *   何の相談か分からない以上、**残しておくほうが失われない。**
 */
export function isAdjustment(kind: string | null | undefined): boolean {
  if (!kind) return true;
  return kind === "ADJUSTMENT";
}
