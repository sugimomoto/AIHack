/**
 * 年収の帯変換
 *
 * ★INV-2a｜精密な年収は越えない。越えるのは算定表の帯のみ。
 *
 * 算定表はもともと年収の帯で区切られており（「給与所得者・年収400〜425万円」等）、
 * **精密な額は算定に不要である。**
 *
 *   入力: 4,380,000円          ← ContactInfo に保存。越えない
 *      ↓
 *   帯:  "400-425"             ← Party に保存。これだけが越える
 *
 * 帯であれば勤務先や生活水準の推測が困難になる。
 * 必要な粒度だけを越えさせるという C1 の思想を、年収にも適用する。
 *
 * @see docs/product-requirements.md FR-16a
 */

/**
 * ⚠️ 区分の刻みは**要確認**（→ requirements.md C-01）。
 *
 * 現状は「1000万円までは25万円刻み、1500万円までは50万円刻み、
 * それ以上は100万円刻み」という一般的な理解に基づく暫定値である。
 * **裁判所が公表する算定表の一次資料で検証すること。**S6 で確定する。
 *
 * なお本モジュールの目的は「精密な額を越えさせないこと」であり、
 * 区分が多少ずれても INV-2a は成立する。
 */
export const INCOME_BAND_NOTE =
  "区分の刻みは暫定。算定表の一次資料での検証が要確認（S6で確定）";

/** 帯の境界（万円） */
function boundaries(): number[] {
  const b: number[] = [];
  for (let v = 0; v < 1000; v += 25) b.push(v);
  for (let v = 1000; v < 1500; v += 50) b.push(v);
  for (let v = 1500; v <= 3000; v += 100) b.push(v);
  return b;
}

const BOUNDS = boundaries();

/**
 * 年収（円）を帯に変換する。
 *
 * ★戻り値に精密な額を含めてはならない。
 */
export function toIncomeBand(annualIncomeYen: number): string {
  if (!Number.isInteger(annualIncomeYen)) {
    throw new Error("年収は整数で指定してください");
  }
  if (annualIncomeYen < 0) {
    throw new Error("年収に負の値は指定できません");
  }

  const manYen = Math.floor(annualIncomeYen / 10_000);

  for (let i = 0; i < BOUNDS.length - 1; i++) {
    if (manYen >= BOUNDS[i] && manYen < BOUNDS[i + 1]) {
      return `${BOUNDS[i]}-${BOUNDS[i + 1]}`;
    }
  }
  // 上限超過
  return `${BOUNDS[BOUNDS.length - 1]}-`;
}

/** 帯を範囲に戻す（表示・算定表参照用） */
export function parseBand(
  band: string,
): { minManYen: number; maxManYen: number } | null {
  const m = band.match(/^(\d+)-(\d*)$/);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] === "" ? Number.POSITIVE_INFINITY : Number(m[2]);
  return { minManYen: min, maxManYen: max };
}

/** 表示用（「400〜425万円」） */
export function formatBand(band: string): string {
  const b = parseBand(band);
  if (!b) return band;
  if (!Number.isFinite(b.maxManYen)) return `${b.minManYen}万円以上`;
  return `${b.minManYen}〜${b.maxManYen}万円`;
}
