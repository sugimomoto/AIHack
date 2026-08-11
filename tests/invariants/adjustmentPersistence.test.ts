import { describe, expect, it } from "vitest";
import { applyAdjustment, parseEffect } from "@/domain/adjustment/flow";

/**
 * ★C3 が本番経路で成立すること
 *
 * レビューで検出：`applyAdjustment` はテストからしか呼ばれておらず、
 * **実際の確定経路には effect の概念が無かった。**
 * 「今月だけ2万円に」と言って確定すると、合意そのものが恒久的に
 * 2万円へ書き換わっていた。C3 が防ぐはずの事象そのものである。
 *
 * ★このテストは実装より先に書かれた
 */

describe("★未知の effect は安全側に倒す", () => {
  it("★不明な値は PERMANENT にフォールバックしない", () => {
    expect(parseEffect("permanent")).toBe("PERMANENT");
    expect(parseEffect("one_time")).toBe("ONE_TIME");
    expect(parseEffect("PERMANENT")).toBe("PERMANENT");
    expect(parseEffect("ONE_TIME")).toBe("ONE_TIME");
  });

  it("★未知・欠損は null（勝手に恒久変更にしない）", () => {
    expect(parseEffect("something")).toBeNull();
    expect(parseEffect(undefined)).toBeNull();
    expect(parseEffect("")).toBeNull();
  });
});

describe("★入れ子の payload を共有しない", () => {
  const agreement = {
    version: 1,
    payload: { monthlyAmount: 30000, specialExpenses: { shareRatio: 0.5 } },
  };

  it("★PERMANENT：履歴と現在が同じ入れ子を指さない", () => {
    const r = applyAdjustment("PERMANENT", { agreement, change: { monthlyAmount: 20000 } });
    const cur = r.agreement.payload.specialExpenses as { shareRatio: number };
    const prev = r.revision!.previousPayload.specialExpenses as { shareRatio: number };
    cur.shareRatio = 0.3;
    expect(prev.shareRatio).toBe(0.5);
    expect((agreement.payload.specialExpenses as { shareRatio: number }).shareRatio).toBe(0.5);
  });

  it("★ONE_TIME：例外を触っても合意が変わらない", () => {
    const r = applyAdjustment("ONE_TIME", {
      agreement,
      change: { specialExpenses: { shareRatio: 0.1 } },
    });
    (r.exception!.specialExpenses as { shareRatio: number }).shareRatio = 0.9;
    expect((agreement.payload.specialExpenses as { shareRatio: number }).shareRatio).toBe(0.5);
  });
});
