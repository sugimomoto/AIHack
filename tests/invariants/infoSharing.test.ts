import { describe, expect, it } from "vitest";
import { INTENTS, needsRelay, normalizeIntents } from "@/domain/dialogue/intent";
import { INTENT_SYSTEM_PROMPT, RECEPTION_SYSTEM_PROMPT } from "@/domain/dialogue/prompts";

/**
 * ★「共有したい」は要求でも提案でもない。
 *   分類に無かったため、**共有こそが目的の発言が一度も相手に届いていなかった。**
 *
 *   日常連絡（L3）は合意を求めないが、取次ぎは起きる。
 *   **合意を求めないことと、相手に届かないことは別である。**
 */
describe("★お子さんのことを知らせる", () => {
  it("分類に存在する", () => {
    expect(INTENTS).toContain("INFO_SHARING");
  });

  // ★これが false だと、共有が届かない
  it("★共有は取次ぎを起こす", () => {
    expect(needsRelay(["INFO_SHARING"])).toBe(true);
  });

  it("感情表現だけでは、やはり起こさない", () => {
    expect(needsRelay(["EMOTIONAL_EXPRESSION"])).toBe(false);
  });

  it("★相手に尋ねるだけ（照会）では起こさない", () => {
    expect(needsRelay(["INFO_QUERY"])).toBe(false);
  });

  it("感情と共有が混ざっていれば起こす", () => {
    expect(needsRelay(["EMOTIONAL_EXPRESSION", "INFO_SHARING"])).toBe(true);
  });

  it("正規化を通る", () => {
    expect(normalizeIntents(["INFO_SHARING", "UNKNOWN"])).toEqual(["INFO_SHARING"]);
  });

  // ★分類器が知らなければ、選ばれない
  it("★分類プロンプトに説明がある", () => {
    expect(INTENT_SYSTEM_PROMPT).toContain("INFO_SHARING");
    expect(INTENT_SYSTEM_PROMPT).toContain("共有");
  });
});

describe("★AIに無条件の約束をさせない", () => {
  // ★「お伝えします」と書いたのに渡らないと、画面と食い違う
  it("無条件に約束させない指示がある", () => {
    expect(RECEPTION_SYSTEM_PROMPT).toContain("約束しないで");
  });

  it("本人に伝達を促させない指示もある（両方要る）", () => {
    expect(RECEPTION_SYSTEM_PROMPT).toContain("伝達を促す");
  });
});
