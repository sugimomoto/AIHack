import { describe, expect, it } from "vitest";
import { hasSelfConveyance, stripSelfConveyance } from "@/domain/dialogue/vocabulary";

/**
 * ★このアプリの中心は、アプリが伝えること。
 *   受け止めの応答が本人に伝達を促すと、
 *   「AIが相手と調整してくれない」という体験になる。
 */
describe("★本人に伝達を促さない", () => {
  it.each([
    "お相手に伝えてみましょう。",
    "ご自身でお相手に話してみてください。",
    "その点を相手に伝えるとよいでしょう。",
    "お相手に連絡してみてはいかがでしょうか。ときっと伝わります",
  ])("検出する: %s", (t) => {
    expect(hasSelfConveyance(t)).toBe(true);
  });

  it("該当する文だけを落とし、受け止めは残す", () => {
    const out = stripSelfConveyance(
      "仕事が長引きそうで大変ですね。お相手に伝えてみましょう。無理はなさらないでください。",
    );
    expect(out).toContain("大変ですね");
    expect(out).toContain("無理はなさらないでください");
    expect(out).not.toContain("伝えてみましょう");
  });

  // ★応答全体を捨てない
  it("★全部落ちても、空にしない", () => {
    expect(stripSelfConveyance("お相手に伝えてみましょう。")).not.toBe("");
  });

  it("普通の受け止めは変えない", () => {
    const t = "とてもおつらかったと思います。ここに書いたことは、お相手には届きません。";
    expect(stripSelfConveyance(t)).toBe(t);
    expect(hasSelfConveyance(t)).toBe(false);
  });

  // ★取次ぎ自体の説明は落とさない
  it("★アプリが伝えるという説明は落とさない", () => {
    const t = "必要な内容は、こちらでお相手にお渡しします。";
    expect(stripSelfConveyance(t)).toBe(t);
  });
});
