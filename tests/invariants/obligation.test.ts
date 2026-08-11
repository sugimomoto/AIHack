import { describe, expect, it } from "vitest";
import {
  FULFILLMENT_LABELS,
  dueDateOf,
  fulfillmentStateOf,
  generateObligations,
  labelOf,
} from "@/domain/obligation/schedule";
import { FORBIDDEN_WORDS } from "@/domain/dialogue/vocabulary";

/**
 * ★予定と履行
 *
 * ★アプリは入金を観測できない。
 *   観測できないことを断定しない。
 *   「未払い」と書いた瞬間、事実でないことを相手に伝える可能性が生まれる
 *   （振込の反映遅れがありうる）。
 *
 * ★このテストは実装より先に書かれた
 */

describe("★期日の生成", () => {
  it.each([
    ["DAY_5", 2026, 3, "2026-03-05"],
    ["DAY_10", 2026, 3, "2026-03-10"],
    ["DAY_25", 2026, 3, "2026-03-25"],
    ["LAST_DAY", 2026, 3, "2026-03-31"],
  ])("%s（%i年%i月）→ %s", (code, y, m, expected) => {
    expect(dueDateOf(code, y, m)).toBe(expected);
  });

  it("★31日の無い月では、その月の末日になる", () => {
    expect(dueDateOf("LAST_DAY", 2026, 2)).toBe("2026-02-28");
    expect(dueDateOf("LAST_DAY", 2026, 4)).toBe("2026-04-30");
  });

  it("★うるう年を正しく扱う", () => {
    expect(dueDateOf("LAST_DAY", 2028, 2)).toBe("2028-02-29");
  });

  it("★同じ入力に必ず同じ結果を返す（決定的）", () => {
    expect(dueDateOf("DAY_25", 2026, 9)).toBe(dueDateOf("DAY_25", 2026, 9));
  });

  it("★未知のコードでは期日を作らない", () => {
    expect(dueDateOf("SOMEDAY", 2026, 3)).toBeNull();
  });
});

describe("★合意からの予定生成", () => {
  const item = {
    topic: "CHILD_SUPPORT",
    status: "AGREED",
    payload: { monthlyAmount: 30000, payDay: "DAY_25", until: "AGE_20" },
  };

  it("指定した月数ぶん生成される", () => {
    const o = generateObligations({ items: [item], from: "2026-03-01", months: 3, obligorPartyId: "p1" });
    expect(o).toHaveLength(3);
    expect(o.map((x) => x.dueDate)).toEqual(["2026-03-25", "2026-04-25", "2026-05-25"]);
  });

  it("金額が合意の値をそのまま持つ", () => {
    const o = generateObligations({ items: [item], from: "2026-03-01", months: 1, obligorPartyId: "p1" });
    expect(o[0].amountYen).toBe(30000);
  });

  it("★AGREED でない合意からは生成されない", () => {
    const o = generateObligations({
      items: [{ ...item, status: "PENDING" }],
      from: "2026-03-01",
      months: 3,
      obligorPartyId: "p1",
    });
    expect(o).toHaveLength(0);
  });

  it("★金額や支払日が欠けていたら生成されない（推測しない）", () => {
    const o = generateObligations({
      items: [{ ...item, payload: { monthlyAmount: 30000 } }],
      from: "2026-03-01",
      months: 3,
      obligorPartyId: "p1",
    });
    expect(o).toHaveLength(0);
  });

  it("★養育費以外の論点からは生成されない", () => {
    const o = generateObligations({
      items: [{ ...item, topic: "VISITATION" }],
      from: "2026-03-01",
      months: 3,
      obligorPartyId: "p1",
    });
    expect(o).toHaveLength(0);
  });
});

describe("★履行の状態", () => {
  it("★どちらの申告も無ければ「まだ記録がありません」", () => {
    expect(fulfillmentStateOf({ paidReported: false, receivedReported: false })).toBe("NO_RECORD");
  });

  it("支払った側だけの申告", () => {
    expect(fulfillmentStateOf({ paidReported: true, receivedReported: false })).toBe("PAID_REPORTED");
  });

  it("受け取った側だけの申告", () => {
    expect(fulfillmentStateOf({ paidReported: false, receivedReported: true })).toBe("RECEIVED_REPORTED");
  });

  it("★双方の申告が揃ったときのみ「確認できました」", () => {
    expect(fulfillmentStateOf({ paidReported: true, receivedReported: true })).toBe("CONFIRMED");
  });
});

describe("★状態の文言", () => {
  it("すべての状態に文言がある", () => {
    for (const s of ["NO_RECORD", "PAID_REPORTED", "RECEIVED_REPORTED", "CONFIRMED"] as const) {
      expect(labelOf(s)).toBeTruthy();
    }
  });

  it("★責める語彙が出ない", () => {
    for (const text of Object.values(FULFILLMENT_LABELS)) {
      for (const f of FORBIDDEN_WORDS) expect(text).not.toContain(f.word);
      for (const w of ["滞納", "遅延", "怠", "履行しない"]) expect(text).not.toContain(w);
    }
  });

  it("★記録が無い状態を「支払われていない」と書かない", () => {
    const t = labelOf("NO_RECORD");
    expect(t).toContain("記録");
    expect(t).not.toContain("支払われていません");
  });
});
