import { describe, expect, it } from "vitest";
import { canDeriveSupportRole, LIVING_ARRANGEMENTS, parseLiving, roleFor } from "./living";

describe("同居の状況", () => {
  it("同居していれば受け取る側になる", () => {
    expect(roleFor("TOGETHER")).toBe("CUSTODIAL");
  });

  it("同居していなければ支払う側になる", () => {
    expect(roleFor("APART")).toBe("NON_CUSTODIAL");
  });

  // ★ここを既定値で埋めると、間違ったまま算定表を引く
  it("お子さんによって違う場合は、役割を決めない", () => {
    expect(roleFor("VARIES")).toBeNull();
    expect(canDeriveSupportRole("VARIES")).toBe(false);
  });

  it("あとで答えることを選んだ場合も、役割を決めない", () => {
    expect(roleFor(null)).toBeNull();
    expect(canDeriveSupportRole(null)).toBe(false);
  });

  it("知らない値は受け付けない", () => {
    expect(parseLiving("SOMETIMES")).toBeNull();
    expect(parseLiving("")).toBeNull();
    expect(parseLiving(undefined)).toBeNull();
  });

  it("保存された値は読み戻せる", () => {
    for (const l of LIVING_ARRANGEMENTS) expect(parseLiving(l)).toBe(l);
  });
});
