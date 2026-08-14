/**
 * 調整の中身を、読める形にする
 *
 * ★取り決めの項目（TOPIC_FIELDS）とは別の器である。
 *   相談から取り出した事実の断片（subject / amountYen / date …）を扱う。
 *
 * ★値はすべて**原文のまま**である（逐語検査を通っている）。
 *   金額だけはコードで解釈した数値（parseYen）。
 */

const LABELS: Record<string, string> = {
  subject: "何について",
  amountYen: "金額",
  shareText: "分担",
  date: "日付",
  time: "時刻",
  place: "場所",
};

/** ★載せる順を決める。オブジェクトの列挙順に任せない */
const ORDER = ["subject", "amountYen", "shareText", "date", "time", "place"];

export function describeAdjustment(
  change: Record<string, unknown>,
): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const k of ORDER) {
    const v = change[k];
    if (v === null || v === undefined || v === "") continue;

    if (k === "amountYen") {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      out.push({ label: LABELS[k], value: `${n.toLocaleString("ja-JP")}円` });
      continue;
    }
    if (typeof v === "object") continue; // ★入れ子は出さない
    out.push({ label: LABELS[k], value: String(v) });
  }
  return out;
}

/**
 * 「今回だけ」と書いてよいか。
 *
 * ★`ONE_TIME` と分かっているときだけ書く。
 *   分からないものを「今回だけ」と書くと、**恒久的な取り決めだと誤解される逆も起きる。**
 */
export function isOneTime(effect: string | null | undefined): boolean {
  return effect === "ONE_TIME";
}
