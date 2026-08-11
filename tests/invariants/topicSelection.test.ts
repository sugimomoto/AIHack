import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { linkScenario, scenariosFor, isSkippable } from "@/domain/topic/selection";
import { LEVELS, levelOfTopic, requiresAgreement } from "@/domain/topic/level";

/**
 * ★トピック選択を必須にしてはならない
 *
 *   選択を強制すると、**感情の受け止めが選択画面の後ろに隠れる。**
 *   このプロダクトは、まず受け止めるためにある。
 *
 * ★このテストは実装より先に書かれた
 */

const SCENARIOS = JSON.parse(readFileSync("firestore/seeds/scenarios.json", "utf8")) as {
  id: string;
  title: string;
  kind: string;
  linkedTopic: string | null;
}[];

describe("★選択はスキップできる", () => {
  it("★常にスキップ可能である（条件つきにしない）", () => {
    expect(isSkippable()).toBe(true);
    expect(isSkippable.length).toBe(0); // 引数で分岐させない
  });

  it("★自由入力から始めた相談に、後からシナリオを紐づけられる", () => {
    const c = { scenarioId: null as string | null, topic: null as string | null };
    const r = linkScenario(c, { scenarioId: "sc_1", topic: "CHILD_SUPPORT" });
    expect(r.scenarioId).toBe("sc_1");
    expect(r.topic).toBe("CHILD_SUPPORT");
  });

  it("★既に紐づいているものを上書きしない", () => {
    const c = { scenarioId: "sc_first", topic: "VISITATION" };
    const r = linkScenario(c, { scenarioId: "sc_second", topic: "CHILD_SUPPORT" });
    expect(r.scenarioId).toBe("sc_first");
  });
});

describe("シナリオの提示", () => {
  it("論点で絞れる", () => {
    const r = scenariosFor(SCENARIOS, "CHILD_SUPPORT");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((s) => s.linkedTopic === "CHILD_SUPPORT")).toBe(true);
  });

  it("★該当が無くても空配列を返す（選べないことを理由に止めない）", () => {
    expect(scenariosFor(SCENARIOS, "NOT_A_TOPIC")).toEqual([]);
  });
});

/**
 * ★L1・L2・L3 の区別
 *
 *   L3（日常連絡）は合意を求めない。
 *   **ただし C1 の扱いは変わらない。**
 *   合意を求めないだけで、原文は越えないし、事情は伝聞形式で伝わる。
 */
describe("★やりとりの3層", () => {
  it("層が3つある", () => {
    expect(LEVELS).toEqual(["L1", "L2", "L3"]);
  });

  it.each([
    ["CHILD_SUPPORT", "L1"],
    ["VISITATION", "L1"],
    ["SCHEDULE", "L2"],
    ["DAILY_CONTACT", "L3"],
  ])("%s は %s", (topic, level) => {
    expect(levelOfTopic(topic)).toBe(level);
  });

  it("★日常連絡は合意を求めない", () => {
    expect(requiresAgreement("DAILY_CONTACT")).toBe(false);
  });

  it("養育費・面会交流は合意を求める", () => {
    expect(requiresAgreement("CHILD_SUPPORT")).toBe(true);
    expect(requiresAgreement("VISITATION")).toBe(true);
  });

  it("★未知の論点では合意を求めない（勝手に取り決めにしない）", () => {
    expect(requiresAgreement("OTHER")).toBe(false);
    expect(requiresAgreement("UNKNOWN")).toBe(false);
  });
});
