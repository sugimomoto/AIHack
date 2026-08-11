import { describe, expect, it } from "vitest";
import { newCaseSeed } from "@/domain/case/start";

/**
 * ★ケースの開始
 *
 * 最初の当事者は、招待を受け取らない。
 * したがって**自分でケースを作る経路**が要る。
 *
 * ★ここで作られるのは「自分」と「まだ来ていない相手」の2人である。
 *   相手の枠を先に作らないと、招待の宛先が決まらない。
 *   ただし**相手はまだ何も持たない。**
 *
 * ★このテストは実装より先に書かれた
 */

const seed = newCaseSeed({ caseId: "c1", ownPartyId: "p_self", otherPartyId: "p_other", role: "CUSTODIAL" });

describe("★ケースの初期状態", () => {
  it("当事者が2人ぶん作られる", () => {
    expect(seed.parties).toHaveLength(2);
  });

  it("★自分だけが ACTIVE。相手はまだ参加していない", () => {
    const self = seed.parties.find((p) => p.id === "p_self")!;
    const other = seed.parties.find((p) => p.id === "p_other")!;
    expect(self.state).toBe("ACTIVE");
    expect(other.state).toBe("PREPARING");
  });

  it("役割が対になる", () => {
    expect(seed.parties.map((p) => p.role).sort()).toEqual(["CUSTODIAL", "NON_CUSTODIAL"]);
  });

  it("★相手の当事者に、実名も連絡先も入らない", () => {
    const other = seed.parties.find((p) => p.id === "p_other")!;
    expect(JSON.stringify(other)).not.toContain("@");
    expect(other.incomeBand).toBeNull();
  });

  it("★表示名に実名を入れない（U-1）", () => {
    for (const p of seed.parties) expect(p.displayNameForOther).toBe("お相手");
  });

  it("ケースは SOLO から始まる", () => {
    expect(seed.case.status).toBe("SOLO");
  });

  it("★同じ入力から同じ結果になる（決定的）", () => {
    expect(newCaseSeed({ caseId: "c1", ownPartyId: "p_self", otherPartyId: "p_other", role: "CUSTODIAL" })).toEqual(seed);
  });

  it("非監護親として始めた場合、役割が入れ替わる", () => {
    const s = newCaseSeed({ caseId: "c1", ownPartyId: "a", otherPartyId: "b", role: "NON_CUSTODIAL" });
    expect(s.parties.find((p) => p.id === "a")!.role).toBe("NON_CUSTODIAL");
    expect(s.parties.find((p) => p.id === "b")!.role).toBe("CUSTODIAL");
  });
});
