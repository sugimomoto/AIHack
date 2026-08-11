/**
 * 養育費算定表の参照
 *
 * ★LLMに金額を計算させない（P3）。テーブル参照で決定的に取得する。
 *
 * ★一次資料からの正確なデータ化ができていない（R-18）。
 *   それらしい数字を算定表の値として提示すると、
 *   **このプロダクトが防ごうとしている害を、自分で起こす。**
 *   当事者は「裁判所の基準」として受け取るためである。
 *
 *   → 未検証であることを、出力から外せない形にする。
 *
 * @see docs/functional-design.md §5.4
 */

export type SupportTableRow = {
  /** 義務者の年収帯（→ domain/income/band.ts） */
  payerBand: string;
  /** 権利者の年収帯 */
  payeeBand: string;
  minYen: number;
  maxYen: number;
};

export type SupportTableMaster = {
  id: string;
  /** 出典。表番号（例：表1 子1人・0〜14歳） */
  tableRef: string;
  /** ★一次資料と照合済みか */
  verified: boolean;
  sourceNote: string;
  rows: SupportTableRow[];
};

export type SupportRange = {
  minYen: number;
  maxYen: number;
  tableRef: string;
  /** ★未検証の表を使ったときに必ず入る。呼び出し側では外せない */
  caveat?: string;
};

export const UNVERIFIED_CAVEAT =
  "※この金額は未検証のサンプル値です。裁判所が公表する算定表と照合していません。実際の取り決めには、必ず一次資料をご確認ください。";

/**
 * 算定表を引く。
 *
 * ★表に無い組み合わせでは null を返す。
 *   外挿すると、根拠のない数字になる。
 *   「近い行を使う」も外挿である。
 */
export function lookupChildSupport(
  table: SupportTableMaster,
  input: { payerBand: string; payeeBand: string },
): SupportRange | null {
  const row = table.rows.find(
    (r) => r.payerBand === input.payerBand && r.payeeBand === input.payeeBand,
  );
  if (!row) return null;

  return {
    minYen: row.minYen,
    maxYen: row.maxYen,
    tableRef: table.tableRef,
    // ★注記は参照結果に含める。呼び出し側に任せると、いつか忘れる
    ...(table.verified ? {} : { caveat: UNVERIFIED_CAVEAT }),
  };
}

/**
 * 提示用の文言を作る。
 *
 * ★引数を1つしか取らない。
 *   「注記を出さない」という選択肢を、呼び出し側に与えない。
 */
export function formatRange(range: SupportRange): string {
  const man = (yen: number) => `${Math.round(yen / 10000)}万`;
  const base = `算定表（${range.tableRef}）では、この年収帯は月${man(range.minYen)}〜${man(range.maxYen)}円の範囲とされています。`;
  return range.caveat ? `${base}\n${range.caveat}` : base;
}
