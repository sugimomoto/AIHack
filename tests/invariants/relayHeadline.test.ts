import { describe, expect, it } from "vitest";
import { buildRelayText } from "@/domain/relay/prompts";

/**
 * ★★ 実測（2026-08-14）：相手に届いたのが、これだけだった。
 *
 *     「ご相談について、ご相談が来ています。」
 *
 *   2つの既定値が重なっていた。
 *     ・見出し … 分類が付かず `TOPIC_LABEL[OTHER] ?? "ご相談"`
 *     ・要約   … 逐語一致で落ち、payload も空で「ご相談が来ています。」
 *
 *   ★埋められなかった穴を、既定値で塗りつぶしていた。
 *   分からないなら、**その部分を書かない。**
 */
describe("★見出しが分からないとき", () => {
  it("「ご相談について、ご相談が来ています。」を作らない", () => {
    expect(buildRelayText({ topicLabel: null, summary: "ご相談が来ています。", context: "" }))
      .toBe("ご相談が来ています。");
  });
  it("見出しが分かれば、これまでどおり", () => {
    expect(buildRelayText({ topicLabel: "養育費", summary: "月額5万円をご希望とのことです。", context: "" }))
      .toBe("養育費について、月額5万円をご希望とのことです。");
  });
});
