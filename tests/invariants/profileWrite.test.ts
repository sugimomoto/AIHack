import { describe, expect, it } from "vitest";
import { planProfileWrite } from "@/domain/preparation/profile";
import { asPartyId } from "@/domain/case/types";

/**
 * ★INV-2a｜精密な年収が Party 側に書かれないこと
 *
 * Party はケース配下にあり、相手からも参照されうる。
 * ここに精密な年収を書いた時点で INV-2a が破れる。
 */
describe("前提情報の書き込み計画", () => {
  // 4,380,000円 = 438万円 → 25万円刻みでは 425-450 の帯に入る。
  // ★デザイン納品物および初期のドキュメントには 400-425 と誤記があった（本テストが検出）。
  const P = asPartyId("p1");
  const plan = planProfileWrite({ partyId: P, annualIncomeYen: 4_380_000, address: "架空県1-2-3" });

  it("★Party 側には帯だけが書かれる", () => {
    expect(plan.partyPatch).toEqual({ incomeBand: "425-450" });
  });

  it("★Party 側に精密な年収が現れない", () => {
    expect(JSON.stringify(plan.partyPatch)).not.toContain("4380000");
  });

  it("★Party 側に住所が現れない", () => {
    expect(JSON.stringify(plan.partyPatch)).not.toContain("架空県");
  });

  it("精密な年収は ContactInfo 側に保存される", () => {
    expect(plan.contactInfo.annualIncome).toBe(4_380_000);
  });

  it("年収が未入力なら帯も設定されない", () => {
    expect(planProfileWrite({ partyId: P }).partyPatch).toEqual({});
  });
});
