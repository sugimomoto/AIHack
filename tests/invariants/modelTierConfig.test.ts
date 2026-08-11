import { describe, expect, it } from "vitest";
import { assertTierConfig, isReasoningModel, TIER_CONFIG } from "@/domain/llm/tier";

/**
 * ★M-2｜推論モデルは `reasoning_effort` を必ず明示する
 *
 * 実測（architecture.md §4.1a）：
 *   gpt-5-nano（既定）              出力 1,358 トークン  0.0822円
 *   gpt-5-nano（effort=minimal）    出力    54 トークン  0.0040円
 *   gpt-4.1-nano（非推論）          出力    29 トークン  0.0032円
 *
 * ★設定を忘れると原価が20倍になる。
 *   コメントで注意を促すだけでは不十分であり、設定の検査で落とす。
 *
 * ★このテストは実装より先に書かれた
 */

describe("★M-2｜推論モデルの設定漏れ", () => {
  it("推論モデルを判別できる", () => {
    expect(isReasoningModel("openai/gpt-5-nano")).toBe(true);
    expect(isReasoningModel("openai/gpt-5.1")).toBe(true);
    expect(isReasoningModel("openai/o3-mini")).toBe(true);
    expect(isReasoningModel("openai/gpt-4.1-nano")).toBe(false);
    expect(isReasoningModel("openai/gpt-4o-mini")).toBe(false);
    expect(isReasoningModel("google/gemini-2.5-flash-lite")).toBe(false);
  });

  it("★推論モデルに reasoning_effort が無いと落ちる", () => {
    expect(() => assertTierConfig({ model: "openai/gpt-5-nano" })).toThrow(/reasoning_effort/);
  });

  it("推論モデルでも reasoning_effort があれば通る", () => {
    expect(() => assertTierConfig({ model: "openai/gpt-5-nano", reasoningEffort: "minimal" })).not.toThrow();
  });

  it("非推論モデルは reasoning_effort が無くても通る", () => {
    expect(() => assertTierConfig({ model: "openai/gpt-4.1-nano" })).not.toThrow();
  });

  it("★非推論モデルに reasoning_effort を付けたら落ちる（無効な設定に気づけるように）", () => {
    expect(() => assertTierConfig({ model: "openai/gpt-4.1-nano", reasoningEffort: "minimal" })).toThrow();
  });

  it("★実際の階層設定がすべて M-2 を満たす", () => {
    for (const tier of ["SMALL", "MEDIUM", "LARGE"] as const) {
      expect(() => assertTierConfig(TIER_CONFIG[tier])).not.toThrow();
    }
  });

  it("SMALL は非推論モデルである（M-1）", () => {
    expect(isReasoningModel(TIER_CONFIG.SMALL.model)).toBe(false);
  });
});
