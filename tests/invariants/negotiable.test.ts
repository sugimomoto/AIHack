import { describe, expect, it } from "vitest";
import { canNegotiateAgreement } from "@/domain/consultation/negotiable";
import { ADJUSTMENT_NOTE } from "@/domain/adjustment/record";

/**
 * ★「進学費用の分担を相談する」が、養育費の枠で決められようとしていた。
 *
 *   sc_003 の linkedTopic は CHILD_SUPPORT。分類も CHILD_SUPPORT になり、
 *   **養育費への提案が作られていた。**
 *   提案は論点ごとに「最後のものが最新」なので、
 *   入学金の話から出た金額が、**合意済みの月額を書き換えうる。**
 */
describe("★取り決めを動かせる相談", () => {
  it("取り決めを決めるための相談だけ（FORMAL）", () => {
    expect(canNegotiateAgreement("FORMAL")).toBe(true);
  });

  // ★ここが true だと、入学金の話が養育費の月額を書き換える
  it("★個別の相談は、取り決めに触れない", () => {
    expect(canNegotiateAgreement("ADJUSTMENT")).toBe(false);
  });

  it("★お知らせも、取り決めに触れない", () => {
    expect(canNegotiateAgreement("NOTIFICATION")).toBe(false);
  });

  // ★「養育費は月5万円にしたい」と自由に書いた人を止めない
  it("トピックを選ばずに書いた相談は、これまでどおり", () => {
    expect(canNegotiateAgreement(null)).toBe(true);
    expect(canNegotiateAgreement(undefined)).toBe(true);
    expect(canNegotiateAgreement("")).toBe(true);
  });

  it("知らない種別は、取り決めに触れない（安全側に倒す）", () => {
    expect(canNegotiateAgreement("SOMETHING_NEW")).toBe(false);
  });

  /**
   * ★★ 以前は相談画面の上に `NOT_NEGOTIABLE_NOTE` を出していた（2026-08-14 に削除）。
   *   `FORMAL` が 0 になり、**トピックを選んだ相談すべてに出る**ようになったため、
   *   区別をしない注意書きになっていた。
   *
   * ★言われていること自体は、**控えの場に残す。**
   */
  it("★動かさないことを書く文が、控えの場にある", () => {
    expect(ADJUSTMENT_NOTE).toContain("変わりません");
  });
});
