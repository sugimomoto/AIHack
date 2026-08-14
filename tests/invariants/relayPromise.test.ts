import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { RELAY_PROMISE, RELAY_PROMISE_SHORT } from "@/domain/ui/emptyState";

/**
 * ★★ 「お相手に届きません」を、単独で書かない（2026-08-14）。
 *
 *   入口の画面にこう書いていた。
 *
 *     ① おひとりで、AIに話す — 書いた言葉は、お相手に届きません。
 *
 *   ★**届かないなら、使う意味がありません。**
 *   このアプリがやっているのは、**整えて届けること**です。
 *   否定だけを置くと、**価値がまるごと消えます。**
 *
 * ★否定を書くなら、必ず**対で**書く。
 *
 * ★ただし、**約束の種類が2つある**ことに注意。
 *     相談の言葉 … 「そのままは届きません。**整えてお伝えします**」
 *     年収・住所 … 「**お相手には知られません**」（そもそも渡らない・INV-2a）
 *   同じ言い方でまとめると、**どちらかが嘘になります。**
 */
const NG = "お相手に届きません";
const NG2 = "お相手には届きません";
/** ★対になる後半。どれかがあれば、否定は単独ではない */
const PAIR = ["整えて", "整えた", "お伝えします", "こう伝わりました"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith(".tsx") || p.endsWith(".ts") ? [p] : [];
  });
}

describe("★「届きません」を単独で書かない", () => {
  it("約束の定型は、対になっている", () => {
    expect(RELAY_PROMISE).toContain("整えて");
    expect(RELAY_PROMISE_SHORT).toContain("整えて");
  });

  it("★画面の文言に、単独の否定が残っていない", () => {
    const bad: string[] = [];
    for (const f of walk("src")) {
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((line, i) => {
        // ★コメントは対象外（経緯として残す。画面には出ない）
        const t = line.trimStart();
        if (t.startsWith("*") || t.startsWith("//") || line.includes("*/") || line.includes("/*")) return;
        if (!line.includes(NG) && !line.includes(NG2)) return;
        // ★「お渡しになるまで、お相手には何も届きません」は招待前の事実。対象外
        if (line.includes("お渡しになるまで")) return;
        if (PAIR.some((w) => line.includes(w))) return;
        bad.push(`${f}:${i + 1}  ${line.trim()}`);
      });
    }
    expect(bad, `単独の否定が残っています:\n${bad.join("\n")}`).toEqual([]);
  });
});
