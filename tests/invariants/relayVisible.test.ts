import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * ★★ 届いたものが、画面の外にあった（2026-08-14 実測）。
 *
 *   `scrollIntoView` は**送信のあとだけ**呼ばれていた。
 *   送った人は自分の分が見えるが、**開いただけの人は上に留まり、
 *   いちばん新しいもの——お相手から届いたもの——が画面の外にあった。**
 *
 *   API も描画も正しかった。**受け取る人ほど、下を見ない。**
 *
 * ★このアプリでは、これは表示上の不便では済まない。
 *   **届くことが、そもそもの主題**だからである。
 */
describe("★届いたものが、画面の中にある", () => {
  const chat = readFileSync("src/components/chat/CaseChat.tsx", "utf8");

  it("開いたときに、いちばん下へ送る", () => {
    // ★送信の finally だけでなく、view が変わったときにも送る
    expect(chat).toContain("seenRef");
    expect(chat).toContain("}, [view]);");
  });

  it("★取次ぎは、自分の発言と同じ流れに並ぶ", () => {
    expect(chat).toContain("v.inbound.map");
    expect(chat).toContain('kind: "INBOUND"');
  });

  it("★見えているあいだは、取り直す", () => {
    expect(chat).toContain("useRefreshOnFocus");
    const hook = readFileSync("src/components/chat/useRefreshOnFocus.ts", "utf8");
    expect(hook).toContain("visibilitychange");
    // ★隠れているタブでは取りに行かない
    expect(hook).toContain('visibilityState === "visible"');
  });
});
