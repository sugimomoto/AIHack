import { describe, expect, it } from "vitest";
import { toProposalSchema, stripUnstated } from "@/domain/relay/payload";

/**
 * ★P3｜数字と条項をLLMに作らせない
 *
 * 合意のスキーマ（payloadSchemas）は required を持つ。
 * 「月3万が限界」という入力に対してそのまま使うと、
 * **書かれていない支払日や終期をLLMが埋める。**
 *
 *   入力に無い値を埋めた提案は、当事者が言っていないことを
 *   相手に伝えることになる。
 *
 * 提案の構造化では required を外し、書かれたものだけを取る。
 *
 * ★このテストは実装より先に書かれた
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

  it("★required が外れる（書かれていない値を埋めさせない）", () => {
    expect(s.required).toBeUndefined();
  });

  it("★入れ子の required も外れる", () => {
    const props = s.properties as Record<string, Record<string, unknown>>;
    expect(props.specialExpenses.required).toBeUndefined();
  });

  it("プロパティの定義は保たれる", () => {
    const props = s.properties as Record<string, Record<string, unknown>>;
    expect(props.monthlyAmount.type).toBe("integer");
    expect(props.payDay.enum).toEqual(["LAST_DAY", "DAY_5"]);
  });

  it("★additionalProperties は false のまま（定義外の値を作らせない）", () => {
    expect(s.additionalProperties).toBe(false);
  });

  it("元のスキーマを壊さない", () => {
    expect(AGREEMENT_SCHEMA.required).toEqual(["monthlyAmount", "payDay", "until"]);
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
