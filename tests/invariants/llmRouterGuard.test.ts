import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ★Router 以外から LLM を呼べないこと
 *
 * S2 で ContextBuilder を作り、相手の原文へ到達する経路を型レベりで消した。
 * しかし LLM SDK を直接叩けば、その努力は迂回できる。
 *
 *   ❌ 各機能が openai クライアントを直接持つ
 *        → ContextBuilder を通さない経路ができる
 *        → コストも記録されず、CT-1〜CT-4 が計測できない
 *
 *   ✅ LlmRouter を唯一の入口にする
 *        → C1 の防御とコスト計測が同じ1点に集まる
 *
 * ★S2 のシグネチャ検証テストと同じ位置づけである。
 *   「気をつける」ではなく「書けない」状態にする。
 *
 * ★このテストは実装より先に書かれた（→ docs/development-guidelines.md §5.0）
 */

const SRC = join(process.cwd(), "src");

/** Router の実装そのもの。ここだけは SDK を触ってよい */
const ALLOWED = ["src/infra-adapters/llm/"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") || p.endsWith(".tsx") ? [p] : [];
  });
}

/** コメントと文字列リテラルを除く（規約の説明文を誤検出しないため） */
function stripCommentsAndStrings(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

const FILES = walk(SRC).map((p) => ({
  rel: p.slice(process.cwd().length + 1),
  code: stripCommentsAndStrings(readFileSync(p, "utf8")),
}));

const outsideRouter = FILES.filter((f) => !ALLOWED.some((a) => f.rel.startsWith(a)));

describe("★LlmRouter が唯一の入口である", () => {
  it("Router の外で openai SDK を import していない", () => {
    const bad = outsideRouter.filter((f) => /from\s+["']openai["']/.test(f.code));
    expect(bad.map((f) => f.rel)).toEqual([]);
  });

  it("★Router の外で OrcaRouter のエンドポイントを直接指していない", () => {
    const bad = outsideRouter.filter((f) => /api\.orcarouter\.ai/.test(f.code));
    expect(bad.map((f) => f.rel)).toEqual([]);
  });

  it("★Router の外で APIキーを読んでいない", () => {
    const bad = outsideRouter.filter((f) => /ORCAROUTER_API_KEY/.test(f.code));
    expect(bad.map((f) => f.rel)).toEqual([]);
  });

  it("Router の外で chat/completions を叩いていない", () => {
    const bad = outsideRouter.filter((f) => /chat\/completions/.test(f.code));
    expect(bad.map((f) => f.rel)).toEqual([]);
  });

  it("検査対象のファイルが実在する（テストが空振りしていない）", () => {
    expect(outsideRouter.length).toBeGreaterThan(10);
  });
});
