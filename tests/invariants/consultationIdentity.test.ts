import { describe, expect, it } from "vitest";
import { consultationIdFor, ownsConsultation } from "@/domain/consultation/identity";

/**
 * ★相談は入口。合意の器は論点である。
 *   相談を増やしても、合意の判定は壊れない（提案は topic で引かれる）。
 */

describe("★相談の識別", () => {
  // ★ここを変えると、過去に書いたものが読めなくなる
  it("★トピックを選ばない相談は、これまでのIDを保つ", () => {
    expect(consultationIdFor("party_a")).toBe("cons_party_a");
    expect(consultationIdFor("party_a", null)).toBe("cons_party_a");
    expect(consultationIdFor("party_a", "")).toBe("cons_party_a");
  });

  it("シナリオごとに別の相談になる", () => {
    expect(consultationIdFor("party_a", "sc_002")).toBe("cons_party_a_sc_002");
    expect(consultationIdFor("party_a", "sc_002")).not.toBe(consultationIdFor("party_a", "sc_006"));
  });

  it("★同じシナリオでも、当事者が違えば別の相談になる", () => {
    expect(consultationIdFor("party_a", "sc_002")).not.toBe(consultationIdFor("party_b", "sc_002"));
  });

  // ★Firestore のドキュメントIDになる。区切り文字やパスを混ぜさせない
  it("★使えない文字が来たら、既定の相談に落とす", () => {
    for (const bad of ["../other", "sc/002", "sc 002", "a".repeat(41), "sc.002"]) {
      expect(consultationIdFor("party_a", bad)).toBe("cons_party_a");
    }
  });
});

describe("★他人の相談を開かせない", () => {
  it("自分のものだけ真", () => {
    expect(ownsConsultation("cons_party_a", "party_a")).toBe(true);
    expect(ownsConsultation("cons_party_a_sc_002", "party_a")).toBe(true);
  });

  it("★他人の相談は偽", () => {
    expect(ownsConsultation("cons_party_b", "party_a")).toBe(false);
    expect(ownsConsultation("cons_party_b_sc_002", "party_a")).toBe(false);
  });

  // ★接頭辞が一致するだけの別人を通さない
  it("★IDの前方一致だけで通さない", () => {
    expect(ownsConsultation("cons_party_abc", "party_a")).toBe(false);
  });
});
