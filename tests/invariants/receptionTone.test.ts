import { describe, expect, it } from "vitest";
import { RECEPTION_SYSTEM_PROMPT } from "@/domain/dialogue/prompts";

/**
 * ★★ 受け止めの応答が、事実を濁していた（2026-08-14 実測）。
 *
 *   「お伝えいただいた内容は、必要に応じて整えたうえで
 *     お相手にお渡しする場合があります。」
 *
 *   ★そのすぐ下に、実際に渡ったものが出ている。
 *   **決まっていることを、決まっていないように書いていた。**
 *
 *   原因はモデルではなく、**指示にその言い方が書いてあった**ことである。
 */
describe("★受け止めの応答が、事実を濁さない", () => {
  it("★「お渡しする場合」を、こちらから書かせない", () => {
    expect(RECEPTION_SYSTEM_PROMPT).not.toContain("お渡しする場合は");
    expect(RECEPTION_SYSTEM_PROMPT).toContain("お渡しするかどうかに、触れないでください");
  });

  /**
   * ★中身の無い締めくくり。
   *   実測：「今の状況を踏まえた上で、どのように整理できるかを考えましょう。」
   *   何も言っておらず、**次に何も起こらない。**
   */
  it("★中身の無い誘いを禁じている", () => {
    for (const ng of ["一緒に考えましょう", "整理していきましょう", "考えましょう"]) {
      expect(RECEPTION_SYSTEM_PROMPT).toContain(ng);
    }
    expect(RECEPTION_SYSTEM_PROMPT).toContain("促す役ではありません");
  });

  // ★もとからの約束。伝達はアプリが担う（ご本人にやらせない）
  it("ご本人に伝達させない", () => {
    expect(RECEPTION_SYSTEM_PROMPT).toContain("ご本人に伝達を促す言い方をしないでください");
  });
});
