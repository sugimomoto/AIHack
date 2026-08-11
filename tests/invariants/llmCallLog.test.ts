import { describe, expect, it } from "vitest";
import { toCallLog } from "@/domain/llm/callLog";

/**
 * ★G-F｜原文・非開示情報をログに出さない
 *
 * プロンプト本文をログに残すと、非開示情報がそのままログへ流出する。
 * ContextBuilder が防いだものが、ログ経由で漏れては意味がない。
 *
 * ★トークン数は残す。CT-4 に必要であり、原文の復元はできない。
 *
 * ★このテストは実装より先に書かれた
 */

const SECRET = "架空県架空市1-2-3に住んでいます。年収は4380000円です。";

const LOG = toCallLog({
  caseId: "case_1",
  consultationId: "cons_1",
  purpose: "INTENT_CLASSIFICATION",
  tier: "SMALL",
  model: "openai/gpt-4.1-nano",
  prompt: SECRET,
  completion: "これは応答本文です。相手の事情に触れています。",
  inputTokens: 120,
  outputTokens: 30,
  costJpy: 0.0032,
  durationMs: 480,
  createdAt: "2026-08-11T00:00:00Z",
});

describe("★LlmCallLog に原文が残らない", () => {
  const s = JSON.stringify(LOG);

  it("★プロンプト本文が含まれない", () => {
    expect(s).not.toContain(SECRET);
    expect(s).not.toContain("架空県");
    expect(s).not.toContain("4380000");
  });

  it("★応答本文が含まれない", () => {
    expect(s).not.toContain("これは応答本文です");
  });

  it("★prompt / completion というキー自体が存在しない", () => {
    expect(Object.keys(LOG)).not.toContain("prompt");
    expect(Object.keys(LOG)).not.toContain("completion");
  });

  it("計測に必要な値は残る", () => {
    expect(LOG.inputTokens).toBe(120);
    expect(LOG.outputTokens).toBe(30);
    expect(LOG.costJpy).toBeCloseTo(0.0032);
    expect(LOG.tier).toBe("SMALL");
    expect(LOG.model).toBe("openai/gpt-4.1-nano");
  });

  it("返すキーが限定されている", () => {
    expect(Object.keys(LOG).sort()).toEqual(
      [
        "caseId",
        "consultationId",
        "costJpy",
        "createdAt",
        "durationMs",
        "inputTokens",
        "model",
        "outputTokens",
        "purpose",
        "tier",
      ].sort(),
    );
  });
});
