/**
 * モデル階層
 *
 * ★M-1｜高頻度の処理（SMALL）には非推論モデルを使う。
 *   分類・抽出に思考は要らない。
 *
 * ★M-2｜推論モデルを使う場合は reasoning_effort を必ず明示する。
 *   既定値に任せると、思考トークンが出力に計上されて原価が20倍になる。
 *   → architecture.md §4.1a（実測）
 *
 * ★モデルIDは設定値である。環境変数で差し替えられる。
 */

export const MODEL_TIERS = ["SMALL", "MEDIUM", "LARGE"] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export type TierConfig = {
  model: string;
  /** ★推論モデルでは必須。非推論モデルでは指定してはならない */
  reasoningEffort?: ReasoningEffort;
};

/**
 * 推論モデルの判別
 *
 * ★接頭辞で判定する。新しいモデルが増えたときに漏れうるため、
 *   階層を変更したら必ず実測する（M-3）。
 */
const REASONING_PATTERNS = [/(^|\/)gpt-5/, /(^|\/)o\d/, /(^|\/)gpt-6/];

export function isReasoningModel(model: string): boolean {
  return REASONING_PATTERNS.some((re) => re.test(model));
}

export class InvalidTierConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTierConfigError";
  }
}

/**
 * 階層設定を検査する。
 *
 * ★起動時に落とす。実行時まで気づかないと、その間ずっと原価が20倍になる。
 */
export function assertTierConfig(c: TierConfig): void {
  const reasoning = isReasoningModel(c.model);

  if (reasoning && c.reasoningEffort === undefined) {
    throw new InvalidTierConfigError(
      `${c.model} は推論モデルです。reasoning_effort を明示してください（M-2）。` +
        `既定値のままだと思考トークンが出力に計上され、原価が約20倍になります。`,
    );
  }
  if (!reasoning && c.reasoningEffort !== undefined) {
    throw new InvalidTierConfigError(
      `${c.model} は非推論モデルです。reasoning_effort は無効な設定です。` +
        `推論モデルのつもりで設定していないか確認してください。`,
    );
  }
}

/** 環境変数から階層設定を読む。既定値は architecture.md §4.1 の採用モデル */
function fromEnv(key: string, fallback: string, fallbackEffort?: ReasoningEffort): TierConfig {
  const model = process.env[key] || fallback;
  const effort = process.env[`${key}_EFFORT`] || (model === fallback ? fallbackEffort : undefined);
  return {
    model,
    ...(effort ? { reasoningEffort: effort as ReasoningEffort } : {}),
  };
}

export const TIER_CONFIG: Record<ModelTier, TierConfig> = {
  // ★非推論モデル。実測で最安（M-1）
  SMALL: fromEnv("MODEL_TIER_SMALL", "openai/gpt-4.1-nano"),
  // 応答が長いため出力単価を重視
  MEDIUM: fromEnv("MODEL_TIER_MEDIUM", "openai/gpt-4.1-mini"),
  // 低頻度のため単価より品質を優先。
  // ★推論モデルなので reasoning_effort を明示する（M-2）。
  //   調停案の生成では思考が品質に効き、頻度が低いため medium を既定とする。
  LARGE: fromEnv("MODEL_TIER_LARGE", "openai/gpt-5.1", "medium"),
};
