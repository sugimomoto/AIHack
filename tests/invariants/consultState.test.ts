import { describe, expect, it } from "vitest";
import {
  CONSULT_NO_HURRY,
  CONSULT_STATE_LABEL,
  CONSULT_STATES,
  consultStateOf,
  isSettled,
} from "@/domain/consultation/state";

/**
 * ★対応が決まったもの・返事待ちのものが、まったく分からなかった。
 *   題と日付しか出していなかった。
 *
 * ★ただし未読の印も件数バッジも持たない。
 *   「3件未読」は、開かない人を責める形になる。
 */

describe("★いまどうなっているか", () => {
  it("自分の発言より新しい取次ぎがあれば、こちらの番", () => {
    expect(
      consultStateOf({ lastOwnAt: "2026-08-10T00:00:00Z", lastInboundAt: "2026-08-11T00:00:00Z" }),
    ).toBe("ARRIVED");
  });

  it("自分が最後なら、お預かり中", () => {
    expect(
      consultStateOf({ lastOwnAt: "2026-08-12T00:00:00Z", lastInboundAt: "2026-08-11T00:00:00Z" }),
    ).toBe("HELD");
  });

  it("まだ何も書いていなければ、書きかけ", () => {
    expect(consultStateOf({})).toBe("DRAFT");
  });

  it("届いているだけで自分は書いていない場合も、こちらの番", () => {
    expect(consultStateOf({ lastInboundAt: "2026-08-11T00:00:00Z" })).toBe("ARRIVED");
  });

  it("★合意済はすべてに優先する", () => {
    expect(
      consultStateOf({ lastInboundAt: "2026-08-12T00:00:00Z", settled: true }),
    ).toBe("SETTLED");
    expect(isSettled("SETTLED")).toBe(true);
    expect(isSettled("ARRIVED")).toBe(false);
  });
});

describe("★数で急かさない", () => {
  it("★どの文言にも件数が入らない", () => {
    for (const s of CONSULT_STATES) {
      expect(CONSULT_STATE_LABEL[s]).not.toMatch(/[0-9０-９]/);
      expect(CONSULT_STATE_LABEL[s]).not.toContain("件");
      expect(CONSULT_STATE_LABEL[s]).not.toContain("未読");
    }
  });

  it("★責める語・急かす語を使わない", () => {
    const all = Object.values(CONSULT_STATE_LABEL).join("") + CONSULT_NO_HURRY;
    for (const w of ["至急", "早く", "遅れ", "未対応", "放置", "してください"]) {
      expect(all).not.toContain(w);
    }
    expect(all).not.toMatch(/[!！]/);
  });

  // ★急かす代わりに、急がなくてよいと書く
  it("届いている行に添える一文がある", () => {
    expect(CONSULT_NO_HURRY).toContain("急ぎません");
  });
});
