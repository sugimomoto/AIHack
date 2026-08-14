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
    expect(chat).toContain("[view, toBottom]");
  });

  /**
   * ★高さ 0 の目印に `scrollIntoView` を呼んでも効かなかった（実測：scrollTop が 0 のまま）。
   *   `behavior: "smooth"` も最後まで走らなかった。
   *   ★入れ物の `scrollTop` を直接動かす。判定にも動きにも頼らない。
   */
  it("★入れ物そのものを動かす（目印に頼らない）", () => {
    expect(chat).toContain("el.scrollTop = el.scrollHeight");
    // ★コメントでの言及は残る（経緯として要る）。**呼び出しが無いこと**を見る
    expect(chat).not.toContain(".scrollIntoView(");
  });

  /**
   * ★★ 封書だけが `overflow-hidden` を持つ（角丸で中を切るため）。
   *   flex の子は `overflow` が `visible` でないと自動の最小高さが 0 になり、
   *   縦の余白が足りないと**枠線2本ぶんの 2px まで潰れる**（実測）。
   *   吹き出しは `overflow-hidden` を持たないため潰れず、
   *   **自分の発言だけが残り、お相手から届いたものだけが消えていた。**
   */
  it("★封書が潰れない", () => {
    const relay = readFileSync("src/components/chat/RelayMessage.tsx", "utf8");
    expect(relay).toContain("shrink-0");
    expect(relay).toContain("overflow-hidden");
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
