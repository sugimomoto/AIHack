import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AGREEMENT_TOPICS } from "@/domain/agreement/topics";

const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const categories = read("firestore/seeds/topicCategories.json");
const scenarios = read("firestore/seeds/scenarios.json");

describe("マスタ seed の整合", () => {
  it("シナリオの categoryId が実在する", () => {
    const ids = new Set(categories.map((c: { id: string }) => c.id));
    for (const s of scenarios) expect(ids.has(s.categoryId)).toBe(true);
  });

  it("★FORMAL は必ず論点に紐づく（公正証書の条項になるため）", () => {
    for (const s of scenarios.filter((x: { kind: string }) => x.kind === "FORMAL")) {
      expect(AGREEMENT_TOPICS as readonly string[]).toContain(s.linkedTopic);
    }
  });

  it("★FORMAL は isSystem である（カスタマイズ不可）", () => {
    for (const s of scenarios.filter((x: { kind: string }) => x.kind === "FORMAL")) {
      expect(s.isSystem).toBe(true);
    }
  });

  it("NOTIFICATION は合意を要さない", () => {
    for (const s of scenarios.filter((x: { kind: string }) => x.kind === "NOTIFICATION")) {
      expect(s.requiresConsent).toBe(false);
    }
  });

  it("IDが重複していない", () => {
    const ids = scenarios.map((s: { id: string }) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
