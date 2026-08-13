import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_NOTICE,
  applyAdjustment,
  needsAdjustmentNotice,
} from "@/domain/adjustment/flow";
import { outcomeOf } from "@/domain/adjustment/effect";

/**
 * ★C3｜合意が AI の判断基準になる
 *
 * 当事者は「今回だけ」か「今後も」かを区別して言わない。
 * ただ「日曜にしてほしい」と言うだけである。
 * **AI が合意（L1）を参照しているからこそ、この問いを立てられる。**
 *
 * ★この区別を誤ると、一時的な融通のたびに法的文書の基準を書き換えてしまう。
 *
 * ★このテストは実装より先に書かれた
 */

describe("★お知らせを出す条件", () => {
  it("★合意がある論点への変更希望では、必ず出す", () => {
    expect(needsAdjustmentNotice({ hasAgreement: true, intents: ["REQUEST"] })).toBe(true);
    expect(needsAdjustmentNotice({ hasAgreement: true, intents: ["REVISION_REQUEST"] })).toBe(true);
  });

  it("★合意が無ければ出さない（触れるものが無い）", () => {
    expect(needsAdjustmentNotice({ hasAgreement: false, intents: ["REQUEST"] })).toBe(false);
  });

  it("★感情表現だけでは出さない", () => {
    expect(needsAdjustmentNotice({ hasAgreement: true, intents: ["EMOTIONAL_EXPRESSION"] })).toBe(false);
  });

  it("★お知らせが取り決めを引用している（合意を参照していることが見える）", () => {
    expect(ADJUSTMENT_NOTICE).toContain("{{current}}");
  });

  it("★「今後も変更する」を選ばせない。行き先（取り決めの画面）を示す", () => {
    expect(ADJUSTMENT_NOTICE).not.toContain("今後も変更");
    expect(ADJUSTMENT_NOTICE).toContain("取り決めの画面");
  });

  it("★今回だけの相談として承ることを、はっきり言う", () => {
    expect(ADJUSTMENT_NOTICE).toContain("今回だけ");
  });
});

describe("★ONE_TIME は合意を変えない", () => {
  const base = {
    agreement: { version: 1, payload: { monthlyAmount: 30000, payDay: "DAY_25", until: "AGE_20" } },
    change: { monthlyAmount: 20000 },
  };

  it("合意の内容が変わらない", () => {
    const r = applyAdjustment("ONE_TIME", base);
    expect(r.agreement.payload).toEqual(base.agreement.payload);
  });

  it("★版が上がらない", () => {
    expect(applyAdjustment("ONE_TIME", base).agreement.version).toBe(1);
  });

  it("★改訂履歴が作られない", () => {
    expect(applyAdjustment("ONE_TIME", base).revision).toBeNull();
  });

  it("該当する義務にだけ例外が付く", () => {
    const r = applyAdjustment("ONE_TIME", base);
    expect(r.exception).toEqual({ monthlyAmount: 20000 });
  });

  it("★以降の義務を作り直さない", () => {
    expect(applyAdjustment("ONE_TIME", base).regenerate).toBe(false);
  });

  it("outcomeOf と食い違わない", () => {
    const o = outcomeOf("ONE_TIME");
    const r = applyAdjustment("ONE_TIME", base);
    expect(o.revisesAgreement).toBe(r.agreement.version !== base.agreement.version);
    expect(o.appendsRevision).toBe(r.revision !== null);
    expect(o.regeneratesObligations).toBe(r.regenerate);
  });
});

describe("★PERMANENT は合意を書き換え、履歴を残す", () => {
  const base = {
    agreement: { version: 1, payload: { monthlyAmount: 30000, payDay: "DAY_25", until: "AGE_20" } },
    change: { monthlyAmount: 20000 },
  };

  it("合意の内容が変わる", () => {
    expect(applyAdjustment("PERMANENT", base).agreement.payload.monthlyAmount).toBe(20000);
  });

  it("★変更していない項目は保たれる", () => {
    const p = applyAdjustment("PERMANENT", base).agreement.payload;
    expect(p.payDay).toBe("DAY_25");
    expect(p.until).toBe("AGE_20");
  });

  it("★版が上がる", () => {
    expect(applyAdjustment("PERMANENT", base).agreement.version).toBe(2);
  });

  it("★改訂履歴に、変更前の内容が残る", () => {
    const rev = applyAdjustment("PERMANENT", base).revision!;
    expect(rev.fromVersion).toBe(1);
    expect(rev.previousPayload).toEqual(base.agreement.payload);
  });

  it("★以降の義務を作り直す", () => {
    expect(applyAdjustment("PERMANENT", base).regenerate).toBe(true);
  });

  it("例外は付かない", () => {
    expect(applyAdjustment("PERMANENT", base).exception).toBeNull();
  });

  it("★元の合意を壊さない（履歴が同じ参照にならない）", () => {
    const r = applyAdjustment("PERMANENT", base);
    expect(r.revision!.previousPayload).not.toBe(r.agreement.payload);
    expect(base.agreement.payload.monthlyAmount).toBe(30000);
  });
});
