import { describe, expect, it } from "vitest";
import {
  DEFAULT_THREAD_ID,
  consultationIdOf,
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
 *
 * ★★ 例外を無くした（2026-08-14）。**どのトピックでも、毎回新しく立てる。**
 *   以前は「養育費を決める」（kind: FORMAL）だけが続きだった。
 *   対話から取り決めへ行く経路を断った（T1）ので、相談は都度のものである。
 */

describe("★続きにするか、都度別にするか", () => {
  // ★ここが今回の要点
  it("★どのトピックでも、開くたびに別のスレッド", () => {
    for (const sc of ["sc_001", "sc_006", "sc_014", "sc_016"]) {
      const a = threadIdFor({ scenarioId: sc, token: "aaaa" });
      const b = threadIdFor({ scenarioId: sc, token: "bbbb" });
      expect(a).not.toBe(b);
    }
  });

  // ★退行の見張り。**続きのIDは、二度と作られない**
  it("★`th_{scenarioId}` という形のIDを、もう作らない", () => {
    for (const sc of ["sc_001", "sc_006", "sc_014"]) {
      for (const token of ["aaaa", "bbbb", "", "x", "!!!!"]) {
        expect(threadIdFor({ scenarioId: sc, token })).not.toBe(`th_${sc}`);
      }
    }
  });

  // ★既定のスレッドに入れると、前回の会話がそのまま続いてしまう
  it("★トピックを選ばずに始めた相談も、毎回新しいスレッド", () => {
    const a = threadIdFor({ scenarioId: null, token: "aaaa" });
    const b = threadIdFor({ scenarioId: null, token: "bbbb" });
    expect(a).not.toBe(b);
    expect(a).not.toBe(DEFAULT_THREAD_ID);
  });

  it("鍵が無ければ既定のスレッド（過去の会話に到達するため）", () => {
    expect(threadIdFor({ scenarioId: null, token: "" })).toBe(DEFAULT_THREAD_ID);
  });

  // ★Firestore のドキュメントIDになる。区切り文字やパスを混ぜさせない
  it("★使えない文字はIDに入れない", () => {
    for (const bad of ["../x", "sc/014", "sc 014", "a".repeat(41)]) {
      const th = threadIdFor({ scenarioId: bad, token: "aaaa" });
      expect(th).not.toContain("/");
      expect(th).not.toContain(" ");
      expect(th).not.toContain("..");
      // ★不正なシナリオIDのかけらも残さない
      expect(th).toBe("th_free_aaaa");
    }
    expect(parseThreadId("../other")).toBe(DEFAULT_THREAD_ID);
    expect(parseThreadId("cons_party_a")).toBe(DEFAULT_THREAD_ID);
  });
});

describe("★スレッドは双方で同じ", () => {
  // ★これが揃わないと、取次ぎが相手側の別のスレッドに落ちる
  it("同じスレッドIDから、それぞれの相談IDが決まる", () => {
    const th = threadIdFor({ scenarioId: "sc_014", token: "abcd" });
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
    const th = threadIdFor({ scenarioId: "sc_014", token: "abcd" });
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
