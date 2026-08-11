/**
 * 養育費算定表の参照
 *
 * ★LLMに金額を計算させない（P3）。表参照で決定的に取得する。
 *
 * ★データは裁判所公表「令和元年改定標準算定表」を、帯グラフのPDFから
 *   機械的に抽出したものである（scripts/extract-support-tables.py）。
 *   抽出の検証：
 *     1. 両端からの独立計数が全セルで一致すること
 *     2. 義務者年収↑で帯が下がらず、権利者年収↑で帯が上がらないこと
 *     3. 図中の最上段ラベル（目視）と帯数が一致すること
 *   通らなかった表は**含めていない**。参照は null を返す。
 *
 * @see docs/functional-design.md §5.4
 */

export type SupportTableMaster = {
  id: string;
  targetKey: string;
  /** 子の構成キー（→ childrenKeyOf） */
  childrenKey: string;
  /** 出典。表番号 */
  tableRef: string;
  version: number;
  status: string;
  /** ★一次資料と照合済みか */
  verified: boolean;
  sourceNote: string;
  payerStepMan: number;
  payeeStepMan: number;
  payerMaxMan: number;
  payeeMaxMan: number;
  /** 帯の凡例（"4-6" = 4〜6万円） */
  bandLegend: string[];
  /** 1行＝義務者の1段。2文字ずつが権利者の1列の帯index */
  grid: string[];
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
 * 子の構成から表を選ぶキーを作る。
 *
 * ★算定表は「子の人数」と「15歳以上かどうか」で分かれる。
 *   15歳以上を先に並べるのが表の並びである。
 *
 * ★4人以上の表は公表されていない。null を返す。
 */
export function childrenKeyOf(ages: readonly number[]): string | null {
  if (ages.length === 0 || ages.length > 3) return null;
  const flags = ages.map((a) => (a >= 15 ? 1 : 0)).sort((a, b) => b - a);
  return `${ages.length}:${flags.join("")}`;
}

/**
 * 算定表を引く。
 *
 * ★表の範囲外では null を返す。
 *   外挿すると根拠のない数字になる。「近い行を使う」も外挿である。
 *
 * ★刻みの途中は下の段を使う（表の読み方に合わせる）。
 */
export function lookupChildSupport(
  table: SupportTableMaster,
  input: { payerMan: number; payeeMan: number },
): SupportRange | null {
  const { payerMan, payeeMan } = input;
  if (payerMan < 0 || payeeMan < 0) return null;
  if (payerMan > table.payerMaxMan || payeeMan > table.payeeMaxMan) return null;

  const j = Math.floor(payerMan / table.payerStepMan);
  const i = Math.floor(payeeMan / table.payeeStepMan);
  const row = table.grid[j];
  if (!row) return null;

  const cell = row.slice(i * 2, i * 2 + 2);
  if (cell.length !== 2) return null;
  const legend = table.bandLegend[Number(cell)];
  if (!legend) return null;

  const [lo, hi] = legend.split("-").map(Number);
  return {
    minYen: lo * 10000,
    maxYen: hi * 10000,
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
