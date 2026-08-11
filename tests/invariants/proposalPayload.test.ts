import { describe, expect, it } from "vitest";
import { toProposalSchema, stripUnstated } from "@/domain/relay/payload";

/**
 * ★P3｜数字と条項をLLMに作らせない
 *
 * 合意のスキーマ（payloadSchemas）は required を持つ。
 * 「月3万が限界」という入力にそのまま使うと、
 * **書かれていない支払日や終期をLLMが埋める。**
 * 入力に無い値を埋めた提案は、当事者が言っていないことを相手に伝える。
 *
 * ★当初 required を外す方針で書いたが、実機で 400 が返った。
 *   **OpenAI の strict モードは、全プロパティが required であることを要求する。**
 *
 * そこで「全項目を required にしたうえで、null を許す」形にした。
 *
 *   モデルは「書かれていない」と答えられる（null を返せる）
 *     ↓
 *   stripUnstated が null を落とす
 *     ↓
 *   結果として、書かれた項目だけが残る
 *
 * ★このテストは実装より先に書かれた（400 を受けて期待値を修正）
 */

const AGREEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["monthlyAmount", "payDay", "until"],
  properties: {
    monthlyAmount: { type: "integer", minimum: 0, title: "月額（円）" },
    payDay: { type: "string", enum: ["LAST_DAY", "DAY_5"] },
    until: { type: "string", enum: ["AGE_18", "AGE_20"] },
    specialExpenses: {
      type: "object",
      additionalProperties: false,
      required: ["shareRatio"],
      properties: { shareRatio: { type: "number" }, requiresConsultation: { type: "boolean" } },
    },
  },
};

describe("★提案用スキーマ", () => {
  const s = toProposalSchema(AGREEMENT_SCHEMA) as Record<string, unknown>;

  it("★全プロパティが required になる（strict モードの要求）", () => {
    expect(s.required).toEqual(["monthlyAmount", "payDay", "until", "specialExpenses"]);
  });

  it("★入れ子も全プロパティが required になる", () => {
    const props = s.properties as Record<string, Record<string, unknown>>;
    expect(props.specialExpenses.required).toEqual(["shareRatio", "requiresConsultation"]);
  });

  it("★すべての型が null を許す（「書かれていない」と答えられる）", () => {
    const props = s.properties as Record<string, Record<string, unknown>>;
    expect(props.monthlyAmount.type).toEqual(["integer", "null"]);
    expect(props.payDay.type).toEqual(["string", "null"]);
  });

  it("★enum にも null が含まれる（null を返せないと埋めるしかなくなる）", () => {
    const props = s.properties as Record<string, Record<string, unknown>>;
    expect(props.payDay.enum).toEqual(["LAST_DAY", "DAY_5", null]);
  });

  it("★additionalProperties は false のまま（定義外の値を作らせない）", () => {
    expect(s.additionalProperties).toBe(false);
  });

  it("元のスキーマを壊さない（マスタは共有されている）", () => {
    expect(AGREEMENT_SCHEMA.required).toEqual(["monthlyAmount", "payDay", "until"]);
    expect(AGREEMENT_SCHEMA.properties.monthlyAmount.type).toBe("integer");
  });
});

describe("★言及されていない値を落とす", () => {
  it("null・undefined・空文字を落とす", () => {
    expect(stripUnstated({ monthlyAmount: 30000, payDay: null, until: "", memo: undefined })).toEqual({
      monthlyAmount: 30000,
    });
  });

  it("★0 は落とさない（0円という提案はありうる）", () => {
    expect(stripUnstated({ monthlyAmount: 0 })).toEqual({ monthlyAmount: 0 });
  });

  it("false は落とさない", () => {
    expect(stripUnstated({ requiresConsultation: false })).toEqual({ requiresConsultation: false });
  });

  it("入れ子も処理する", () => {
    expect(stripUnstated({ a: { b: 1, c: null }, d: null })).toEqual({ a: { b: 1 } });
  });

  it("★空になった入れ子は落とす", () => {
    expect(stripUnstated({ a: { b: null } })).toEqual({});
  });
});
