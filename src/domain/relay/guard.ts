/**
 * 取次ぎの実行時検査 ★C1 の最後の砦
 *
 * ★テストで確かめるだけでは足りない。
 *   LLM の出力は毎回変わるため、**本番の1回1回を検査する。**
 *   ここを通ったものだけが相手に届く。
 *
 * @see docs/functional-design.md §5.1a / INV-4
 */

/** INV-4a の閾値。★C-01 として未確定（日本語では短い定型句が偶然一致しうる） */
export const VERBATIM_N = 10;

/**
 * ★INV-4a｜逐語引用の検出
 *
 * 原文と N 文字以上の連続一致があれば、越えさせない。
 * 「原文を通さず、再構成する」（R-1）を機械的に確かめる唯一の方法である。
 */
export function hasVerbatimRun(raw: string, crossing: string, n: number = VERBATIM_N): boolean {
  if (!raw || !crossing) return false;
  for (let i = 0; i + n <= raw.length; i++) {
    if (crossing.includes(raw.slice(i, i + n))) return true;
  }
  return false;
}

/**
 * ★R-3｜抽出カテゴリのホワイトリスト
 *
 * **ブラックリスト方式では必ず漏れる。**
 * ここに無いものは、たとえ無害に見えても越えない。
 */
export const CONTEXT_CATEGORIES = [
  "INCOME_EMPLOYMENT", // 収入・就業状況の変化
  "CHILD_STATUS", // 子の状況（進学・病気・生活）
  "SCHEDULE_CONSTRAINT", // 日程・場所などの制約
  "HEALTH_LIVING", // 健康・生活状況
] as const;

export type ContextCategory = (typeof CONTEXT_CATEGORIES)[number];

export class NotWhitelistedError extends Error {
  constructor(readonly category: string) {
    super(`抽出カテゴリがホワイトリストにありません: ${category}`);
    this.name = "NotWhitelistedError";
  }
}

export function assertWhitelisted(categories: readonly string[]): void {
  for (const c of categories) {
    if (!(CONTEXT_CATEGORIES as readonly string[]).includes(c)) throw new NotWhitelistedError(c);
  }
}

/**
 * ★R-2｜伝聞形式
 *
 * 「失職した」ではなく「失職した**とのことです**」。
 *
 * AIには真偽の検証手段がない。断定すると、
 * **虚偽の申告をAIが保証したことになる。**
 */
const HEARSAY_ENDINGS = [
  "とのことです",
  "とのことでした",
  "そうです",
  "とのご説明です",
  "と伺っています",
  "とお聞きしています",
];

export function isHearsay(context: string): boolean {
  const t = context.trim();
  if (!t) return true; // 事情がなければ検査しない
  // ★文ごとに見る。1文でも断定があれば通さない
  return t
    .split(/[。\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .every((s) => HEARSAY_ENDINGS.some((e) => s.endsWith(e)));
}

// ---------------------------------------------------------------------------

export type RelayVerification = {
  ok: boolean;
  /** ★検査を通らなければ空になる。越えさせないほうを選ぶ */
  context: string;
  categories: ContextCategory[];
  reason?: "VERBATIM" | "CATEGORY" | "ASSERTION";
};

/**
 * 越境前の検査。
 *
 * ★落ちたときに「越えさせない」を選ぶ。
 *   再生成を繰り返さない。待たせるうえ、通る保証がない。
 *   **事情が伝わらないことより、原文が越えることのほうが重い。**
 *
 * ★提案（payload）は越える。落ちるのは事情（context）だけである。
 *   取次ぎ自体が消えると、相手は何も知らないままになる。
 */
export function verifyRelay(input: {
  raw: string;
  topicLabel: string;
  context: string;
  categories: readonly string[];
}): RelayVerification {
  const drop = (reason: RelayVerification["reason"]): RelayVerification => ({
    ok: false,
    context: "",
    categories: [],
    reason,
  });

  if (hasVerbatimRun(input.raw, input.context)) return drop("VERBATIM");

  try {
    assertWhitelisted(input.categories);
  } catch {
    return drop("CATEGORY");
  }

  if (!isHearsay(input.context)) return drop("ASSERTION");

  return {
    ok: true,
    context: input.context,
    categories: input.categories as ContextCategory[],
  };
}
