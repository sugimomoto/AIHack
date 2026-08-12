import { describe, expect, it } from "vitest";
import {
  DEFAULT_THREAD_ID,
  consultationIdOf,
  isContinuing,
  ownsConsultationId,
  parseThreadId,
  threadIdFor,
  threadIdOfConsultation,
} from "@/domain/consultation/thread";

/**
 * ★同じトピックを選び直したら、前の会話は出てこない。
 *
 *   「送迎をお願いしたい」を先週やって、今週また同じことを頼む。
 *   これは**別の件**であって、続きではない。
 */

describe("★続きにするか、都度別にするか", () => {
  it("取り決めを決める相談だけが続く", () => {
    expect(isContinuing("FORMAL")).toBe(true);
    expect(isContinuing("ADJUSTMENT")).toBe(false);
    expect(isContinuing("NOTIFICATION")).toBe(false);
    expect(isContinuing(null)).toBe(false);
  });

  it("★養育費を決める相談は、何度開いても同じスレッド", () => {
    const a = threadIdFor({ scenarioId: "sc_001", kind: "FORMAL", token: "aaaa" });
    const b = threadIdFor({ scenarioId: "sc_001", kind: "FORMAL", token: "bbbb" });
    expect(a).toBe(b);
  });

  // ★ここが今回の要点
  it("★送迎の依頼は、開くたびに別のスレッド", () => {
    const a = threadIdFor({ scenarioId: "sc_014", kind: "ADJUSTMENT", token: "aaaa" });
    const b = threadIdFor({ scenarioId: "sc_014", kind: "ADJUSTMENT", token: "bbbb" });
    expect(a).not.toBe(b);
  });

  it("お知らせも都度別", () => {
    const a = threadIdFor({ scenarioId: "sc_016", kind: "NOTIFICATION", token: "aaaa" });
    const b = threadIdFor({ scenarioId: "sc_016", kind: "NOTIFICATION", token: "bbbb" });
    expect(a).not.toBe(b);
  });

  it("トピックを選ばなければ既定のスレッド", () => {
    expect(threadIdFor({ scenarioId: null, kind: null })).toBe(DEFAULT_THREAD_ID);
    expect(threadIdFor({ scenarioId: "", kind: "ADJUSTMENT", token: "aaaa" })).toBe(
      DEFAULT_THREAD_ID,
    );
  });

  // ★Firestore のドキュメントIDになる
  it("★使えない文字は受け付けない", () => {
    for (const bad of ["../x", "sc/014", "sc 014"]) {
      expect(threadIdFor({ scenarioId: bad, kind: "ADJUSTMENT", token: "aaaa" })).toBe(
        DEFAULT_THREAD_ID,
      );
    }
    expect(parseThreadId("../other")).toBe(DEFAULT_THREAD_ID);
    expect(parseThreadId("cons_party_a")).toBe(DEFAULT_THREAD_ID);
  });
});

describe("★スレッドは双方で同じ", () => {
  // ★これが揃わないと、取次ぎが相手側の別のスレッドに落ちる
  it("同じスレッドIDから、それぞれの相談IDが決まる", () => {
    const th = threadIdFor({ scenarioId: "sc_014", kind: "ADJUSTMENT", token: "abcd" });
    expect(consultationIdOf("party_a", th)).toBe("cons_party_a_sc_014_abcd");
    expect(consultationIdOf("party_b", th)).toBe("cons_party_b_sc_014_abcd");
  });

  // ★ここを変えると、過去に書いたものが読めなくなる
  it("★既定のスレッドは、これまでのIDを保つ", () => {
    expect(consultationIdOf("party_a", DEFAULT_THREAD_ID)).toBe("cons_party_a");
  });
});

/**
 * ★スレッドを入れる前の相談は `cons_{partyId}_{scenarioId}` という名前だった。
 *   ここが繋がらないと、**過去に書いたものに到達する URL が無くなる。**
 *   （実測：デプロイ後、sc_009 の会話が開けなくなった）
 */
describe("★スレッドを入れる前の相談に、いまも到達できる", () => {
  it("th_{シナリオ} は、これまでの相談IDを指す", () => {
    expect(consultationIdOf("party_a", "th_sc_009")).toBe("cons_party_a_sc_009");
  });

  it("★古い相談IDから、開くための鍵を復元できる", () => {
    expect(threadIdOfConsultation("cons_party_a_sc_009", "party_a")).toBe("th_sc_009");
    expect(threadIdOfConsultation("cons_party_a", "party_a")).toBe(DEFAULT_THREAD_ID);
  });

  it("新しい形の相談IDでも、そのまま復元できる", () => {
    const th = threadIdFor({ scenarioId: "sc_014", kind: "ADJUSTMENT", token: "abcd" });
    const id = consultationIdOf("party_a", th);
    expect(consultationIdOf("party_a", threadIdOfConsultation(id, "party_a"))).toBe(id);
  });

  it("★他人の相談IDからは復元しない", () => {
    expect(threadIdOfConsultation("cons_party_b_sc_009", "party_a")).toBe(DEFAULT_THREAD_ID);
  });
});

describe("★他人の相談を開かせない", () => {
  it("自分のものだけ真", () => {
    expect(ownsConsultationId("cons_party_a", "party_a")).toBe(true);
    expect(ownsConsultationId("cons_party_a_sc_014_abcd", "party_a")).toBe(true);
    expect(ownsConsultationId("cons_party_a_sc_009", "party_a")).toBe(true);
  });

  it("★他人のものは偽", () => {
    expect(ownsConsultationId("cons_party_b_sc_014_abcd", "party_a")).toBe(false);
  });

  // ★party_a と party_abc を取り違えない
  it("★接頭辞が一致するだけの別人を通さない", () => {
    expect(ownsConsultationId("cons_party_abc", "party_a")).toBe(false);
    expect(threadIdOfConsultation("cons_party_abc", "party_a")).toBe(DEFAULT_THREAD_ID);
  });
});
