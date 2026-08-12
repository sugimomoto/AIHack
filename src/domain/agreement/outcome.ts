/**
 * この相談で、何が決まるのか
 *
 * ★入力欄だけを出して「何でも書いてください」と言うと、
 *   **最終的に何が決まるのかが最後まで分からない。**
 *   決まる項目は payload スキーマに書いてあるのに、画面に出していなかった。
 *
 * ★項目名はスキーマの title から取る。**画面に直書きしない。**
 *   直書きすると、スキーマを版上げしたときに画面だけが古くなる。
 *
 * ★入れ子（特別費用の分担など）はここでは1行にまとめる。
 *   中身まで並べると、決めることが多すぎるように見える。
 */

type JsonSchema = {
  required?: string[];
  properties?: Record<string, { title?: string; type?: string }>;
};

export type Outcome = { key: string; label: string; required: boolean };

export function outcomesOf(schema: JsonSchema | null | undefined): Outcome[] {
  const props = schema?.properties;
  if (!props) return [];
  const required = new Set(schema?.required ?? []);

  return Object.entries(props)
    // ★表示名の無い項目は出さない。キー名をそのまま見せない
    .filter(([, v]) => typeof v?.title === "string" && v.title.trim() !== "")
    .map(([key, v]) => ({ key, label: v.title!.trim(), required: required.has(key) }))
    // ★必ず決めるものを先に。任意のものを同じ重さで並べない
    .sort((a, b) => Number(b.required) - Number(a.required));
}

/** ★決めなくてよいものがあることを、先に言う */
export const OUTCOME_NOTE =
  "すべてを決める必要はありません。決まったものから、書面にできます。";

export const OUTCOME_HEADING = "この相談で決まること";
